/**
 * Importação da planilha da folha, em dois passos:
 * 1. analisar: lê o arquivo, compara com o que já está cadastrado e devolve
 *    uma proposta e um relatório. Não grava nada.
 * 2. importar: a pessoa confere o relatório, diz a qual Serviço corresponde
 *    cada nome de lotação que o app não reconheceu, e confirma. A proposta é
 *    validada de novo antes de gravar.
 *
 * Regras: lotação fora de 100% não é gravada (o funcionário entra sem lotação
 * e aparece no atalho "sem lotação"); funcionários já cadastrados não são
 * duplicados nem têm os valores alterados. A lotação deles, se vier no arquivo,
 * é incluída (quem ainda não tem) ou atualizada (quem tem uma diferente, a
 * partir da data escolhida; a anterior fica no histórico).
 * Também dá para importar só a aba de lotação, depois da folha.
 */
import { z } from 'zod';
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { inserirRegistros, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { Areas, Servicos } from '@/nucleo/estrutura/tabelas';
import { calcularLinha, COMPONENTES, parametrosCom, somaRateio, validarRateio, type LinhaRateio } from '../dominio/folha';
import {
  conferirMapeamento,
  lerPlanilhaFolha,
  mapeamentoSugerido,
  normalizar,
  resumirAbas,
  type AbaImportada,
  type LotacaoLida,
  type AbaResumida,
  type CelulaImportada,
  type Mapeamento,
} from '../dominio/importacao';
import { Componentes, Parametros, Postos, Rateios } from '../dados/tabelas';
import { ErroValidacaoFolha, lerFolha, salvarRateios } from './folha';

function exigirImportar(quem: Autorizador) {
  if (!quem.temPermissao('orcamento.folha.editar') || !quem.temPermissao('orcamento.folha.ver_individual')) throw new ErroPermissao();
}

// ---------------------------------------------------------------------------
// Proposta (vai para a tela e volta na confirmação)
// ---------------------------------------------------------------------------

const esquemaProposta = z.object({
  ano: z.number().int(),
  /** Cada nome de lotação da planilha e o Serviço correspondente (null = falta escolher). */
  servicos: z.array(z.object({ nome: z.string(), servico: z.string().nullable() })),
  postos: z.array(
    z.object({
      ficha: z.string().nullable(),
      colaborador: z.string().nullable(),
      cargo: z.string(),
      departamento: z.string().nullable(),
      cargaHoraria: z.number().nullable(),
      inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      componentes: z.object({
        ...Object.fromEntries(COMPONENTES.map((c) => [c.chave, z.number().min(0)])),
        reajuste: z.number().min(0).max(100),
        hora_atividade: z.boolean(),
      }),
      /** Lotação pelo nome usado na planilha. */
      lotacao: z.array(z.object({ nome: z.string(), percentual: z.number() })).nullable(),
    }),
  ),
  /** Lotação de funcionários já cadastrados: incluir (não têm) ou atualizar (têm outra). */
  lotacoes: z
    .array(
      z.object({
        postoId: z.string(),
        tipo: z.enum(['incluir', 'atualizar']),
        lotacao: z.array(z.object({ nome: z.string(), percentual: z.number() })),
      }),
    )
    .default([]),
  /** Atualizar também as lotações diferentes (marcado na confirmação). */
  atualizarLotacoes: z.boolean().default(true),
  /** A partir de quando valem as lotações atualizadas (escolhido na confirmação). */
  vigencia: z.string().nullable().default(null),
});

export type PropostaImportacao = z.infer<typeof esquemaProposta>;

const coluna = z.number().int().min(0).max(500);
const esquemaMapeamento = z.object({
  soLotacao: z.boolean().optional(),
  folha: z.object({
    aba: z.string(),
    cabecalho: z.number().int(),
    colunas: z.record(z.string(), coluna),
  }),
  lotacao: z.discriminatedUnion('modo', [
    z.object({ modo: z.literal('nenhuma') }),
    z.object({ modo: z.literal('coluna') }),
    z.object({
      modo: z.literal('linhas'),
      aba: z.string(),
      cabecalho: z.number().int(),
      funcionario: coluna,
      servico: coluna,
      percentual: coluna.nullable(),
    }),
    z.object({
      modo: z.literal('colunas'),
      aba: z.string(),
      cabecalho: z.number().int(),
      funcionario: coluna,
      servicos: z.array(coluna),
    }),
  ]),
});

/** Confere o formato do DE-PARA que veio da tela. */
export function lerMapeamento(bruto: unknown): Mapeamento {
  const r = esquemaMapeamento.safeParse(bruto);
  if (!r.success) throw new ErroValidacaoFolha('O DE-PARA das colunas veio incompleto. Confira as escolhas e tente de novo.');
  return r.data as Mapeamento;
}

export interface RelatorioImportacao {
  abas: { estudo: string | null; rateio: string | null };
  /** Arquivo só com a lotação de quem já está cadastrado. */
  soLotacao: boolean;
  /** Lotação de funcionários já cadastrados. */
  lotacoesExistentes: {
    incluir: { ficha: string | null; colaborador: string | null }[];
    atualizar: { ficha: string | null; colaborador: string | null }[];
    iguais: number;
  };
  avisos: string[];
  colunasIgnoradas: { aba: string; colunas: string[] }[];
  colunasCalculadas: string[];
  servicos: { reconhecidos: number; aEscolher: number };
  postos: { total: number; vagas: number; comLotacao: number };
  fichasJaCadastradas: string[];
  /** Vagas previstas (sem código) que já existem com a mesma descrição e cargo. */
  vagasJaCadastradas: number;
  lotacoesForaDe100: {
    ficha: string | null;
    colaborador: string | null;
    soma: number;
  }[];
  /** Funcionários da aba de lotação que não estão na aba da folha. */
  lotacaoSemFuncionario: string[];
  semLotacao: { ficha: string | null; colaborador: string | null }[];
  semAdmissao: number;
  diferencasCusto: {
    ficha: string | null;
    colaborador: string | null;
    planilha: number;
    app: number;
  }[];
  custoMensalApp: number;
  custoMensalPlanilha: number | null;
}

export interface Analise {
  proposta: PropostaImportacao;
  relatorio: RelatorioImportacao;
  /** Serviços cadastrados, para escolher a correspondência. */
  opcoes: { codigo: string; nome: string; area: string }[];
}

/** Converte o arquivo .xlsx em abas de células. */
export async function lerXlsx(conteudo: ArrayBuffer): Promise<AbaImportada[]> {
  const ExcelJS = (await import('exceljs')).default;
  const livro = new ExcelJS.Workbook();
  try {
    await livro.xlsx.load(conteudo);
  } catch {
    throw new ErroValidacaoFolha('Não consegui abrir o arquivo. Envie a planilha no formato Excel (.xlsx).');
  }
  return livro.worksheets.map((aba) => {
    const linhas: CelulaImportada[][] = [];
    aba.eachRow({ includeEmpty: true }, (linha, n) => {
      const valores: CelulaImportada[] = [];
      linha.eachCell({ includeEmpty: true }, (celula, col) => {
        const v = celula.value as unknown;
        let valor: CelulaImportada;
        if (v && typeof v === 'object' && !(v instanceof Date)) {
          const o = v as {
            result?: unknown;
            richText?: { text: string }[];
            text?: string;
            error?: string;
          };
          if ('result' in o) valor = (o.result ?? null) as CelulaImportada;
          else if (o.richText) valor = o.richText.map((r) => r.text).join('');
          else if (o.text) valor = o.text;
          else valor = null;
        } else valor = v as CelulaImportada;
        if (typeof valor === 'object' && valor !== null && !(valor instanceof Date)) valor = null; // erros de fórmula (#REF!)
        valores[col - 1] = valor;
      });
      linhas[n - 1] = valores;
    });
    return { nome: aba.name, linhas: Array.from(linhas, (l) => l ?? []) };
  });
}

/** Passo 1: as abas do arquivo e o DE-PARA sugerido, para a pessoa conferir. Não grava nada. */
export function descreverArquivo(quem: Autorizador, abas: AbaImportada[]): { abas: AbaResumida[]; sugestao: Mapeamento | null } {
  exigirImportar(quem);
  if (abas.length === 0) throw new ErroValidacaoFolha('O arquivo não tem abas.');
  return { abas: resumirAbas(abas), sugestao: mapeamentoSugerido(abas) };
}

/** Passo 2: lê o arquivo pelo DE-PARA escolhido e compara com o que já está cadastrado. Não grava nada. */
export async function analisarImportacao(p: Planilhas, quem: Autorizador, abas: AbaImportada[], mapeamento?: Mapeamento): Promise<Analise> {
  exigirImportar(quem);
  if (mapeamento) {
    const erros = conferirMapeamento(abas, mapeamento);
    if (erros.length) throw new ErroValidacaoFolha(erros.join(' '));
  }
  const leitura = lerPlanilhaFolha(abas, mapeamento);
  const soLotacao = Boolean(mapeamento?.soLotacao);
  if (soLotacao && leitura.lotacoesAvulsas.length === 0) {
    throw new ErroValidacaoFolha(['Não encontrei rateios na aba escolhida. Confira a aba, a linha do cabeçalho e as colunas.', ...leitura.avisos].join(' '));
  }
  if (!soLotacao && (!leitura.abas.estudo || leitura.postos.length === 0)) {
    throw new ErroValidacaoFolha(
      ['Não encontrei funcionários para importar. Confira a aba, a linha do cabeçalho e a coluna do Cargo.', ...leitura.avisos].join(' '),
    );
  }
  const [postos, parametrosLidos, servicos, areas] = await lerTabelas(p, [Postos, Parametros, Servicos, Areas] as const);
  const parametros = parametrosCom(Object.fromEntries(parametrosLidos.ativos().map((x) => [x.chave, x.valor])));
  const ano = parametros.ano;

  // Nomes de lotação da planilha × Serviços cadastrados (pelo nome ou pelo código).
  const servicoPorNome = new Map<string, string>();
  for (const s of servicos.ativos()) {
    servicoPorNome.set(normalizar(s.nome), s.codigo);
    servicoPorNome.set(normalizar(s.codigo), s.codigo);
  }

  // Funcionários já cadastrados (sem desligamento): pelo código, pela vaga ou pelo nome (só nomes que não se repetem).
  const ativos = postos.ativos().filter((x) => !x.desligamento);
  const cadastradoPorFicha = new Map(ativos.filter((x) => x.ficha).map((x) => [x.ficha!, x]));
  const cadastradoPorVaga = new Map(ativos.filter((x) => !x.ficha).map((x) => [chaveVaga(x.colaborador, x.cargo), x]));
  const contagemNomes = new Map<string, number>();
  for (const x of ativos) if (x.colaborador) contagemNomes.set(normalizar(x.colaborador), (contagemNomes.get(normalizar(x.colaborador)) ?? 0) + 1);
  const cadastradoPorNome = new Map(
    ativos.filter((x) => x.colaborador && contagemNomes.get(normalizar(x.colaborador)) === 1).map((x) => [normalizar(x.colaborador), x]),
  );

  const relatorio: RelatorioImportacao = {
    abas: { estudo: leitura.abas.estudo, rateio: leitura.abas.rateio },
    soLotacao,
    lotacoesExistentes: { incluir: [], atualizar: [], iguais: 0 },
    avisos: leitura.avisos,
    colunasIgnoradas: leitura.colunasIgnoradas,
    colunasCalculadas: leitura.colunasCalculadas,
    servicos: { reconhecidos: 0, aEscolher: 0 },
    postos: { total: 0, vagas: 0, comLotacao: 0 },
    fichasJaCadastradas: [],
    vagasJaCadastradas: 0,
    lotacoesForaDe100: [],
    lotacaoSemFuncionario: [...leitura.lotacaoSemFuncionario],
    semLotacao: [],
    semAdmissao: 0,
    diferencasCusto: [],
    custoMensalApp: 0,
    custoMensalPlanilha: null,
  };

  // Lotação que o arquivo traz para quem já está cadastrado.
  const folhaAtual = await lerFolha(p);
  const lotacoes: PropostaImportacao['lotacoes'] = [];
  const nomesUsados: string[] = [];
  const lotacaoDeCadastrado = (posto: (typeof ativos)[number], lida: { centro: string; percentual: number }[] | null) => {
    if (!lida || lida.length === 0) return;
    const quem = { ficha: posto.ficha, colaborador: posto.colaborador };
    const soma = somaRateio(lida.map((l) => ({ centro: l.centro, percentual: l.percentual })));
    if (soma !== 100) {
      relatorio.lotacoesForaDe100.push({ ...quem, soma });
      return;
    }
    const lotacao = lida.map((l) => ({
      nome: l.centro,
      percentual: l.percentual,
    }));
    const atual = folhaAtual.rateio(posto.id);
    if (!atual?.length) {
      relatorio.lotacoesExistentes.incluir.push(quem);
      lotacoes.push({ postoId: posto.id, tipo: 'incluir', lotacao });
    } else {
      // Se todos os nomes já são reconhecidos, dá para saber agora se mudou.
      const reconhecidos = lotacao.every((l) => servicoPorNome.has(normalizar(l.nome)));
      if (reconhecidos && iguais(lotacaoEmServicos(lotacao, servicoPorNome), atual)) {
        relatorio.lotacoesExistentes.iguais++;
        return;
      }
      relatorio.lotacoesExistentes.atualizar.push(quem);
      lotacoes.push({ postoId: posto.id, tipo: 'atualizar', lotacao });
    }
    nomesUsados.push(...lotacao.map((l) => l.nome));
  };

  if (soLotacao) {
    for (const x of leitura.lotacoesAvulsas as LotacaoLida[]) {
      const posto = cadastradoPorFicha.get(x.quem) ?? cadastradoPorNome.get(normalizar(x.quem));
      if (!posto) relatorio.lotacaoSemFuncionario.push(x.quem);
      else lotacaoDeCadastrado(posto, x.lotacao);
    }
  }

  const propostos: PropostaImportacao['postos'] = [];
  const fichasNaLeitura = new Set<string>();
  let somaPlanilha = 0;
  let temTotal = false;
  for (const x of leitura.postos) {
    if (x.ficha && (cadastradoPorFicha.has(x.ficha) || fichasNaLeitura.has(x.ficha))) {
      relatorio.fichasJaCadastradas.push(x.ficha);
      const posto = cadastradoPorFicha.get(x.ficha);
      if (posto && !fichasNaLeitura.has(x.ficha)) lotacaoDeCadastrado(posto, x.lotacao);
      fichasNaLeitura.add(x.ficha);
      continue;
    }
    if (x.ficha) fichasNaLeitura.add(x.ficha);
    else if (cadastradoPorVaga.has(chaveVaga(x.colaborador, x.cargo))) {
      relatorio.vagasJaCadastradas++;
      lotacaoDeCadastrado(cadastradoPorVaga.get(chaveVaga(x.colaborador, x.cargo))!, x.lotacao);
      continue;
    }
    let lotacao: PropostaImportacao['postos'][number]['lotacao'] = null;
    const lido = x.lotacao;
    if (lido && lido.length) {
      const soma = somaRateio(lido.map((l) => ({ centro: l.centro, percentual: l.percentual })));
      if (soma === 100)
        lotacao = lido.map((l) => ({
          nome: l.centro,
          percentual: l.percentual,
        }));
      else
        relatorio.lotacoesForaDe100.push({
          ficha: x.ficha,
          colaborador: x.colaborador,
          soma,
        });
    } else relatorio.semLotacao.push({ ficha: x.ficha, colaborador: x.colaborador });
    if (!x.inicio && x.colaborador) relatorio.semAdmissao++;

    const componentes = {
      ...x.componentes,
      reajuste: x.reajuste,
      hora_atividade: x.horaAtividade,
    };
    // Compara com a coluna TOTAL da planilha, que já tem o reajuste aplicado.
    const custo = calcularLinha(componentes, x.cargaHoraria, parametros, 12).total;
    relatorio.custoMensalApp += custo;
    if (x.totalPlanilha !== null) {
      temTotal = true;
      somaPlanilha += x.totalPlanilha;
      if (Math.abs(x.totalPlanilha - custo) > 1)
        relatorio.diferencasCusto.push({
          ficha: x.ficha,
          colaborador: x.colaborador,
          planilha: x.totalPlanilha,
          app: custo,
        });
    }
    propostos.push({
      ficha: x.ficha,
      colaborador: x.colaborador,
      cargo: x.cargo,
      departamento: x.departamento,
      cargaHoraria: x.cargaHoraria,
      inicio: x.inicio ?? `${ano}-01-01`,
      componentes,
      lotacao,
    });
  }

  relatorio.postos = {
    total: propostos.length,
    vagas: propostos.filter((x) => !x.ficha).length,
    comLotacao: propostos.filter((x) => x.lotacao).length,
  };
  relatorio.custoMensalApp = Math.round(relatorio.custoMensalApp * 100) / 100;
  relatorio.custoMensalPlanilha = temTotal ? Math.round(somaPlanilha * 100) / 100 : null;

  // Só os nomes de lotação que vão ser gravados entram na escolha de serviços.
  const nomes = new Map<string, string>();
  for (const n of [...propostos.flatMap((x) => (x.lotacao ?? []).map((l) => l.nome)), ...nomesUsados]) nomes.set(normalizar(n), n);
  const mapa = [...nomes.values()]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .map((nome) => ({
      nome,
      servico: servicoPorNome.get(normalizar(nome)) ?? null,
    }));
  relatorio.servicos = {
    reconhecidos: mapa.filter((m) => m.servico).length,
    aEscolher: mapa.filter((m) => !m.servico).length,
  };

  const nomeArea = new Map(areas.ativos().map((a) => [a.codigo, a.nome]));
  await registrarAuditoria(p, {
    usuario: quem.email,
    acao: 'leitura',
    entidade: 'ImportacaoFolha',
    detalhes: { postos: propostos.length, lotacoes: lotacoes.length },
  });
  return {
    proposta: {
      ano,
      servicos: mapa,
      postos: propostos,
      lotacoes,
      atualizarLotacoes: true,
      vigencia: null,
    },
    relatorio,
    opcoes: servicos
      .ativos()
      .map((s) => ({
        codigo: s.codigo,
        nome: s.nome,
        area: s.area ? (nomeArea.get(s.area) ?? s.area) : 'Sem área',
      }))
      .sort((a, b) => a.area.localeCompare(b.area, 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR')),
  };
}

const iguais = (a: LinhaRateio[], b: LinhaRateio[]) => {
  const ordem = (l: LinhaRateio[]) => JSON.stringify([...l].sort((x, y) => x.centro.localeCompare(y.centro)).map((x) => [x.centro, x.percentual]));
  return ordem(a) === ordem(b);
};

const chaveVaga = (descricao: string | null, cargo: string) => `${normalizar(descricao ?? '')}|${normalizar(cargo)}`;

/** Traduz a lotação pelos nomes da planilha para Serviços, somando nomes que caem no mesmo serviço. */
function lotacaoEmServicos(lotacao: { nome: string; percentual: number }[], mapa: Map<string, string>): LinhaRateio[] {
  const porServico = new Map<string, number>();
  for (const l of lotacao) {
    const s = mapa.get(normalizar(l.nome))!;
    porServico.set(s, Math.round(((porServico.get(s) ?? 0) + l.percentual) * 100) / 100);
  }
  return [...porServico].map(([centro, percentual]) => ({
    centro,
    percentual,
  }));
}

export async function importarFolha(p: Planilhas, quem: Autorizador, bruta: unknown): Promise<{ postos: number; lotacoes: number }> {
  exigirImportar(quem);
  const r = esquemaProposta.safeParse(bruta);
  if (!r.success) throw new ErroValidacaoFolha('A importação veio incompleta. Envie o arquivo de novo.');
  const proposta = r.data;
  const [servicos, postos, componentes, rateios] = await lerTabelas(p, [Servicos, Postos, Componentes, Rateios] as const);

  const existentes = new Set(servicos.ativos().map((s) => s.codigo));
  const faltando = proposta.servicos.filter((m) => !m.servico).map((m) => m.nome);
  if (faltando.length) throw new ErroValidacaoFolha(`Escolha o serviço correspondente a: ${faltando.join(', ')}.`);
  if (proposta.servicos.some((m) => !existentes.has(m.servico!)))
    throw new ErroValidacaoFolha('Há serviço escolhido que não existe mais. Envie o arquivo de novo.');
  const mapa = new Map(proposta.servicos.map((m) => [normalizar(m.nome), m.servico!]));

  const fichasAtivas = new Set(
    postos
      .ativos()
      .filter((x) => x.ficha && !x.desligamento)
      .map((x) => x.ficha!),
  );
  const vagasAtivas = new Set(
    postos
      .ativos()
      .filter((x) => !x.ficha && !x.desligamento)
      .map((x) => chaveVaga(x.colaborador, x.cargo)),
  );
  const novos = proposta.postos
    .filter((x) => (x.ficha ? !fichasAtivas.has(x.ficha) : !vagasAtivas.has(chaveVaga(x.colaborador, x.cargo))))
    .map((x) => {
      if (x.lotacao?.some((l) => !mapa.has(normalizar(l.nome))))
        throw new ErroValidacaoFolha('Há lotação com nome sem correspondência. Envie o arquivo de novo.');
      const linhas = x.lotacao ? lotacaoEmServicos(x.lotacao, mapa) : null;
      if (linhas && validarRateio(linhas).length) throw new ErroValidacaoFolha('Há lotação inválida na importação. Envie o arquivo de novo.');
      return { ...x, linhas };
    });

  // Lotação de quem já está cadastrado: tudo conferido antes de gravar qualquer coisa.
  const vigencia = (inicio: string) => (inicio < `${proposta.ano}-01-01` ? `${proposta.ano}-01-01` : inicio);
  const cadastrados = new Map(
    postos
      .ativos()
      .filter((x) => !x.desligamento)
      .map((x) => [x.id, x]),
  );
  const lotacoes = proposta.lotacoes
    .filter((x) => x.tipo === 'incluir' || proposta.atualizarLotacoes)
    .map((x) => {
      const posto = cadastrados.get(x.postoId);
      if (!posto) throw new ErroValidacaoFolha('Um funcionário da importação não está mais cadastrado. Envie o arquivo de novo.');
      if (x.lotacao.some((l) => !mapa.has(normalizar(l.nome))))
        throw new ErroValidacaoFolha('Há lotação com nome sem correspondência. Envie o arquivo de novo.');
      const rateio = lotacaoEmServicos(x.lotacao, mapa);
      if (validarRateio(rateio).length) throw new ErroValidacaoFolha('Há lotação inválida na importação. Envie o arquivo de novo.');
      return {
        postoId: x.postoId,
        rateio,
        vigencia: x.tipo === 'incluir' ? vigencia(posto.inicio) : proposta.vigencia,
      };
    });
  if (lotacoes.some((x) => !x.vigencia || !/^\d{4}-\d{2}-\d{2}$/.test(x.vigencia))) {
    throw new ErroValidacaoFolha('Informe a partir de quando valem as lotações atualizadas.');
  }
  if (novos.length === 0 && lotacoes.length === 0) throw new ErroValidacaoFolha('Não há nada para importar.');

  const autoria = { email: quem.email };
  const gravados = await inserirRegistros(
    p,
    postos,
    novos.map((x) => ({
      ficha: x.ficha,
      colaborador: x.colaborador,
      cargo: x.cargo,
      departamento: x.departamento,
      carga_horaria: x.cargaHoraria,
      inicio: x.inicio,
    })),
    autoria,
  );
  await inserirRegistros(
    p,
    componentes,
    gravados.map((g, i) => ({
      posto_id: g.id,
      vigencia: vigencia(g.inicio),
      ...novos[i].componentes,
    })) as never,
    autoria,
  );
  await inserirRegistros(
    p,
    rateios,
    gravados.flatMap((g, i) => {
      const lote = crypto.randomUUID();
      return (novos[i].linhas ?? []).map((l) => ({
        posto_id: g.id,
        lote,
        servico: l.centro,
        percentual: l.percentual,
        vigencia: vigencia(g.inicio),
      }));
    }),
    autoria,
  );
  // As lotações de quem já existe passam pela mesma regra da tela Lotação (só grava o que mudou).
  let lotacoesGravadas = 0;
  const porVigencia = new Map<string, { postoId: string; rateio: LinhaRateio[] }[]>();
  for (const x of lotacoes) porVigencia.set(x.vigencia!, [...(porVigencia.get(x.vigencia!) ?? []), { postoId: x.postoId, rateio: x.rateio }]);
  for (const [vig, lista] of porVigencia) lotacoesGravadas += await salvarRateios(p, quem, lista, vig);

  await registrarAuditoria(p, {
    usuario: quem.email,
    acao: 'inclusao',
    entidade: 'ImportacaoFolha',
    detalhes: { postos: gravados.length, lotacoes: lotacoesGravadas },
  });
  return { postos: gravados.length, lotacoes: lotacoesGravadas };
}
