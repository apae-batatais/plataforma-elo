/** Formatação para as telas (pt-BR). */
export const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const percentual = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
export const data = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '—');
export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/** Meses com valor, em faixas curtas: "Jun a Dez", "Fev, Ago", "12 meses". */
export function faixaDeMeses(valores: number[]): string {
  const usados = valores.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  if (usados.length === 12) return '12 meses';
  if (usados.length === 0) return '—';
  const faixas: [number, number][] = [];
  for (const m of usados) {
    const ultima = faixas.at(-1);
    if (ultima && ultima[1] === m - 1) ultima[1] = m;
    else faixas.push([m, m]);
  }
  const nome = (i: number) => MESES[i].slice(0, 3);
  return faixas.map(([a, b]) => (a === b ? nome(a) : b === a + 1 ? `${nome(a)}, ${nome(b)}` : `${nome(a)} a ${nome(b)}`)).join(', ');
}

/** "2026-09" → "setembro de 2026". */
export function rotuloMes(mes: string): string {
  const [ano, m] = mes.split('-').map(Number);
  return `${MESES[m - 1].toLowerCase()} de ${ano}`;
}
