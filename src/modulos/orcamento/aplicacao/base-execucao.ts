/**
 * Leitura comum das telas da 1D.2 (conferência, fim do ano, reserva, Visão geral): contas, saldos,
 * realizado e fontes, com funções puras de consulta. Quem chama confere a permissão.
 */
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { AjustesConciliacao, Contas, Fontes, MudancasClasse, Realizado, Saldos, type RegConta, type RegRealizado } from '../dados/tabelas';
import { classeNoMes, totaisPorClasse, type Classe } from '../dominio/tesouraria';

export interface BaseExecucao {
  contas: RegConta[];
  saldos: { conta_id: string; mes: string; saldo: number }[];
  ajustes: { conta_id: string; mes: string; valor: number; ativo: boolean }[];
  mudancas: { conta_id: string; classe_anterior: Classe; fonte_id_anterior: string | null; a_partir_de: string }[];
  realizado: RegRealizado[];
  /** Fontes de uso livre (ids). */
  fontesLivres: Set<string>;
  nomeFonte: Map<string, string>;
}

export async function lerBase(p: Planilhas): Promise<BaseExecucao> {
  const [contas, saldos, ajustes, mudancas, realizado, fontes] = await lerTabelas(p, [Contas, Saldos, AjustesConciliacao, MudancasClasse, Realizado, Fontes] as const);
  return {
    contas: contas.todos(),
    saldos: saldos.ativos(),
    ajustes: ajustes.ativos(),
    mudancas: mudancas.ativos().map((m) => ({ ...m, fonte_id_anterior: m.fonte_id_anterior ?? null })),
    realizado: realizado.ativos(),
    fontesLivres: new Set(fontes.todos().filter((f) => f.uso === 'livre').map((f) => f.id)),
    nomeFonte: new Map(fontes.todos().map((f) => [f.id, f.nome])),
  };
}

const c = (v: number) => Math.round(v * 100);

export const classeDaContaNoMes = (b: BaseExecucao, conta: RegConta, mes: string) => classeNoMes(conta, b.mudancas, mes);

/** Fonte da conta naquele mês (a de hoje, ou a anterior à mudança de classe que vale depois do mês). */
export function fonteDaContaNoMes(b: BaseExecucao, conta: RegConta, mes: string): string | null {
  if (classeNoMes(conta, b.mudancas, mes) === conta.classe) return conta.fonte_id ?? null;
  const primeira = b.mudancas.filter((m) => m.conta_id === conta.id && m.a_partir_de > mes).sort((x, y) => x.a_partir_de.localeCompare(y.a_partir_de))[0];
  return primeira?.fonte_id_anterior ?? null;
}

/** Saldo do extrato + ajustes de conciliação do mês; null se a conta não tem saldo no mês. */
export function saldoDaConta(b: BaseExecucao, contaId: string, mes: string): number | null {
  const s = b.saldos.find((x) => x.conta_id === contaId && x.mes === mes);
  if (!s) return null;
  const ajustes = b.ajustes.filter((a) => a.conta_id === contaId && a.mes === mes && a.ativo).reduce((t, a) => t + c(a.valor), 0);
  return (c(s.saldo) + ajustes) / 100;
}

export const totaisDoMes = (b: BaseExecucao, mes: string) => totaisPorClasse(b.contas, b.saldos, b.ajustes, mes, b.mudancas);

/** O mês tem saldo informado em alguma conta das classes pedidas (na classe que a conta tinha no mês)? */
export function temSaldo(b: BaseExecucao, mes: string, classes: Classe[]): boolean {
  const porId = new Map(b.contas.map((x) => [x.id, x]));
  return b.saldos.some((s) => {
    const conta = porId.get(s.conta_id);
    return s.mes === mes && !!conta && classes.includes(classeNoMes(conta, b.mudancas, mes));
  });
}

/** Livre disponível + reserva do mês; null quando nenhuma conta dessas classes tem saldo no mês. */
export function saldoLivreMaisReserva(b: BaseExecucao, mes: string): number | null {
  if (!temSaldo(b, mes, ['livre_disponivel', 'reserva'])) return null;
  const t = totaisDoMes(b, mes);
  return (c(t.livre_disponivel) + c(t.reserva)) / 100;
}

/** Meses (AAAA-MM) que têm saldo nas classes pedidas, do mais antigo ao mais recente. */
export function mesesComSaldo(b: BaseExecucao, classes: Classe[]): string[] {
  const meses = [...new Set(b.saldos.map((s) => s.mes))].sort();
  return meses.filter((m) => temSaldo(b, m, classes));
}

export const mesesComRealizado = (b: BaseExecucao): Set<string> => new Set(b.realizado.map((r) => r.mes));

/** Receita e despesa do realizado num mês, em centavos exatos, filtradas por fonte. */
export function resultadoDoMes(b: BaseExecucao, mes: string, fonte: (id: string) => boolean = () => true) {
  let receita = 0;
  let despesa = 0;
  for (const r of b.realizado) {
    if (r.mes !== mes || !fonte(r.fonte_id)) continue;
    if (r.tipo === 'receita') receita += c(r.valor);
    else despesa += c(r.valor);
  }
  return { receita: receita / 100, despesa: despesa / 100 };
}
