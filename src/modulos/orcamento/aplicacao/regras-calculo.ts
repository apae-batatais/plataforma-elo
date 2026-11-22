/**
 * Regras de rateio no formato do cálculo (R1). Arquivo à parte, sem dependência de outros casos de uso,
 * para o recálculo das despesas geradas por rateio (ADR-038) não formar ciclo com a folha.
 */
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { BasesRateio, BasesRateioValores, RegrasRateio, RegrasRateioParticipantes } from '../dados/tabelas';
import type { BaseRegra, RegraRateio } from '../dominio/rateio-custos';

/** Regras ativas no formato do cálculo (sem checar permissão: uso interno do painel). */
export async function regrasParaCalculo(p: Planilhas): Promise<{ regras: RegraRateio[]; basesDoAno: (ano: number) => Map<string, Map<string, number>> }> {
  const [regrasT, partT, valoresT, basesT] = await lerTabelas(p, [RegrasRateio, RegrasRateioParticipantes, BasesRateioValores, BasesRateio] as const);
  const regras: RegraRateio[] = regrasT.ativos().map((r) => ({
    id: r.id,
    nome: r.nome,
    tipo: r.tipo,
    base1: r.base1 as BaseRegra,
    base2: (r.base2 as BaseRegra | null) ?? null,
    participantes: partT.ativos().filter((x) => x.regra_id === r.id).map((x) => x.participante),
  }));
  const ativas = new Set(basesT.ativos().map((b) => b.id));
  const basesDoAno = (ano: number) => {
    const m = new Map<string, Map<string, number>>();
    for (const v of valoresT.ativos().filter((x) => x.ano === ano && ativas.has(x.base_id))) {
      const mm = m.get(v.base_id) ?? new Map<string, number>();
      mm.set(v.servico, v.valor);
      m.set(v.base_id, mm);
    }
    return m;
  };
  return { regras, basesDoAno };
}

