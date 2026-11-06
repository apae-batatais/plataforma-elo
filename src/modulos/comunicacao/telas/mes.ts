/** Contas de calendário da tela (dias do mês em semanas de domingo a sábado). Só datas AAAA-MM-DD, sem fuso. */

export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const DIAS_DA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const doisDigitos = (n: number) => String(n).padStart(2, '0');
const textoDe = (t: Date) => `${t.getUTCFullYear()}-${doisDigitos(t.getUTCMonth() + 1)}-${doisDigitos(t.getUTCDate())}`;
const utcDe = (dia: string) => {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d));
};

/** Mês AAAA-MM válido, senão null. */
export function mesValido(mes: string | undefined): string | null {
  return mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : null;
}

/** Soma (ou subtrai) meses a um AAAA-MM. */
export function somarMeses(mes: string, n: number): string {
  const [a, m] = mes.split('-').map(Number);
  const t = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${t.getUTCFullYear()}-${doisDigitos(t.getUTCMonth() + 1)}`;
}

export function nomeDoMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  return `${MESES[m - 1]} de ${a}`;
}

/** Primeiro e último dia do mês. */
export function limitesDoMes(mes: string): { inicio: string; fim: string } {
  const [a, m] = mes.split('-').map(Number);
  return { inicio: `${mes}-01`, fim: textoDe(new Date(Date.UTC(a, m, 0))) };
}

/** Semanas (domingo a sábado) que cobrem o mês; cada dia diz se é do mês mostrado. */
export function semanasDoMes(mes: string): { dia: string; doMes: boolean }[][] {
  const { inicio, fim } = limitesDoMes(mes);
  const primeiro = utcDe(inicio);
  primeiro.setUTCDate(primeiro.getUTCDate() - primeiro.getUTCDay());
  const semanas: { dia: string; doMes: boolean }[][] = [];
  for (const d = primeiro; textoDe(d) <= fim || semanas.length === 0; ) {
    const semana = [];
    for (let i = 0; i < 7; i++) {
      const dia = textoDe(d);
      semana.push({ dia, doMes: dia.startsWith(mes) });
      d.setUTCDate(d.getUTCDate() + 1);
    }
    semanas.push(semana);
  }
  return semanas;
}

/** 2026-11-21 -> 21/11/2026. */
export function dataCurta(dia: string): string {
  const [a, m, d] = dia.split('-');
  return `${d}/${m}/${a}`;
}

/** Quando o item cai: "21/11/2026" ou "16/11/2026 a 18/12/2026". */
export function quandoCai(i: { inicio: string; fim: string }): string {
  return i.inicio === i.fim ? dataCurta(i.inicio) : `${dataCurta(i.inicio)} a ${dataCurta(i.fim)}`;
}
