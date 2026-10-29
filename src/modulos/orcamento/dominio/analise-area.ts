/**
 * Análise por área (modelo da aba "Análise por Área" da planilha do orçamento).
 *
 * Para a área escolhida:
 * - A = custo direto de cada centro direto (itens + folha do próprio centro);
 * - B = custo indireto da área (centros de apoio), rateado entre os centros diretos;
 * - C = A + B (custo da área);
 * - D = parte das despesas administrativas (centros do tipo "despesa"):
 *   primeiro a área recebe a fração do seu custo no custo total, depois essa
 *   parte é rateada entre os seus centros diretos;
 * - Total = C + D. Per capita mensal = Total ÷ atendidos ÷ 12; por sessão = Total ÷ sessões.
 *
 * Bases de rateio: custo direto, nº de profissionais (pela lotação),
 * nº de atendidos ou área ocupada (m²). Se a base escolhida for zero em todos
 * os centros, usa o custo direto; se ele também for zero, divide igualmente.
 * Regras puras: nada aqui lê ou grava dados.
 */
import { arred } from './previsao';

export type TipoCentro = 'direto' | 'indireto' | 'despesa';
export type BaseRateio = 'custo' | 'profissionais' | 'atendidos' | 'm2';

export const TIPO_CENTRO: Record<TipoCentro, string> = {
  direto: 'Custo direto',
  indireto: 'Custo indireto (apoio da área)',
  despesa: 'Despesa (administrativo)',
};
export const BASE_RATEIO: Record<BaseRateio, string> = {
  custo: '% do custo direto',
  profissionais: 'Nº de profissionais',
  atendidos: 'Nº de atendidos',
  m2: 'Área ocupada (m²)',
};

export interface CentroAnalise {
  codigo: string;
  nome: string;
  area: string | null;
  tipo: TipoCentro;
  atendidos: number | null;
  sessoes: number | null;
  m2: number | null;
  profissionais: number;
}

export interface CustoLancado {
  servico: string;
  grupo: string;
  valor: number;
}

export interface ReceitaAnalise {
  area: string | null;
  restrita: boolean;
  valor: number;
}

export interface Matriz {
  colunas: { codigo: string; nome: string }[];
  linhas: { grupo: string; valores: number[]; total: number; percentual: number }[];
  totais: number[];
  total: number;
}

export interface RateioCentro {
  codigo: string;
  nome: string;
  peso: number;
  A: number;
  B: number;
  C: number;
  D: number;
  total: number;
  atendidos: number | null;
  sessoes: number | null;
  profissionais: number;
  perCapitaMensal: number | null;
  porSessao: number | null;
}

export interface AnaliseArea {
  area: string;
  base: BaseRateio;
  baseUsada: BaseRateio | 'igual';
  direta: Matriz;
  indireta: Matriz;
  rateio: RateioCentro[];
  /** Custo indireto que não pôde ser rateado (área sem centro direto). */
  indiretoSemRateio: number;
  cards: { receitaRestrita: number; custos: number; despesas: number; gastos: number; resultado: number };
  totais: { custoGeral: number; despesaGeral: number; orcamento: number; percentualCustoArea: number; percentualOrcamento: number };
  despesasAdministrativas: Matriz;
}

function montarMatriz(centros: CentroAnalise[], custos: CustoLancado[], ordemGrupos: string[]): Matriz {
  const idx = new Map(centros.map((c, i) => [c.codigo, i]));
  const porGrupo = new Map<string, number[]>();
  for (const c of custos) {
    const i = idx.get(c.servico);
    if (i === undefined) continue;
    const l = porGrupo.get(c.grupo) ?? centros.map(() => 0);
    l[i] += c.valor;
    porGrupo.set(c.grupo, l);
  }
  const grupos = [...ordemGrupos.filter((g) => porGrupo.has(g)), ...[...porGrupo.keys()].filter((g) => !ordemGrupos.includes(g)).sort()];
  const totais = centros.map((_, i) => arred(grupos.reduce((s, g) => s + porGrupo.get(g)![i], 0)));
  const total = arred(totais.reduce((s, v) => s + v, 0));
  return {
    colunas: centros.map((c) => ({ codigo: c.codigo, nome: c.nome })),
    linhas: grupos.map((g) => {
      const valores = porGrupo.get(g)!.map(arred);
      const t = arred(valores.reduce((s, v) => s + v, 0));
      return { grupo: g, valores, total: t, percentual: total > 0 ? t / total : 0 };
    }),
    totais,
    total,
  };
}

/** Pesos do rateio entre os centros diretos, com a base usada de fato. */
export function pesosDeRateio(centros: CentroAnalise[], custoDireto: number[], base: BaseRateio): { pesos: number[]; usada: BaseRateio | 'igual' } {
  const valores: Record<BaseRateio, number[]> = {
    custo: custoDireto,
    profissionais: centros.map((c) => c.profissionais),
    atendidos: centros.map((c) => c.atendidos ?? 0),
    m2: centros.map((c) => c.m2 ?? 0),
  };
  const normalizar = (l: number[]) => {
    const s = l.reduce((a, b) => a + Math.max(b, 0), 0);
    return s > 0 ? l.map((v) => Math.max(v, 0) / s) : null;
  };
  const escolhida = normalizar(valores[base]);
  if (escolhida) return { pesos: escolhida, usada: base };
  const custo = normalizar(custoDireto);
  if (custo) return { pesos: custo, usada: 'custo' };
  return { pesos: centros.map(() => (centros.length ? 1 / centros.length : 0)), usada: 'igual' };
}

/** Distribui um valor pelos pesos, com os centavos fechando no último. */
function distribuirPorPeso(valor: number, pesos: number[]): number[] {
  if (pesos.length === 0) return [];
  const partes = pesos.map((p) => arred(valor * p));
  const dif = arred(valor - partes.reduce((s, v) => s + v, 0));
  const maior = pesos.indexOf(Math.max(...pesos));
  partes[maior] = arred(partes[maior] + dif);
  return partes;
}

export function analisarArea(dados: {
  area: string;
  base: BaseRateio;
  centros: CentroAnalise[];
  custos: CustoLancado[];
  receitas: ReceitaAnalise[];
  ordemGrupos?: string[];
}): AnaliseArea {
  const { area, base, centros, custos } = dados;
  const ordem = dados.ordemGrupos ?? [];
  const tipo = new Map(centros.map((c) => [c.codigo, c]));
  const soma = (f: (c: CustoLancado) => boolean) => arred(custos.filter(f).reduce((s, c) => s + c.valor, 0));
  const tipoDe = (servico: string): TipoCentro => tipo.get(servico)?.tipo ?? 'direto';

  const custoGeral = soma((c) => tipoDe(c.servico) !== 'despesa');
  const despesaGeral = soma((c) => tipoDe(c.servico) === 'despesa');

  const diretos = centros.filter((c) => c.area === area && c.tipo === 'direto');
  const indiretos = centros.filter((c) => c.area === area && c.tipo === 'indireto');
  const direta = montarMatriz(diretos, custos, ordem);
  const indireta = montarMatriz(indiretos, custos, ordem);

  const custoArea = arred(direta.total + indireta.total);
  const despesaArea = custoGeral > 0 ? arred((despesaGeral * custoArea) / custoGeral) : 0;
  const { pesos, usada } = pesosDeRateio(diretos, direta.totais, base);
  const B = distribuirPorPeso(indireta.total, pesos);
  const D = distribuirPorPeso(despesaArea, pesos);

  const rateio: RateioCentro[] = diretos.map((c, i) => {
    const A = direta.totais[i];
    const C = arred(A + (B[i] ?? 0));
    const total = arred(C + (D[i] ?? 0));
    return {
      codigo: c.codigo,
      nome: c.nome,
      peso: pesos[i] ?? 0,
      A,
      B: B[i] ?? 0,
      C,
      D: D[i] ?? 0,
      total,
      atendidos: c.atendidos,
      sessoes: c.sessoes,
      profissionais: c.profissionais,
      perCapitaMensal: c.atendidos ? arred(total / c.atendidos / 12) : null,
      porSessao: c.sessoes ? arred(total / c.sessoes) : null,
    };
  });

  const receitaRestrita = arred(dados.receitas.filter((r) => r.area === area && r.restrita).reduce((s, r) => s + r.valor, 0));
  const gastos = arred(custoArea + despesaArea);
  const orcamento = arred(custoGeral + despesaGeral);

  return {
    area,
    base,
    baseUsada: usada,
    direta,
    indireta,
    rateio,
    indiretoSemRateio: diretos.length === 0 ? indireta.total : 0,
    cards: { receitaRestrita, custos: custoArea, despesas: despesaArea, gastos, resultado: arred(receitaRestrita - gastos) },
    totais: {
      custoGeral,
      despesaGeral,
      orcamento,
      percentualCustoArea: custoGeral > 0 ? custoArea / custoGeral : 0,
      percentualOrcamento: orcamento > 0 ? gastos / orcamento : 0,
    },
    despesasAdministrativas: montarMatriz(
      centros.filter((c) => c.tipo === 'despesa'),
      custos,
      ordem,
    ),
  };
}
