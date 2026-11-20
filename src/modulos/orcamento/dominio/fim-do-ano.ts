/**
 * Regras puras do fim do ano (1D.2, regras F1 a F6). Nada aqui lê ou grava dados.
 * Em centavos exatos; mês sem dado nunca vira zero (F4).
 */
const c = (v: number) => Math.round(v * 100);

export interface LinhaRealizadoLivre {
  mes: string;
  tipo: 'despesa' | 'receita';
  valor: number;
  naoRecorrente: boolean;
}

/** Meses do ano depois do ponto de partida, até dezembro, no formato AAAA-MM do ano pedido. */
export function mesesQueFaltam(partida: string, anoReferencia: number): string[] {
  const mm = Number(partida.slice(5));
  return Array.from({ length: 12 - mm }, (_, i) => `${anoReferencia}-${String(mm + 1 + i).padStart(2, '0')}`);
}

/** F1: o último mês do ano com saldo; sem nenhum, null. */
export function pontoDePartida(mesesComSaldo: string[], ano: number): string | null {
  return mesesComSaldo.filter((m) => m.startsWith(`${ano}-`)).sort().at(-1) ?? null;
}

export interface Cenario {
  /** Saldo livre previsto em dezembro; null = sem dado. */
  saldoDezembro: number | null;
  /** Meses que faltavam informar (F4). */
  faltam: string[];
  /** Motivo escrito quando não há dado que não seja mês faltante. */
  motivo: string | null;
}

/**
 * F2: saldo do ponto de partida + resultado do recurso livre dos meses que faltam, no ano de referência.
 * `mesesInformados` = meses do ano de referência com alguma linha de realizado.
 */
export function cenarioRepetir(e: {
  saldoPartida: number;
  partida: string;
  anoReferencia: number;
  linhasLivres: LinhaRealizadoLivre[];
  mesesInformados: Set<string>;
  comNaoRecorrentes: boolean;
}): Cenario {
  const meses = mesesQueFaltam(e.partida, e.anoReferencia);
  const faltam = meses.filter((m) => !e.mesesInformados.has(m));
  if (faltam.length) return { saldoDezembro: null, faltam, motivo: null };
  let resultado = 0;
  for (const l of e.linhasLivres) {
    if (!meses.includes(l.mes) || (!e.comNaoRecorrentes && l.naoRecorrente)) continue;
    resultado += l.tipo === 'receita' ? c(l.valor) : -c(l.valor);
  }
  return { saldoDezembro: (c(e.saldoPartida) + resultado) / 100, faltam: [], motivo: null };
}

/** F3: receita livre prevista − despesa livre prevista dos meses depois do ponto de partida, somada ao saldo. */
export function cenarioPrevisao(e: { saldoPartida: number; partida: string; receitaLivre: number[]; despesaLivre: number[] }): Cenario {
  const mm = Number(e.partida.slice(5));
  let resultado = 0;
  for (let i = mm; i < 12; i++) resultado += c(e.receitaLivre[i] ?? 0) - c(e.despesaLivre[i] ?? 0);
  return { saldoDezembro: (c(e.saldoPartida) + resultado) / 100, faltam: [], motivo: null };
}

/** F5: folga = saldo livre previsto em dezembro − reserva atual (negativa = seria preciso usar a reserva). */
export function folga(saldoDezembro: number | null, reservaAtual: number): number | null {
  return saldoDezembro === null ? null : (c(saldoDezembro) - c(reservaAtual)) / 100;
}
