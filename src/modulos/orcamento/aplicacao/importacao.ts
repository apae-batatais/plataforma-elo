/**
 * Importação da planilha da folha, em dois passos:
 * 1. analisar: lê o arquivo, compara com o que já está cadastrado e devolve
 *    uma proposta e um relatório. Não grava nada.
 * 2. importar: a pessoa confere o relatório (e escolhe a área dos centros de
 *    custo novos) e confirma. A proposta é validada de novo antes de gravar.
 *
 * Regras: rateio fora de 100% não é gravado (o posto entra sem rateio e
 * aparece no atalho "sem rateio"); fichas já cadastradas são ignoradas;
 * nada existente é alterado.
 */
import { z } from 'zod';
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { inserirRegistros, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { Areas } from '@/nucleo/estrutura/tabelas';
import { COMPONENTES, custoMensal, parametrosCom, somaRateio, validarRateio } from '../dominio/folha';
import { codigoDe, lerPlanilhaFolha, normalizar, type AbaImportada, type CelulaImportada } from '../dominio/importacao';
import { Cargos, CentrosCusto, Componentes, NIVEIS, Parametros, Postos, Rateios, TabelaSalarial } from '../dados/tabelas';
import { ErroValidacaoFolha } from './folha';

function exigirImportar(quem: Autorizador) {
  if (!quem.temPermissao('orcamento.folha.editar') || !quem.temPermissao('orcamento.folha.ver_individual')) throw new ErroPermissao();
}

// ---------------------------------------------------------------------------
// Proposta (vai para a tela e volta na confirmação)
// ---------------------------------------------------------------------------

const esquemaProposta = z.object({
  ano: z.number().int(),
  centrosNovos: z.array(z.object({ codigo: z.string(), nome: z.string(), area: z.string().nullable() })),
  cargosNovos: z.array(z.object({ codigo: z.string(), nome: z.string(), grupo: z.string().nullable(), requisitos: z.string().nullable(), classe: z.string().nullable(), cargaReferencia: z.number().nullable() })),
  valoresTabela: z.array(z.object({ cargo: z.string(), nivel: z.enum(NIVEIS), valor: z.number().positive() })),
  postos: z.array(
    z.object({
      ficha: z.string().nullable(),
      colaborador: z.string().nullable(),
      cargo: z.string(),
      nivel: z.enum(NIVEIS).nullable(),
      cargaHoraria: z.number().nullable(),
      inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      componentes: z.object(Object.fromEntries(COMPONENTES.map((c) => [c.chave, z.number().min(0)]))),
      rateio: z.array(z.object({ centro: z.string(), percentual: z.number() })).nullable(),
    }),
  ),
});

export type PropostaImportacao = z.infer<typeof esquemaProposta>;

export interface RelatorioImportacao {
  abas: { tabela: string | null; estudo: string | null; rateio: string | null };
  avisos: string[];
  colunasIgnoradas: { aba: string; colunas: string[] }[];
  colunasCalculadas: string[];
  cargos: { novos: number; existentes: number; valores: number };
  centrosNovos: number;
  postos: { total: number; vagas: number; comRateio: number };
  fichasJaCadastradas: string[];
  rateiosForaDe100: { ficha: string; colaborador: string | null; soma: number }[];
  postosSemRateio: { ficha: string | null; colaborador: string | null }[];
  semAdmissao: number;
  diferencasCusto: { ficha: string | null; colaborador: string | null; planilha: number; app: number }[];
  custoMensalApp: number;
  custoMensalPlanilha: number | null;
}

export interface Analise {
  proposta: PropostaImportacao;
  relatorio: RelatorioImportacao;
  areas: { codigo: string; nome: string }[];
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
    throw new ErroValidacaoFolha(
      ['Não encontrei postos para importar.', ...leitura.avisos].join(' '),
    );
  }
  const [centros, cargos, tabela, postos, parametrosLidos, areas] = await lerTabelas(p, [CentrosCusto, Cargos, TabelaSalarial, Postos, Parametros, Areas] as const);
  const parametros = parametrosCom(Object.fromEntries(parametrosLidos.ativos().map((x) => [x.chave, x.valor])));
  const ano = parametros.ano;

  // Cargos: casados pelo nome; os que faltam são criados.
  const codigosCargo = new Set(cargos.todos().map((c) => c.codigo));
  const cargoPorNome = new Map(cargos.ativos().map((c) => [normalizar(c.nome), c.codigo]));
  const cargosNovos: PropostaImportacao['cargosNovos'] = [];
  const garantirCargo = (nome: string, extra?: Partial<PropostaImportacao['cargosNovos'][number]>) => {
    const chave = normalizar(nome);
    let codigo = cargoPorNome.get(chave);
    if (!codigo) {
      codigo = codigoDe(nome, codigosCargo);
      cargoPorNome.set(chave, codigo);
      cargosNovos.push({ codigo, nome, grupo: null, requisitos: null, classe: null, cargaReferencia: null, ...extra });
    }
    return codigo;
  };
  const valoresTabela: PropostaImportacao['valoresTabela'] = [];
  let cargosExistentes = 0;
  const vigentes = new Map<string, number>();
  for (const t of tabela.ativos()) vigentes.set(`${t.cargo}|${t.nivel}`, t.valor);
  for (const c of leitura.cargos) {
    if (cargoPorNome.has(normalizar(c.nome))) cargosExistentes++;
    const codigo = garantirCargo(c.nome, { grupo: c.grupo, requisitos: c.requisitos, classe: c.classe, cargaReferencia: c.cargaReferencia });
    for (const [nivel, valor] of Object.entries(c.valores)) {
      if (vigentes.get(`${codigo}|${nivel}`) !== valor) valoresTabela.push({ cargo: codigo, nivel: nivel as (typeof NIVEIS)[number], valor: valor! });
    }
  }

  // Centros de custo: casados pelo nome (ou código); os que faltam são criados.
  const codigosCentro = new Set(centros.todos().map((c) => c.codigo));
  const centroPorNome = new Map<string, string>();
  for (const c of centros.ativos()) {
    centroPorNome.set(normalizar(c.nome), c.codigo);
    centroPorNome.set(normalizar(c.codigo), c.codigo);
  }
  const centrosNovos: PropostaImportacao['centrosNovos'] = [];
  const garantirCentro = (nome: string) => {
    const chave = normalizar(nome);
    let codigo = centroPorNome.get(chave);
    if (!codigo) {
      codigo = codigoDe(nome, codigosCentro);
      centroPorNome.set(chave, codigo);
      centrosNovos.push({ codigo, nome, area: null });
    }
    return codigo;
  };

  const fichasAtivas = new Set(postos.ativos().filter((x) => x.ficha && !x.desligamento).map((x) => x.ficha!));
  const relatorio: RelatorioImportacao = {
    abas: leitura.abas,
    avisos: leitura.avisos,
    colunasIgnoradas: leitura.colunasIgnoradas,
    colunasCalculadas: leitura.colunasCalculadas,
    cargos: { novos: 0, existentes: cargosExistentes, valores: 0 },
    centrosNovos: 0,
    postos: { total: 0, vagas: 0, comRateio: 0 },
    fichasJaCadastradas: [],
    rateiosForaDe100: [],
    postosSemRateio: [],
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
    const cargo = garantirCargo(x.cargo);
    let rateio: PropostaImportacao['postos'][number]['rateio'] = null;
    const lido = x.ficha ? leitura.rateios.get(x.ficha) : undefined;
    if (lido && lido.length) {
      const linhas = lido.map((l) => ({ centro: garantirCentro(l.centro), percentual: l.percentual }));
      if (validarRateio(linhas).length === 0) rateio = linhas;
      else relatorio.rateiosForaDe100.push({ ficha: x.ficha!, colaborador: x.colaborador, soma: somaRateio(linhas) });
    } else relatorio.postosSemRateio.push({ ficha: x.ficha, colaborador: x.colaborador });
    if (!x.inicio && x.colaborador) relatorio.semAdmissao++;

    const custo = custoMensal(x.componentes, parametros, 1).total;
    relatorio.custoMensalApp += custo;
    if (x.totalPlanilha !== null) {
      temTotal = true;
      somaPlanilha += x.totalPlanilha;
      if (Math.abs(x.totalPlanilha - custo) > 1) relatorio.diferencasCusto.push({ ficha: x.ficha, colaborador: x.colaborador, planilha: x.totalPlanilha, app: custo });
    }
    propostos.push({
      ficha: x.ficha,
      colaborador: x.colaborador,
      cargo,
      nivel: x.nivel as (typeof NIVEIS)[number] | null,
      cargaHoraria: x.cargaHoraria,
      inicio: x.inicio ?? `${ano}-01-01`,
      componentes: x.componentes,
      rateio,
    });
  }

  relatorio.cargos.novos = cargosNovos.length;
  relatorio.cargos.valores = valoresTabela.length;
  relatorio.centrosNovos = centrosNovos.length;
  relatorio.postos = {
    total: propostos.length,
    vagas: propostos.filter((x) => !x.colaborador).length,
    comRateio: propostos.filter((x) => x.rateio).length,
  };
  relatorio.custoMensalApp = Math.round(relatorio.custoMensalApp * 100) / 100;
  relatorio.custoMensalPlanilha = temTotal ? Math.round(somaPlanilha * 100) / 100 : null;

  await registrarAuditoria(p, { usuario: quem.email, acao: 'leitura', entidade: 'ImportacaoFolha', detalhes: { postos: propostos.length } });
  return {
    proposta: { ano, centrosNovos, cargosNovos, valoresTabela, postos: propostos },
    relatorio,
    areas: areas.ativos().map((a) => ({ codigo: a.codigo, nome: a.nome })),
  };
}

export async function importarFolha(p: Planilhas, quem: Autorizador, bruta: unknown): Promise<{ postos: number }> {
  exigirImportar(quem);
  const r = esquemaProposta.safeParse(bruta);
  if (!r.success) throw new ErroValidacaoFolha('A importação veio incompleta. Envie o arquivo de novo.');
  const proposta = r.data;
  const [centros, cargos, tabela, postos, componentes, rateios, areas] = await lerTabelas(p, [
    CentrosCusto, Cargos, TabelaSalarial, Postos, Componentes, Rateios, Areas,
  ] as const);

  // Confere de novo contra o que existe agora.
  const codigosArea = new Set(areas.ativos().map((a) => a.codigo));
  for (const c of proposta.centrosNovos) {
    if (centros.todos().some((x) => x.codigo === c.codigo)) throw new ErroValidacaoFolha('Os cadastros mudaram desde a análise. Envie o arquivo de novo.');
    if (!c.area || !codigosArea.has(c.area)) throw new ErroValidacaoFolha(`Escolha a área do centro de custo "${c.nome}".`);
  }
  if (proposta.cargosNovos.some((c) => cargos.todos().some((x) => x.codigo === c.codigo))) {
    throw new ErroValidacaoFolha('Os cadastros mudaram desde a análise. Envie o arquivo de novo.');
  }
  const codigosCargo = new Set([...cargos.ativos().map((c) => c.codigo), ...proposta.cargosNovos.map((c) => c.codigo)]);
  const codigosCentro = new Set([...centros.ativos().map((c) => c.codigo), ...proposta.centrosNovos.map((c) => c.codigo)]);
  const fichasAtivas = new Set(postos.ativos().filter((x) => x.ficha && !x.desligamento).map((x) => x.ficha!));
  const novosPostos = proposta.postos.filter((x) => !(x.ficha && fichasAtivas.has(x.ficha)));
  for (const x of novosPostos) {
    if (!codigosCargo.has(x.cargo)) throw new ErroValidacaoFolha('Há posto com cargo desconhecido. Envie o arquivo de novo.');
    if (x.rateio && (validarRateio(x.rateio).length || x.rateio.some((l) => !codigosCentro.has(l.centro)))) {
      throw new ErroValidacaoFolha('Há rateio inválido na importação. Envie o arquivo de novo.');
    }
  }

  const autoria = { email: quem.email };
  const vigencia = (inicio: string) => (inicio < `${proposta.ano}-01-01` ? `${proposta.ano}-01-01` : inicio);
  await inserirRegistros(p, centros, proposta.centrosNovos, autoria);
  await inserirRegistros(
    p,
    cargos,
    proposta.cargosNovos.map((c) => ({ codigo: c.codigo, nome: c.nome, grupo: c.grupo, requisitos: c.requisitos, classe: c.classe, carga_horaria_referencia: c.cargaReferencia })),
    autoria,
  );
  await inserirRegistros(p, tabela, proposta.valoresTabela.map((v) => ({ ...v, vigencia: `${proposta.ano}-01-01` })), autoria);
  const gravados = await inserirRegistros(
    p,
    postos,
    novosPostos.map((x) => ({ ficha: x.ficha, colaborador: x.colaborador, cargo: x.cargo, nivel: x.nivel, carga_horaria: x.cargaHoraria, inicio: x.inicio })),
    autoria,
  );
  await inserirRegistros(
    p,
    componentes,
    gravados.map((g, i) => ({ posto_id: g.id, vigencia: vigencia(g.inicio), ...novosPostos[i].componentes, fora_da_tabela: false })) as never,
    autoria,
  );
  await inserirRegistros(
    p,
    rateios,
    gravados.flatMap((g, i) => {
      const lote = crypto.randomUUID();
      return (novosPostos[i].rateio ?? []).map((l) => ({ posto_id: g.id, lote, centro_custo: l.centro, percentual: l.percentual, vigencia: vigencia(g.inicio) }));
    }),
    autoria,
  );
  await registrarAuditoria(p, {
    usuario: quem.email,
    acao: 'inclusao',
    entidade: 'ImportacaoFolha',
    detalhes: { postos: gravados.length, cargos: proposta.cargosNovos.length, centros: proposta.centrosNovos.length },
  });
  return { postos: gravados.length };
}
