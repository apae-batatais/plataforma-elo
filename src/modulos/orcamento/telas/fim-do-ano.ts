/**
 * Prepara as séries do gráfico "Fim do ano". O gráfico de linhas do Elo não tem buraco: mês sem saldo
 * nunca vira zero, então só entram os meses em que o ano em andamento tem saldo, e só as séries que têm
 * saldo em todos esses meses. As demais ficam de fora do gráfico e são listadas em texto.
 */
import type { SerieDeAno } from '../aplicacao/fim-do-ano';
import { MESES } from './formato';

export interface GraficoFimDoAno {
  categorias: string[];
  series: { nome: string; valores: number[]; cor: 'ano-1' | 'ano-2' | 'ano-3' }[];
  /** Anos sem saldo nesses meses (ficam fora do gráfico). */
  foraDoGrafico: number[];
}

const COR = ['ano-3', 'ano-2', 'ano-1'] as const;

export function prepararGrafico(series: SerieDeAno[]): GraficoFimDoAno {
  const temDado = (s: SerieDeAno, i: number) => s.valores[i] !== null;
  let meses = series[0].valores.map((_, i) => i).filter((i) => temDado(series[0], i));
  if (meses.length === 0) meses = series[0].valores.map((_, i) => i).filter((i) => series.some((s) => temDado(s, i)));
  const dentro = series.map((s, k) => ({ s, k })).filter(({ s }) => meses.length > 0 && meses.every((i) => temDado(s, i)));
  return {
    categorias: meses.map((i) => MESES[i].slice(0, 3)),
    series: dentro.map(({ s, k }) => ({ nome: s.parcial ? `${s.ano} (parcial)` : String(s.ano), valores: meses.map((i) => s.valores[i] as number), cor: COR[k] })),
    foraDoGrafico: series.filter((s) => !dentro.some((d) => d.s === s)).map((s) => s.ano),
  };
}
