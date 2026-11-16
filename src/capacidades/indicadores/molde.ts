/**
 * Molde dos indicadores da plataforma (ADR-025): tipos e regras puras.
 * Não lê planilha nem conhece app: cada módulo calcula os seus e devolve neste formato.
 */

export type FormatoIndicador = 'numero' | 'pct' | 'dias' | 'moeda';
/** "mais": quanto mais, melhor; "menos": quanto menos, melhor; "neutro": sem julgamento. */
export type SentidoIndicador = 'mais' | 'menos' | 'neutro';
export type PeriodicidadeIndicador = 'mes' | 'ano';

export interface DefinicaoDeIndicador {
  /** Um dos nomes de `manifesto.indicadores` do módulo. */
  id: string;
  nome: string;
  explicacao: string;
  formato: FormatoIndicador;
  sentido: SentidoIndicador;
  periodicidade: PeriodicidadeIndicador;
  /** Só onde o app já tem uma referência; o painel não inventa meta. */
  referencia?: number;
}

export interface PontoDeIndicador {
  /** 'AAAA-MM' (por mês) ou 'AAAA' (por ano). */
  periodo: string;
  /** null = sem dado no período (a tela escreve "Sem dados", nunca 0). */
  valor: number | null;
  /** De onde veio o número, ex.: "12 de 15". */
  base?: string;
  /** Período ainda em andamento: aparece como "até hoje" e não entra na comparação. */
  parcial?: boolean;
}

export interface IndicadorCalculado {
  definicao: DefinicaoDeIndicador;
  pontos: PontoDeIndicador[];
}

export type Situacao = 'dentro' | 'fora' | 'sem_referencia' | 'sem_dados';

/** Dentro ou fora da referência; sem referência (ou sentido neutro) nunca é "bom" nem "ruim". */
export function situacaoDe(d: DefinicaoDeIndicador, valor: number | null): Situacao {
  if (valor === null) return 'sem_dados';
  if (d.referencia === undefined || d.sentido === 'neutro') return 'sem_referencia';
  const bom = d.sentido === 'mais' ? valor >= d.referencia : valor <= d.referencia;
  return bom ? 'dentro' : 'fora';
}

export const TEXTO_DA_SITUACAO: Record<Situacao, string> = {
  dentro: 'Dentro da referência',
  fora: 'Fora da referência',
  sem_referencia: 'Sem referência definida',
  sem_dados: 'Sem dados',
};

/** Último ponto fechado com valor e o anterior a ele (o ponto parcial fica de fora da comparação). */
export function ultimoEAnterior(pontos: readonly PontoDeIndicador[]): { atual: PontoDeIndicador | null; anterior: PontoDeIndicador | null } {
  const fechados = pontos.filter((p) => !p.parcial && p.valor !== null);
  return { atual: fechados.at(-1) ?? null, anterior: fechados.length > 1 ? fechados.at(-2)! : null };
}

/** Formata para leitura em português; null vira "Sem dados". */
export function formatarIndicador(formato: FormatoIndicador, valor: number | null): string {
  if (valor === null) return 'Sem dados';
  const n = (v: number, max = 1) => v.toLocaleString('pt-BR', { maximumFractionDigits: max });
  switch (formato) {
    case 'pct':
      return `${n(valor)}%`;
    case 'dias':
      return `${n(valor)} ${valor === 1 ? 'dia útil' : 'dias úteis'}`;
    case 'moeda':
      return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
    default:
      return n(valor, 0);
  }
}

/** Confere que todo id devolvido existe no manifesto e que nenhum id esperado ficou de fora. */
export function conferirIds(devolvidos: readonly string[], manifesto: readonly string[], esperados: readonly string[]): string[] {
  const erros: string[] = [];
  for (const id of devolvidos) if (!manifesto.includes(id)) erros.push(`"${id}" não está no manifesto.`);
  for (const id of esperados) if (!devolvidos.includes(id)) erros.push(`"${id}" não foi devolvido.`);
  return erros;
}

export const MESES_DO_ANO = (ano: number): string[] => Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, '0')}`);

/** Opções que o painel passa a cada módulo. */
export interface PeriodoDoPainel {
  ano: number;
  /** Relógio injetável nos testes. */
  agora?: Date;
}

/** Mês corrente no horário de Brasília (UTC-3, sem horário de verão), 'AAAA-MM'. */
export function mesAtualEmBrasilia(agora: Date): string {
  return new Date(agora.getTime() - 3 * 3600_000).toISOString().slice(0, 7);
}
