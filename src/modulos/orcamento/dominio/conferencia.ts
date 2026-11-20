/**
 * Regras puras das conferências da Tesouraria (1D.2, regras C1 a C7). Nada aqui lê ou grava dados.
 * Tudo em centavos exatos; dado que falta nunca vira zero (C3, C7).
 */
import { mesAnterior } from './tesouraria';

const c = (v: number) => Math.round(v * 100);
const reais = (centavos: number) => centavos / 100;

/** O que falta para calcular: o saldo ou o realizado de um mês. */
export interface Falta {
  o: 'saldo' | 'realizado';
  mes: string;
}

export type SituacaoConferencia = 'confere' | 'diferenca' | 'sem_dado';

export interface ResultadoConferencia {
  situacao: SituacaoConferencia;
  /** null quando faltam dados. */
  diferenca: number | null;
  faltam: Falta[];
}

/** Junta as faltas sem repetir. */
function faltasDe(itens: { valor: unknown; falta: Falta }[]): Falta[] {
  return itens.filter((i) => i.valor === null || i.valor === undefined).map((i) => i.falta);
}

function resultado(faltam: Falta[], calcular: () => number): ResultadoConferencia {
  if (faltam.length) return { situacao: 'sem_dado', diferenca: null, faltam };
  const centavos = calcular();
  return { situacao: centavos === 0 ? 'confere' : 'diferenca', diferenca: reais(centavos), faltam: [] };
}

/**
 * C1 a C3: saldo do mês − (saldo do mês anterior + receita − despesa da fonte no mês).
 * `realizadoInformado` = o mês tem alguma linha de realizado (de qualquer fonte).
 */
export function conferirTermo(e: {
  mes: string;
  saldoMes: number | null;
  saldoAnterior: number | null;
  receita: number;
  despesa: number;
  realizadoInformado: boolean;
}): ResultadoConferencia & { entradas: number; saidas: number } {
  const faltam = faltasDe([
    { valor: e.saldoMes, falta: { o: 'saldo', mes: e.mes } },
    { valor: e.saldoAnterior, falta: { o: 'saldo', mes: mesAnterior(e.mes) } },
    { valor: e.realizadoInformado ? 1 : null, falta: { o: 'realizado', mes: e.mes } },
  ]);
  const r = resultado(faltam, () => c(e.saldoMes!) - (c(e.saldoAnterior!) + c(e.receita) - c(e.despesa)));
  return { ...r, entradas: e.receita, saidas: e.despesa };
}

/**
 * C6 e C7: variação do saldo livre (disponível + reserva) no mês − resultado do recurso livre no mês
 * (receita − despesa das linhas de fonte livre).
 */
export function conferirRecursoLivre(e: {
  mes: string;
  /** Livre disponível + reserva do mês (com ajustes); null = nenhum saldo no mês. */
  saldoMes: number | null;
  saldoAnterior: number | null;
  receitaLivre: number;
  despesaLivre: number;
  realizadoInformado: boolean;
}): ResultadoConferencia & { variacao: number | null; resultadoLivre: number } {
  const faltam = faltasDe([
    { valor: e.saldoMes, falta: { o: 'saldo', mes: e.mes } },
    { valor: e.saldoAnterior, falta: { o: 'saldo', mes: mesAnterior(e.mes) } },
    { valor: e.realizadoInformado ? 1 : null, falta: { o: 'realizado', mes: e.mes } },
  ]);
  const resultadoLivre = reais(c(e.receitaLivre) - c(e.despesaLivre));
  const r = resultado(faltam, () => c(e.saldoMes!) - c(e.saldoAnterior!) - c(resultadoLivre));
  const variacao = e.saldoMes !== null && e.saldoAnterior !== null ? reais(c(e.saldoMes) - c(e.saldoAnterior)) : null;
  return { ...r, variacao, resultadoLivre };
}
