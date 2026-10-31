/**
 * O que o Orçamento oferece a outros módulos, pela plataforma (ADR-013).
 * Só nomes de cadastros, sem valores: não exige permissão do Orçamento.
 */
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { GruposGasto } from '../dados/tabelas';

/** Grupos de gasto ativos (id e nome), para outros módulos classificarem pedidos. */
export async function gruposDeGastoAtivos(p: Planilhas): Promise<{ id: string; nome: string }[]> {
  const [grupos] = await lerTabelas(p, [GruposGasto] as const);
  return grupos.ativos().map((g) => ({ id: g.id, nome: g.nome }));
}
