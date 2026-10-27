/**
 * Importação da planilha da folha, em dois passos:
 * 1. analisar: lê o arquivo, compara com o que já está cadastrado e devolve
 *    uma proposta e um relatório. Não grava nada.
 * 2. importar: a pessoa confere o relatório, diz a qual Serviço corresponde
 *    cada nome de lotação que o app não reconheceu, e confirma. A proposta é
 *    validada de novo antes de gravar.
 *
 * Regras: lotação fora de 100% não é gravada (o funcionário entra sem lotação
 * e aparece no atalho "sem lotação"); fichas já cadastradas são ignoradas;
 * nada existente é alterado.
 */
import { z } from 'zod';
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { inserirRegistros, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { Areas, Servicos } from '@/nucleo/estrutura/tabelas';
import { calcularLinha, COMPONENTES, parametrosCom, somaRateio, validarRateio, type LinhaRateio } from '../dominio/folha';
import { lerPlanilhaFolha, normalizar, type AbaImportada, type CelulaImportada } from '../dominio/importacao';
import { Componentes, Parametros, Postos, Rateios } from '../dados/tabelas';
import { ErroValidacaoFolha } from './folha';

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
});

export type PropostaImportacao = z.infer<typeof esquemaProposta>;

export interface RelatorioImportacao {
  abas: { estudo: string | null; rateio: string | null };
  avisos: string[];
  colunasIgnoradas: { aba: string; colunas: string[] }[];
  colunasCalculadas: string[];
  servicos: { reconhecidos: number; aEscolher: number };
  postos: { total: number; vagas: number; comLotacao: number };
  fichasJaCadastradas: string[];
  /** Vagas previstas (sem código) que já existem com a mesma descrição e cargo. */
  vagasJaCadastradas: number;
  lotacoesForaDe100: { ficha: string; colaborador: string | null; soma: number }[];
  semLotacao: { ficha: string | null; colaborador: string | null }[];
  semAdmissao: number;
  diferencasCusto: { ficha: string | null; colaborador: string | null; planilha: number; app: number }[];
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
          const o = v as { result?: unknown; richText?: { text: string }[]; text?: string; error?: string };
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

export async function analisarImportacao(p: Planilhas, quem: Autorizador, abas: AbaImportada[]): Promise<Analise> {
  exigirImportar(quem);
  const leitura = lerPlanilhaFolha(abas);
  if (!leitura.abas.estudo || leitura.postos.length === 0) {
    throw new ErroValidacaoFolha(['Não encontrei funcionários para importar.', ...leitura.avisos].join(' '));
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
  const nomes = new Map<string, string>();
  for (const lista of leitura.rateios.values()) for (const l of lista) nomes.set(normalizar(l.centro), l.centro);
  const mapa = [...nomes.values()]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .map((nome) => ({ nome, servico: servicoPorNome.get(normalizar(nome)) ?? null }));

  const fichasAtivas = new Set(postos.ativos().filter((x) => x.ficha && !x.desligamento).map((x) => x.ficha!));
  const vagasAtivas = new Set(postos.ativos().filter((x) => !x.ficha && !x.desligamento).map((x) => chaveVaga(x.colaborador, x.cargo)));
  const relatorio: RelatorioImportacao = {
    abas: { estudo: leitura.abas.estudo, rateio: leitura.abas.rateio },
    avisos: leitura.avisos,
    colunasIgnoradas: leitura.colunasIgnoradas,
    colunasCalculadas: leitura.colunasCalculadas,
    servicos: { reconhecidos: mapa.filter((m) => m.servico).length, aEscolher: mapa.filter((m) => !m.servico).length },
    postos: { total: 0, vagas: 0, comLotacao: 0 },
    fichasJaCadastradas: [],
    vagasJaCadastradas: 0,
    lotacoesForaDe100: [],
    semLotacao: [],
    semAdmissao: 0,
    diferencasCusto: [],
    custoMensalApp: 0,
    custoMensalPlanilha: null,
  };

  const propostos: PropostaImportacao['postos'] = [];
  const fichasNaLeitura = new Set<string>();
  let somaPlanilha = 0;
  let temTotal = false;
  for (const x of leitura.postos) {
    if (x.ficha && (fichasAtivas.has(x.ficha) || fichasNaLeitura.has(x.ficha))) {
      relatorio.fichasJaCadastradas.push(x.ficha);
      continue;
    }
    if (x.ficha) fichasNaLeitura.add(x.ficha);
    else if (vagasAtivas.has(chaveVaga(x.colaborador, x.cargo))) {
      relatorio.vagasJaCadastradas++;
      continue;
    }
    let lotacao: PropostaImportacao['postos'][number]['lotacao'] = null;
    const lido = x.ficha ? leitura.rateios.get(x.ficha) : undefined;
    if (lido && lido.length) {
      const soma = somaRateio(lido.map((l) => ({ centro: l.centro, percentual: l.percentual })));
      if (soma === 100) lotacao = lido.map((l) => ({ nome: l.centro, percentual: l.percentual }));
      else relatorio.lotacoesForaDe100.push({ ficha: x.ficha!, colaborador: x.colaborador, soma });
    } else relatorio.semLotacao.push({ ficha: x.ficha, colaborador: x.colaborador });
    if (!x.inicio && x.colaborador) relatorio.semAdmissao++;

    const componentes = { ...x.componentes, reajuste: x.reajuste, hora_atividade: x.horaAtividade };
    // Compara com a coluna TOTAL da planilha, que já tem o reajuste aplicado.
    const custo = calcularLinha(componentes, x.cargaHoraria, parametros, 12).total;
    relatorio.custoMensalApp += custo;
    if (x.totalPlanilha !== null) {
      temTotal = true;
      somaPlanilha += x.totalPlanilha;
      if (Math.abs(x.totalPlanilha - custo) > 1) relatorio.diferencasCusto.push({ ficha: x.ficha, colaborador: x.colaborador, planilha: x.totalPlanilha, app: custo });
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

  const nomeArea = new Map(areas.ativos().map((a) => [a.codigo, a.nome]));
  await registrarAuditoria(p, { usuario: quem.email, acao: 'leitura', entidade: 'ImportacaoFolha', detalhes: { postos: propostos.length } });
  return {
    proposta: { ano, servicos: mapa, postos: propostos },
    relatorio,
    opcoes: servicos
      .ativos()
      .map((s) => ({ codigo: s.codigo, nome: s.nome, area: s.area ? (nomeArea.get(s.area) ?? s.area) : 'Sem área' }))
      .sort((a, b) => a.area.localeCompare(b.area, 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR')),
  };
}

const chaveVaga = (descricao: string | null, cargo: string) => `${normalizar(descricao ?? '')}|${normalizar(cargo)}`;

/** Traduz a lotação pelos nomes da planilha para Serviços, somando nomes que caem no mesmo serviço. */
function lotacaoEmServicos(lotacao: { nome: string; percentual: number }[], mapa: Map<string, string>): LinhaRateio[] {
  const porServico = new Map<string, number>();
  for (const l of lotacao) {
    const s = mapa.get(normalizar(l.nome))!;
    porServico.set(s, Math.round(((porServico.get(s) ?? 0) + l.percentual) * 100) / 100);
  }
  return [...porServico].map(([centro, percentual]) => ({ centro, percentual }));
}

export async function importarFolha(p: Planilhas, quem: Autorizador, bruta: unknown): Promise<{ postos: number }> {
  exigirImportar(quem);
  const r = esquemaProposta.safeParse(bruta);
  if (!r.success) throw new ErroValidacaoFolha('A importação veio incompleta. Envie o arquivo de novo.');
  const proposta = r.data;
  const [servicos, postos, componentes, rateios] = await lerTabelas(p, [Servicos, Postos, Componentes, Rateios] as const);

  const existentes = new Set(servicos.ativos().map((s) => s.codigo));
  const faltando = proposta.servicos.filter((m) => !m.servico).map((m) => m.nome);
  if (faltando.length) throw new ErroValidacaoFolha(`Escolha o serviço correspondente a: ${faltando.join(', ')}.`);
  if (proposta.servicos.some((m) => !existentes.has(m.servico!))) throw new ErroValidacaoFolha('Há serviço escolhido que não existe mais. Envie o arquivo de novo.');
  const mapa = new Map(proposta.servicos.map((m) => [normalizar(m.nome), m.servico!]));

  const fichasAtivas = new Set(postos.ativos().filter((x) => x.ficha && !x.desligamento).map((x) => x.ficha!));
  const vagasAtivas = new Set(postos.ativos().filter((x) => !x.ficha && !x.desligamento).map((x) => chaveVaga(x.colaborador, x.cargo)));
  const novos = proposta.postos
    .filter((x) => (x.ficha ? !fichasAtivas.has(x.ficha) : !vagasAtivas.has(chaveVaga(x.colaborador, x.cargo))))
    .map((x) => {
      if (x.lotacao?.some((l) => !mapa.has(normalizar(l.nome)))) throw new ErroValidacaoFolha('Há lotação com nome sem correspondência. Envie o arquivo de novo.');
      const linhas = x.lotacao ? lotacaoEmServicos(x.lotacao, mapa) : null;
      if (linhas && validarRateio(linhas).length) throw new ErroValidacaoFolha('Há lotação inválida na importação. Envie o arquivo de novo.');
      return { ...x, linhas };
    });

  const autoria = { email: quem.email };
  const vigencia = (inicio: string) => (inicio < `${proposta.ano}-01-01` ? `${proposta.ano}-01-01` : inicio);
  const gravados = await inserirRegistros(
    p,
    postos,
    novos.map((x) => ({ ficha: x.ficha, colaborador: x.colaborador, cargo: x.cargo, departamento: x.departamento, carga_horaria: x.cargaHoraria, inicio: x.inicio })),
    autoria,
  );
  await inserirRegistros(
    p,
    componentes,
    gravados.map((g, i) => ({ posto_id: g.id, vigencia: vigencia(g.inicio), ...novos[i].componentes })) as never,
    autoria,
  );
  await inserirRegistros(
    p,
    rateios,
    gravados.flatMap((g, i) => {
      const lote = crypto.randomUUID();
      return (novos[i].linhas ?? []).map((l) => ({ posto_id: g.id, lote, servico: l.centro, percentual: l.percentual, vigencia: vigencia(g.inicio) }));
    }),
    autoria,
  );
  await registrarAuditoria(p, { usuario: quem.email, acao: 'inclusao', entidade: 'ImportacaoFolha', detalhes: { postos: gravados.length } });
  return { postos: gravados.length };
}
