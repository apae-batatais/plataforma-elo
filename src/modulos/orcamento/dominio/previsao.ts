/**
 * Regras puras da previsão (Entrega 1B): valor do item, distribuição nos
 * meses, nomes únicos e indicadores. Nada aqui lê ou grava dados.
 */

export type Distribuicao = 'igual' | 'meses' | 'manual';
export type Captacao = 'garantida' | 'negociacao' | 'a_captar';

export const CAPTACAO: Record<Captacao, string> = {
  garantida: 'Garantida',
  negociacao: 'Em negociação',
  a_captar: 'A captar',
};

export const NATUREZA = { publica: 'Pública', propria: 'Própria' } as const;
export const USO = { livre: 'Livre', restrita: 'Restrita' } as const;

/** Referências dos indicadores (especificação, Indicadores). */
export const REFERENCIAS = {
  folhaSobreReceita: 65,
  dependenciaPublica: 70,
} as const;

const centavos = (v: number) => Math.round(v * 100);
export const arred = (v: number) => Math.round(v * 100) / 100;

/** Valor do item = quantidade × ocorrências × valor unitário (em centavos exatos). */
export function valorDoItem(quantidade: number, ocorrencias: number, valorUnitario: number): number {
  return arred(quantidade * ocorrencias * valorUnitario);
}

export class ErroDistribuicao extends Error {}

/**
 * Distribui o valor nos 12 meses e devolve [jan..dez].
 * - igual: igual nos 12 meses;
 * - meses: igual só nos meses escolhidos (1 a 12);
 * - manual: os valores digitados, que precisam somar o valor.
 * Os centavos que sobram vão para o último mês usado, para a soma fechar.
 */
export function distribuir(valor: number, modo: Distribuicao, opcoes: { meses?: number[]; manual?: (number | null)[] } = {}): number[] {
  if (!Number.isFinite(valor) || valor < 0) throw new ErroDistribuicao('O valor precisa ser zero ou positivo.');
  const total = centavos(valor);
  if (modo === 'manual') {
    const lista = Array.from({ length: 12 }, (_, i) => centavos(Number(opcoes.manual?.[i] ?? 0) || 0));
    if (lista.some((v) => v < 0)) throw new ErroDistribuicao('Os valores dos meses não podem ser negativos.');
    const soma = lista.reduce((s, v) => s + v, 0);
    if (soma !== total) {
      throw new ErroDistribuicao(`Os meses somam ${reaisTexto(soma / 100)}, mas o valor do item é ${reaisTexto(total / 100)}. Ajuste para fechar.`);
    }
    return lista.map((v) => v / 100);
  }
  const usados = modo === 'igual' ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : [...new Set(opcoes.meses ?? [])].filter((m) => m >= 1 && m <= 12).sort((a, b) => a - b);
  if (usados.length === 0) throw new ErroDistribuicao('Escolha pelo menos um mês.');
  const parte = Math.floor(total / usados.length);
  const resto = total - parte * usados.length;
  const r = Array(12).fill(0) as number[];
  usados.forEach((m, i) => (r[m - 1] = (parte + (i === usados.length - 1 ? resto : 0)) / 100));
  return r;
}

/** Meses com valor (para mostrar "Mar, Jul" ou recompor a escolha). */
export const mesesUsados = (meses: number[]) => meses.map((v, i) => (v ? i + 1 : 0)).filter(Boolean);

const reaisTexto = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Nome comparável: sem acento, sem maiúsculas, sem espaços sobrando. */
export const nomeComparavel = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Indicadores da previsão (percentuais de 0 a 100; null quando não há receita). */
export interface Indicadores {
  resultado: number;
  folhaSobreReceita: number | null;
  dependenciaPublica: number | null;
  recursosLivres: number | null;
  receitaGarantida: number | null;
}

export function calcularIndicadores(t: {
  despesa: number;
  receita: number;
  rh: number;
  receitaPublica: number;
  receitaLivre: number;
  receitaGarantida: number;
}): Indicadores {
  const pct = (v: number) => (t.receita > 0 ? Math.round((v / t.receita) * 10000) / 100 : null);
  return {
    resultado: arred(t.receita - t.despesa),
    folhaSobreReceita: pct(t.rh),
    dependenciaPublica: pct(t.receitaPublica),
    recursosLivres: pct(t.receitaLivre),
    receitaGarantida: pct(t.receitaGarantida),
  };
}
