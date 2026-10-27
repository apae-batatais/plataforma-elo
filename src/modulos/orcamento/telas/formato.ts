/** Formatação para as telas (pt-BR). */
export const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const percentual = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
export const data = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '—');
export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
