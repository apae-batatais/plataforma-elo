/**
 * Feriados que não contam nas horas úteis do SLA.
 * A instituição cadastra os seus (municipais, ponto facultativo) e pode
 * incluir de uma vez os nacionais e o estadual de São Paulo de um ano.
 */
import { ErroRequisicao } from './requisicao';

export interface Feriado {
  data: string;
  nome: string;
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
export function pascoa(ano: number): string {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

const somarDias = (iso: string, dias: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);

/** Feriados nacionais (Lei 662/1949 e posteriores, incluindo 20 de novembro desde 2024) e o de São Paulo (9 de julho). */
export function feriadosNacionais(ano: number): Feriado[] {
  const d = (mmdd: string) => `${ano}-${mmdd}`;
  return [
    { data: d('01-01'), nome: 'Confraternização Universal' },
    { data: somarDias(pascoa(ano), -2), nome: 'Sexta-feira Santa' },
    { data: d('04-21'), nome: 'Tiradentes' },
    { data: d('05-01'), nome: 'Dia do Trabalho' },
    { data: d('07-09'), nome: 'Revolução Constitucionalista (SP)' },
    { data: d('09-07'), nome: 'Independência do Brasil' },
    { data: d('10-12'), nome: 'Nossa Senhora Aparecida' },
    { data: d('11-02'), nome: 'Finados' },
    { data: d('11-15'), nome: 'Proclamação da República' },
    { data: d('11-20'), nome: 'Dia Nacional de Zumbi e da Consciência Negra' },
    { data: d('12-25'), nome: 'Natal' },
  ].sort((a, b) => a.data.localeCompare(b.data));
}

/** Confere um feriado digitado; devolve a data e o nome limpos. */
export function conferirFeriado(f: { data: string; nome: string }): Feriado {
  const data = f.data.trim();
  const nome = f.nome.trim().replace(/\s+/g, ' ');
  const erros: string[] = [];
  const instante = Date.parse(`${data}T12:00:00Z`);
  const valida = /^\d{4}-\d{2}-\d{2}$/.test(data) && !Number.isNaN(instante) && new Date(instante).toISOString().slice(0, 10) === data;
  if (!valida) erros.push('Informe a data do feriado.');
  if (!nome) erros.push('Informe o nome do feriado.');
  if (erros.length) throw new ErroRequisicao(erros.join(' '));
  return { data, nome };
}
