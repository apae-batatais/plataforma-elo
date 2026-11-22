/**
 * Fase 3 (entrega P3): atividades com prazos e responsável, e orçamento do projeto.
 * Regras puras, sem leitura nem gravação.
 */
import { ErroProjetos } from './projeto';

export const SITUACOES_ATIVIDADE = ['a_fazer', 'em_andamento', 'concluida', 'cancelada'] as const;
export type SituacaoAtividade = (typeof SITUACOES_ATIVIDADE)[number];
/** `atrasada` não é gravada: é calculada (regra 20). */
export type SituacaoExibida = SituacaoAtividade | 'atrasada';
export const NOME_SITUACAO_ATIVIDADE: Record<SituacaoExibida, string> = {
  a_fazer: 'A fazer',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
  atrasada: 'Atrasada',
};

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Confere uma data AAAA-MM-DD existente no calendário. */
export function lerData(valor: string | null | undefined, rotulo: string): string {
  const v = (valor ?? '').trim();
  if (!DATA.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`)) || new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) !== v) {
    throw new ErroProjetos(`${rotulo}: informe uma data válida.`);
  }
  return v;
}

/** Regra 20: fim previsto no passado e atividade ainda não concluída nem cancelada. `hoje` é AAAA-MM-DD. */
export function situacaoExibida(a: { situacao: SituacaoAtividade; fim_previsto: string }, hoje: string): SituacaoExibida {
  if ((a.situacao === 'a_fazer' || a.situacao === 'em_andamento') && a.fim_previsto < hoje) return 'atrasada';
  return a.situacao;
}

export interface DadosPrazos {
  inicioPrevisto: string;
  fimPrevisto: string;
}

/** Confere as datas previstas (o fim não vem antes do início). */
export function conferirPrazos(inicio: string | null | undefined, fim: string | null | undefined): DadosPrazos {
  const i = lerData(inicio, 'Início previsto');
  const f = lerData(fim, 'Fim previsto');
  if (f < i) throw new ErroProjetos('O fim previsto não pode vir antes do início previsto.');
  return { inicioPrevisto: i, fimPrevisto: f };
}

/** Peso opcional da atividade: número maior que zero. */
export function lerPeso(valor: number | string | null | undefined): number | null {
  if (valor === null || valor === undefined || String(valor).trim() === '') return null;
  const n = typeof valor === 'number' ? valor : Number(String(valor).replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) throw new ErroProjetos('Peso: use um número maior que zero ou deixe em branco.');
  return n;
}

/** Valor em reais de uma linha do orçamento: número igual ou maior que zero. */
export function lerValor(valor: number | string | null | undefined): number {
  const n = typeof valor === 'number' ? valor : Number(String(valor ?? '').replace(/\./g, '').replace(',', '.'));
  if (String(valor ?? '').trim() === '' || !Number.isFinite(n) || n < 0) throw new ErroProjetos('Valor planejado: use um número igual ou maior que zero.');
  return Math.round(n * 100) / 100;
}

/** Soma das linhas do orçamento, em centavos exatos. */
export function totalOrcamento(linhas: readonly { valor_planejado: number }[]): number {
  return linhas.reduce((s, l) => s + Math.round(l.valor_planejado * 100), 0) / 100;
}

/** Subtotal por categoria, na ordem da primeira aparição. */
export function subtotaisPorCategoria(linhas: readonly { categoria: string; valor_planejado: number }[]): { categoria: string; total: number }[] {
  const mapa = new Map<string, number>();
  for (const l of linhas) mapa.set(l.categoria, (mapa.get(l.categoria) ?? 0) + Math.round(l.valor_planejado * 100));
  return [...mapa].map(([categoria, c]) => ({ categoria, total: c / 100 }));
}

/** Data de hoje (AAAA-MM-DD) no fuso de Brasília. */
export const hojeEmBrasilia = (agora: Date): string => new Date(agora.getTime() - 3 * 3600_000).toISOString().slice(0, 10);

/** Andamento pelo peso das atividades (sem peso, cada uma vale 1); canceladas ficam de fora. 0 a 100. */
export function andamentoPct(atividades: readonly { situacao: SituacaoAtividade; peso: number | null }[]): number {
  const validas = atividades.filter((a) => a.situacao !== 'cancelada');
  const total = validas.reduce((s, a) => s + (a.peso ?? 1), 0);
  if (total === 0) return 0;
  const feito = validas.filter((a) => a.situacao === 'concluida').reduce((s, a) => s + (a.peso ?? 1), 0);
  return Math.round((feito / total) * 100);
}
