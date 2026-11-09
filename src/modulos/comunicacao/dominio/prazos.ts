/**
 * Datas do dia e dias úteis (segunda a sexta, sem feriados nesta fase).
 * Datas são textos 'AAAA-MM-DD'; a conta é feita em UTC para não depender do
 * fuso do computador.
 */

const MS_DIA = 24 * 60 * 60 * 1000;

const paraUtc = (dia: string) => {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d));
};
const deUtc = (data: Date) => data.toISOString().slice(0, 10);
const ehDiaUtil = (data: Date) => data.getUTCDay() !== 0 && data.getUTCDay() !== 6;

/** Dia de hoje em Brasília (UTC−3 fixo; o Brasil não tem horário de verão). */
export function diaEmBrasilia(agora: Date): string {
  return deUtc(new Date(agora.getTime() - 3 * 60 * 60 * 1000));
}

/** Soma n dias úteis ao dia. Com n = 0 devolve o próprio dia. */
export function somarDiasUteis(dia: string, n: number): string {
  const data = paraUtc(dia);
  let falta = n;
  while (falta > 0) {
    data.setTime(data.getTime() + MS_DIA);
    if (ehDiaUtil(data)) falta -= 1;
  }
  return deUtc(data);
}

/** Dias úteis depois de `inicio` até `fim`, inclusive. Zero se `fim` não for depois de `inicio`. */
export function diasUteisEntre(inicio: string, fim: string): number {
  if (fim <= inicio) return 0;
  const limite = paraUtc(fim).getTime();
  let total = 0;
  for (let t = paraUtc(inicio).getTime() + MS_DIA; t <= limite; t += MS_DIA) {
    if (ehDiaUtil(new Date(t))) total += 1;
  }
  return total;
}

/** Urgente quando a data desejada fica antes de hoje + antecedência mínima (em dias úteis). */
export function ehUrgente(dataDesejada: string, hoje: string, antecedencia: number): boolean {
  return dataDesejada < somarDiasUteis(hoje, antecedencia);
}

/** Data e hora no horário de Brasília, como "07/11/2026 10:00". */
export function dataHoraEmBrasilia(iso: string): string {
  const t = new Date(new Date(iso).getTime() - 3 * 60 * 60 * 1000).toISOString();
  return `${t.slice(8, 10)}/${t.slice(5, 7)}/${t.slice(0, 4)} ${t.slice(11, 16)}`;
}
