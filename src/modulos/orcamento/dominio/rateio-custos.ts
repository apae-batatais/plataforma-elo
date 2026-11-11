/**
 * Regras de rateio dos custos comuns (entrega R1, proposta #91).
 *
 * Uma regra diz quem participa (áreas ou serviços) e por qual base o valor se divide.
 * Ordem de cálculo, sem ciclo: custos comuns → serviços de apoio → administrativo.
 * Regras puras: nada aqui lê ou grava dados.
 */
import { arred } from './previsao';

export type BaseFixa = 'igual' | 'm2' | 'profissionais' | 'atendidos' | 'vagas' | 'custo';
/** Base fixa ou base própria da OSC ("propria:<id>"). */
export type BaseRegra = BaseFixa | `propria:${string}`;

export const BASES_FIXAS: Record<BaseFixa, string> = {
  igual: 'Partes iguais',
  m2: 'Área ocupada (m²)',
  profissionais: 'Nº de profissionais',
  atendidos: 'Nº de atendidos',
  vagas: 'Nº de vagas',
  custo: '% do custo direto',
};

export type TipoParticipante = 'area' | 'servico';
export type TipoCentroRateio = 'direto' | 'indireto' | 'despesa';
export type OrigemRateio = 'comum' | 'apoio' | 'administrativo';
export const ORIGEM_RATEIO: Record<OrigemRateio, string> = { comum: 'Custo comum', apoio: 'Serviço de apoio', administrativo: 'Administrativo' };

export interface RegraRateio {
  id: string;
  nome: string;
  base1: BaseRegra;
  /** Segundo nível (dentro de cada área); vazio repete o primeiro. */
  base2: BaseRegra | null;
  tipo: TipoParticipante;
  /** Códigos das áreas ou dos serviços. */
  participantes: string[];
}

export interface CentroRateio {
  codigo: string;
  area: string | null;
  tipo: TipoCentroRateio;
  atendidos: number | null;
  vagas: number | null;
  m2: number | null;
  profissionais: number;
  /** Regra própria do serviço (apoio e administrativo). */
  regraId: string | null;
}

export interface CustoParaRatear {
  servico: string;
  grupo: string;
  valor: number;
  /** Regra do item (vence a do grupo). */
  regraItem?: string | null;
  regraGrupo?: string | null;
}

export interface CustoRateado {
  /** Serviço onde o valor caiu no fim (direto, ou apoio/administrativo quando a regra os inclui). */
  servico: string;
  grupo: string;
  valor: number;
  /** Serviço onde o custo foi lançado. */
  de: string;
  regraId: string;
  regraNome: string;
  origem: OrigemRateio;
}

export interface ResultadoRateio {
  /** Custos sem regra, que seguem como lançados (a base do painel cuida deles). */
  mantidos: CustoParaRatear[];
  rateados: CustoRateado[];
  /** Avisos para o Financeiro (regra apagada, participante inexistente…). */
  avisos: string[];
}

export class ErroRegra extends Error {}

/** Valida uma regra antes de gravar (regra 2 e 3 da especificação). */
export function conferirRegra(
  regra: { tipo: TipoParticipante; participantes: string[] },
  centros: { codigo: string; area: string | null; tipo: TipoCentroRateio }[],
  uso?: { apoio?: boolean; administrativo?: boolean },
): void {
  if (regra.participantes.length === 0) throw new ErroRegra('Escolha ao menos um participante.');
  if (new Set(regra.participantes).size !== regra.participantes.length) throw new ErroRegra('Um participante aparece mais de uma vez.');
  if (regra.tipo === 'area') {
    const areas = new Set(centros.filter((c) => c.tipo === 'direto' && c.area).map((c) => c.area!));
    const sem = regra.participantes.filter((a) => !areas.has(a));
    if (sem.length) throw new ErroRegra('Uma das áreas não tem serviço de custo direto, então não recebe rateio.');
    if (uso?.apoio) throw new ErroRegra('A regra de um serviço de apoio só pode ter serviços de custo direto como participantes.');
  } else {
    const ok = new Map(centros.map((c) => [c.codigo, c]));
    for (const s of regra.participantes) {
      const c = ok.get(s);
      if (!c) throw new ErroRegra('Um dos serviços escolhidos não existe.');
      if ((uso?.apoio || uso?.administrativo) && c.tipo !== 'direto') {
        throw new ErroRegra('A regra de apoio ou do administrativo só pode ter serviços de custo direto como participantes.');
      }
    }
  }
}

function normalizar(l: number[]): number[] | null {
  const s = l.reduce((a, b) => a + Math.max(b, 0), 0);
  return s > 0 ? l.map((v) => Math.max(v, 0) / s) : null;
}

/** Divide um valor pelos pesos; a soma é exatamente o valor (centavos no maior participante). */
export function distribuirPorPeso(valor: number, pesos: number[]): number[] {
  if (pesos.length === 0) return [];
  const partes = pesos.map((p) => arred(valor * p));
  const dif = arred(valor - partes.reduce((s, v) => s + v, 0));
  const maior = pesos.indexOf(Math.max(...pesos));
  partes[maior] = arred(partes[maior] + dif);
  return partes;
}

export interface ContextoBases {
  centros: CentroRateio[];
  /** Custo direto por serviço (lançamentos próprios, incluindo a folha). */
  custoDireto: Map<string, number>;
  /** Base própria: id → serviço → valor. */
  basesProprias: Map<string, Map<string, number>>;
}

function valorBase(base: BaseRegra, c: CentroRateio, ctx: ContextoBases): number {
  switch (base) {
    case 'igual': return 1;
    case 'm2': return c.m2 ?? 0;
    case 'profissionais': return c.profissionais;
    case 'atendidos': return c.atendidos ?? 0;
    case 'vagas': return c.vagas ?? 0;
    case 'custo': return ctx.custoDireto.get(c.codigo) ?? 0;
    default: return ctx.basesProprias.get(base.slice('propria:'.length))?.get(c.codigo) ?? 0;
  }
}

/** Pesos de um grupo de serviços por uma base, com a queda para custo direto e depois partes iguais (regra 6). */
export function pesosDoGrupo(base: BaseRegra, servicos: CentroRateio[], ctx: ContextoBases): { pesos: number[]; usada: BaseRegra } {
  const escolhida = normalizar(servicos.map((c) => valorBase(base, c, ctx)));
  if (escolhida) return { pesos: escolhida, usada: base };
  const custo = normalizar(servicos.map((c) => valorBase('custo', c, ctx)));
  if (custo) return { pesos: custo, usada: 'custo' };
  return { pesos: servicos.map(() => 1 / servicos.length), usada: 'igual' };
}

/** Divide `valor` entre os participantes da regra e devolve quanto cai em cada serviço. */
export function ratearPelaRegra(valor: number, regra: RegraRateio, ctx: ContextoBases, alvos: (c: CentroRateio) => boolean): Map<string, number> {
  const saida = new Map<string, number>();
  const somar = (servico: string, v: number) => saida.set(servico, arred((saida.get(servico) ?? 0) + v));
  if (regra.tipo === 'servico') {
    const servicos = regra.participantes.map((s) => ctx.centros.find((c) => c.codigo === s)).filter((c): c is CentroRateio => Boolean(c));
    const { pesos } = pesosDoGrupo(regra.base1, servicos, ctx);
    distribuirPorPeso(valor, pesos).forEach((v, i) => somar(servicos[i].codigo, v));
    return saida;
  }
  // Dois níveis: entre as áreas (base 1) e, dentro de cada área, entre os serviços diretos (base 2).
  const base2 = regra.base2 ?? regra.base1;
  const areas = regra.participantes
    .map((a) => ({ area: a, servicos: ctx.centros.filter((c) => c.area === a && c.tipo === 'direto' && alvos(c)) }))
    .filter((a) => a.servicos.length > 0);
  const pesoArea = areas.map((a) => {
    if (regra.base1 === 'igual') return 1;
    return a.servicos.reduce((s, c) => s + Math.max(valorBase(regra.base1, c, ctx), 0), 0);
  });
  let pesosAreas = normalizar(pesoArea);
  if (!pesosAreas) {
    const custo = areas.map((a) => a.servicos.reduce((s, c) => s + valorBase('custo', c, ctx), 0));
    pesosAreas = normalizar(custo) ?? areas.map(() => 1 / areas.length);
  }
  const porArea = distribuirPorPeso(valor, pesosAreas);
  areas.forEach((a, i) => {
    const { pesos } = pesosDoGrupo(base2, a.servicos, ctx);
    distribuirPorPeso(porArea[i], pesos).forEach((v, j) => somar(a.servicos[j].codigo, v));
  });
  return saida;
}

/**
 * Aplica as regras aos custos lançados.
 * 1. Custos com regra do item ou do grupo (comuns), em qualquer serviço.
 * 2. O que cada serviço de apoio acumulou, se ele tem regra própria.
 * 3. O que o administrativo acumulou, se ele tem regra própria.
 * Custos sem regra ficam como estão. A soma de tudo não muda (regra 9).
 */
export function aplicarRegras(dados: {
  centros: CentroRateio[];
  regras: RegraRateio[];
  custos: CustoParaRatear[];
  basesProprias?: Map<string, Map<string, number>>;
}): ResultadoRateio {
  const regras = new Map(dados.regras.map((r) => [r.id, r]));
  const centro = new Map(dados.centros.map((c) => [c.codigo, c]));
  const avisos: string[] = [];
  const custoDireto = new Map<string, number>();
  for (const c of dados.custos) custoDireto.set(c.servico, arred((custoDireto.get(c.servico) ?? 0) + c.valor));
  const ctx: ContextoBases = { centros: dados.centros, custoDireto, basesProprias: dados.basesProprias ?? new Map() };

  interface Linha { servico: string; grupo: string; valor: number; de: string; regraId?: string; regraNome?: string; origem?: OrigemRateio }
  const diretos = () => true;
  const dividir = (l: Linha, regra: RegraRateio, origem: OrigemRateio): Linha[] => {
    const partes = ratearPelaRegra(l.valor, regra, ctx, diretos);
    if (partes.size === 0) {
      avisos.push(`A regra "${regra.nome}" não tem serviço para receber o rateio; o valor ficou onde foi lançado.`);
      return [l];
    }
    const nome = l.regraNome ? `${l.regraNome} → ${regra.nome}` : regra.nome;
    return [...partes].map(([servico, valor]) => ({ servico, grupo: l.grupo, valor, de: l.de, regraId: regra.id, regraNome: nome, origem }));
  };

  // 1) comuns: regra do item > regra do grupo
  let linhas: Linha[] = dados.custos.flatMap((c) => {
    const base: Linha = { servico: c.servico, grupo: c.grupo, valor: c.valor, de: c.servico };
    const id = c.regraItem || c.regraGrupo || null;
    const regra = id ? regras.get(id) : undefined;
    if (id && !regra) avisos.push('Um item ou grupo usa uma regra de rateio que não existe mais; o custo foi tratado sem regra.');
    return regra ? dividir(base, regra, 'comum') : [base];
  });

  // 2) apoio e 3) administrativo: o que o serviço acumulou (lançado + recebido dos comuns)
  for (const etapa of ['indireto', 'despesa'] as const) {
    const origem: OrigemRateio = etapa === 'indireto' ? 'apoio' : 'administrativo';
    for (const c of dados.centros.filter((x) => x.tipo === etapa)) {
      const regra = c.regraId ? regras.get(c.regraId) : undefined;
      if (!regra) continue;
      linhas = linhas.flatMap((l) => (l.servico === c.codigo ? dividir(l, regra, origem) : [l]));
    }
  }

  const rateados: CustoRateado[] = [];
  const mantidos: CustoParaRatear[] = [];
  for (const l of linhas) {
    if (l.regraId && centro.get(l.servico)?.tipo === 'direto') {
      rateados.push({ servico: l.servico, grupo: l.grupo, valor: l.valor, de: l.de, regraId: l.regraId, regraNome: l.regraNome!, origem: l.origem! });
    } else mantidos.push({ servico: l.servico, grupo: l.grupo, valor: l.valor });
  }
  return { mantidos, rateados, avisos: [...new Set(avisos)] };
}

/** Total de uma lista de custos, em centavos exatos. */
export const somaCustos = (l: { valor: number }[]) => arred(l.reduce((s, c) => s + c.valor, 0));
