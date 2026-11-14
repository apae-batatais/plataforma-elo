/**
 * SLA em horas úteis: de segunda a sexta, dentro do expediente (padrão 8h às 17h),
 * no horário de Brasília. Os feriados cadastrados não contam.
 *
 * O Brasil não tem horário de verão desde 2019: o horário de Brasília é UTC−3 o ano todo.
 */
export interface Expediente {
  /** Hora de início (0 a 23). */
  inicio: number;
  /** Hora de fim (1 a 24), maior que o início. */
  fim: number;
  /** Datas (AAAA-MM-DD) que não contam como dia útil. */
  feriados?: ReadonlySet<string>;
}

export const EXPEDIENTE_PADRAO: Expediente = { inicio: 8, fim: 17 };
const FUSO_MS = -3 * 3600_000;
const DIA_MS = 86_400_000;

export function conferirExpediente(e: Expediente): string[] {
  const erros: string[] = [];
  if (!Number.isInteger(e.inicio) || e.inicio < 0 || e.inicio > 23) erros.push('O início do expediente deve ser uma hora entre 0 e 23.');
  if (!Number.isInteger(e.fim) || e.fim < 1 || e.fim > 24) erros.push('O fim do expediente deve ser uma hora entre 1 e 24.');
  if (e.fim <= e.inicio) erros.push('O fim do expediente precisa ser depois do início.');
  return erros;
}

/** Horas úteis entre dois instantes (ISO). Zero se o fim vier antes do início. */
export function horasUteis(deISO: string, ateISO: string, e: Expediente = EXPEDIENTE_PADRAO): number {
  const de = Date.parse(deISO) + FUSO_MS;
  const ate = Date.parse(ateISO) + FUSO_MS;
  if (!(ate > de)) return 0;
  let total = 0;
  for (let dia = Math.floor(de / DIA_MS) * DIA_MS; dia < ate; dia += DIA_MS) {
    const semana = new Date(dia).getUTCDay();
    if (semana === 0 || semana === 6) continue;
    if (e.feriados?.has(new Date(dia).toISOString().slice(0, 10))) continue;
    const ini = Math.max(de, dia + e.inicio * 3600_000);
    const fim = Math.min(ate, dia + e.fim * 3600_000);
    if (fim > ini) total += fim - ini;
  }
  return Math.round((total / 3600_000) * 100) / 100;
}

export type SituacaoPrazo = 'no_prazo' | 'atrasada';

/** Como está o prazo de uma etapa: começou em `de`, terminou em `ate` (ou ainda está correndo). */
export function prazoDaEtapa(deISO: string, ateISO: string | null, prazoHoras: number, agoraISO: string, e?: Expediente) {
  const gastas = horasUteis(deISO, ateISO ?? agoraISO, e);
  return { horas: gastas, situacao: (gastas > prazoHoras ? 'atrasada' : 'no_prazo') as SituacaoPrazo, encerrada: ateISO !== null };
}

/** "3 h 20 min" ou "2 dias úteis e 4 h" (dia útil = horas do expediente). */
export function textoHoras(horas: number, e: Expediente = EXPEDIENTE_PADRAO): string {
  const porDia = e.fim - e.inicio;
  const minutos = Math.round(horas * 60);
  if (minutos < 60) return `${minutos} min`;
  const dias = Math.floor(horas / porDia);
  const resto = horas - dias * porDia;
  const h = Math.floor(resto);
  const m = Math.round((resto - h) * 60);
  const partes = [dias ? `${dias} ${dias === 1 ? 'dia útil' : 'dias úteis'}` : '', h ? `${h} h` : '', m && !dias ? `${m} min` : ''].filter(Boolean);
  return partes.join(' e ') || '0 min';
}

/**
 * Dia (AAAA-MM-DD, horário de Brasília) em que o prazo de uma etapa, contado em horas úteis a partir de `deISO`,
 * se esgota. É o dia que a agenda mostra como limite.
 */
export function diaLimite(deISO: string, prazoHoras: number, e: Expediente = EXPEDIENTE_PADRAO): string {
  const de = Date.parse(deISO) + FUSO_MS;
  let restante = prazoHoras * 3600_000;
  let dia = Math.floor(de / DIA_MS) * DIA_MS;
  for (let i = 0; i < 3660; i++, dia += DIA_MS) {
    const semana = new Date(dia).getUTCDay();
    if (semana === 0 || semana === 6 || e.feriados?.has(new Date(dia).toISOString().slice(0, 10))) continue;
    const ini = Math.max(de, dia + e.inicio * 3600_000);
    const disponivel = dia + e.fim * 3600_000 - ini;
    if (disponivel <= 0) continue;
    if (restante <= disponivel) return new Date(dia).toISOString().slice(0, 10);
    restante -= disponivel;
  }
  return new Date(dia).toISOString().slice(0, 10);
}
