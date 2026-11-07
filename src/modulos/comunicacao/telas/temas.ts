/**
 * Sugestão de temas do calendário no pedido: os temas perto da data desejada
 * (ou de hoje, sem data) vêm primeiro; no empate, os que sugerem o tipo de peça escolhido.
 * Só ordena o que aparece na tela; quem decide o tema continua sendo a pessoa.
 */
import type { TipoPeca } from '../dominio/pedido';
import { DIAS_DA_SEMANA, MESES } from './mes';

/** Até quantos dias de distância um tema conta como "perto" da data. */
export const JANELA_TEMAS_DIAS = 30;
/** Quantos temas aparecem antes de "Ver todos os temas". */
export const MAXIMO_SUGESTOES = 4;

const MS_DIA = 24 * 60 * 60 * 1000;
const utc = (dia: string) => {
  const [a, m, d] = dia.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
};
const diaValido = (dia: string) => /^\d{4}-\d{2}-\d{2}$/.test(dia);

/** Dias corridos entre a data e o período do tema (zero quando a data cai dentro dele). */
export function distanciaDoTema(i: { inicio: string; fim: string }, dia: string): number {
  if (dia < i.inicio) return Math.round((utc(i.inicio) - utc(dia)) / MS_DIA);
  if (dia > i.fim) return Math.round((utc(dia) - utc(i.fim)) / MS_DIA);
  return 0;
}

export function sugerirTemas<T extends { inicio: string; fim: string; tipos: TipoPeca[] }>(
  itens: T[],
  { data, tipo, hoje }: { data: string; tipo: TipoPeca | ''; hoje: string },
): T[] {
  const referencia = diaValido(data) && data >= hoje ? data : hoje;
  return itens
    .filter((i) => i.inicio && distanciaDoTema(i, referencia) <= JANELA_TEMAS_DIAS)
    .map((i) => ({ i, d: distanciaDoTema(i, referencia), combina: tipo !== '' && i.tipos.includes(tipo) }))
    .sort((a, b) => a.d - b.d || Number(b.combina) - Number(a.combina) || a.i.inicio.localeCompare(b.i.inicio))
    .slice(0, MAXIMO_SUGESTOES)
    .map((x) => x.i);
}

/** 2026-11-13 -> "sexta-feira, 13 de novembro". */
export function dataPorExtenso(dia: string): string {
  const t = new Date(utc(dia));
  const semana = DIAS_DA_SEMANA[t.getUTCDay()];
  const nome = t.getUTCDay() === 0 || t.getUTCDay() === 6 ? semana : `${semana}-feira`;
  return `${nome}, ${t.getUTCDate()} de ${MESES[t.getUTCMonth()]}`;
}
