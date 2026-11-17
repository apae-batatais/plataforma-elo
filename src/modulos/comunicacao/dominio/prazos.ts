/**
 * Datas do dia e dias úteis (segunda a sexta, sem os feriados do Núcleo).
 * Datas são textos 'AAAA-MM-DD'; a conta é feita em UTC para não depender do
 * fuso do computador.
 */

const MS_DIA = 24 * 60 * 60 * 1000;

const paraUtc = (dia: string) => {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d));
};
const deUtc = (data: Date) => data.toISOString().slice(0, 10);
/** Datas 'AAAA-MM-DD' dos feriados (lidas do Núcleo); não contam como dias úteis. */
export type Feriados = ReadonlySet<string>;
const SEM_FERIADOS: Feriados = new Set();
const ehDiaUtil = (data: Date, feriados: Feriados) => data.getUTCDay() !== 0 && data.getUTCDay() !== 6 && !feriados.has(deUtc(data));

/** Dia de hoje em Brasília (UTC−3 fixo; o Brasil não tem horário de verão). */
export function diaEmBrasilia(agora: Date): string {
  return deUtc(new Date(agora.getTime() - 3 * 60 * 60 * 1000));
}

/** Soma n dias úteis ao dia. Com n = 0 devolve o próprio dia. */
export function somarDiasUteis(dia: string, n: number, feriados: Feriados = SEM_FERIADOS): string {
  const data = paraUtc(dia);
  let falta = n;
  while (falta > 0) {
    data.setTime(data.getTime() + MS_DIA);
    if (ehDiaUtil(data, feriados)) falta -= 1;
  }
  return deUtc(data);
}

/** Dias úteis depois de `inicio` até `fim`, inclusive. Zero se `fim` não for depois de `inicio`. */
export function diasUteisEntre(inicio: string, fim: string, feriados: Feriados = SEM_FERIADOS): number {
  if (fim <= inicio) return 0;
  const limite = paraUtc(fim).getTime();
  let total = 0;
  for (let t = paraUtc(inicio).getTime() + MS_DIA; t <= limite; t += MS_DIA) {
    if (ehDiaUtil(new Date(t), feriados)) total += 1;
  }
  return total;
}

/** Urgente quando a data desejada fica antes de hoje + antecedência mínima (em dias úteis). */
export function ehUrgente(dataDesejada: string, hoje: string, antecedencia: number, feriados: Feriados = SEM_FERIADOS): boolean {
  return dataDesejada < somarDiasUteis(hoje, antecedencia, feriados);
}

/** Data e hora no horário de Brasília, como "07/11/2026 10:00". */
export function dataHoraEmBrasilia(iso: string): string {
  const t = new Date(new Date(iso).getTime() - 3 * 60 * 60 * 1000).toISOString();
  return `${t.slice(8, 10)}/${t.slice(5, 7)}/${t.slice(0, 4)} ${t.slice(11, 16)}`;
}
