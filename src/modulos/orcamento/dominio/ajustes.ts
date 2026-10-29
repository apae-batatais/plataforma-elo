/**
 * Remanejamentos e suplementações (regras puras).
 * O item original nunca muda: os ajustes aprovados somam ou tiram valor por mês.
 */
import { arred } from './previsao';

export interface AjusteSimples {
  tipo: 'remanejamento' | 'suplementacao';
  origem_id: string | null;
  destino_id: string;
  mes: number;
  valor: number;
}

/** Diferença por item e mês (índice 0 = janeiro) causada pelos ajustes. */
export function deltasDosAjustes(ajustes: AjusteSimples[]): Map<string, number[]> {
  const m = new Map<string, number[]>();
  const somar = (id: string, mes: number, v: number) => {
    const l = m.get(id) ?? Array(12).fill(0);
    l[mes - 1] = arred(l[mes - 1] + v);
    m.set(id, l);
  };
  for (const a of ajustes) {
    if (a.tipo === 'remanejamento' && a.origem_id) somar(a.origem_id, a.mes, -a.valor);
    somar(a.destino_id, a.mes, a.valor);
  }
  return m;
}

export const mesesComAjuste = (base: number[], delta: number[] | undefined) => (delta ? base.map((v, i) => arred(v + delta[i])) : base);

export class ErroAjuste extends Error {}

/**
 * Confere um pedido de ajuste contra os valores do mês já com os ajustes aprovados.
 * `saldo(id, mes)` devolve o valor atual do item no mês.
 */
export function conferirAjuste(a: AjusteSimples, saldo: (id: string, mes: number) => number | null): void {
  if (!Number.isInteger(a.mes) || a.mes < 1 || a.mes > 12) throw new ErroAjuste('Escolha o mês.');
  if (!Number.isFinite(a.valor) || a.valor === 0) throw new ErroAjuste('Informe o valor.');
  if (saldo(a.destino_id, a.mes) === null) throw new ErroAjuste('Item de destino não encontrado no exercício.');
  if (a.tipo === 'remanejamento') {
    if (a.valor < 0) throw new ErroAjuste('No remanejamento, o valor é positivo: ele sai da origem e vai para o destino.');
    if (!a.origem_id) throw new ErroAjuste('Escolha o item de origem.');
    if (a.origem_id === a.destino_id) throw new ErroAjuste('Origem e destino precisam ser itens diferentes.');
    const disponivel = saldo(a.origem_id, a.mes);
    if (disponivel === null) throw new ErroAjuste('Item de origem não encontrado no exercício.');
    if (arred(disponivel - a.valor) < 0) {
      throw new ErroAjuste(`A origem só tem ${disponivel.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} nesse mês.`);
    }
  } else if (a.valor < 0) {
    const disponivel = saldo(a.destino_id, a.mes) ?? 0;
    if (arred(disponivel + a.valor) < 0) {
      throw new ErroAjuste(`A redução passa do valor do mês (${disponivel.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}).`);
    }
  }
}
