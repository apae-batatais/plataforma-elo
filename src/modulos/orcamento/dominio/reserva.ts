/**
 * Regras puras da reserva e dos sinais da Visão geral (1D.2, regras R1 a R6 e S1 a S10).
 * Nada aqui lê ou grava dados.
 */
import { mesAnterior } from './tesouraria';

const c = (v: number) => Math.round(v * 100);

// ---------------------------------------------------------------------------
// Política (faixas)
// ---------------------------------------------------------------------------

export interface Faixas {
  meses_minimo: number;
  livre_ok: number;
  livre_atencao: number;
  fim_ok: number;
  exec_atencao: number;
  folha_ok: number;
  folha_atencao: number;
  gasto_ok: number;
  gasto_atencao: number;
  reserva_ok: number;
  reserva_atencao: number;
}

/** Faixas propostas (regra 22); valem como "de fábrica" enquanto a Diretoria não aprova outras. */
export const FAIXAS_DE_FABRICA: Faixas = {
  meses_minimo: 2,
  livre_ok: 3,
  livre_atencao: 1,
  fim_ok: 100000,
  exec_atencao: 5,
  folha_ok: 60,
  folha_atencao: 65,
  gasto_ok: 0,
  gasto_atencao: 10,
  reserva_ok: 120,
  reserva_atencao: 100,
};

export const CAMPOS_FAIXAS = Object.keys(FAIXAS_DE_FABRICA) as (keyof Faixas)[];

/** Confere a política proposta. Vazio = válida. */
export function conferirFaixas(f: Faixas): string[] {
  const erros: string[] = [];
  for (const k of CAMPOS_FAIXAS) if (!Number.isFinite(f[k])) erros.push('Preencha todos os campos com números.');
  if (erros.length) return [erros[0]];
  if (!Number.isInteger(f.meses_minimo) || f.meses_minimo < 1 || f.meses_minimo > 12) erros.push('Os meses de folha da reserva vão de 1 a 12.');
  if (f.livre_atencao > f.livre_ok) erros.push('Livre disponível: o limite de atenção não pode passar do limite "ok".');
  if (f.folha_atencao < f.folha_ok) erros.push('Folha sobre a receita: o limite de atenção não pode ser menor que o "ok".');
  if (f.gasto_atencao < f.gasto_ok) erros.push('Gasto com recurso livre: o limite de atenção não pode ser menor que o "ok".');
  if (f.reserva_atencao > f.reserva_ok) erros.push('Reserva: o limite de atenção não pode passar do limite "ok".');
  if (f.exec_atencao < 0) erros.push('Execução: o limite de atenção é um percentual positivo da receita prevista.');
  return erros;
}

export interface LinhaPolitica extends Faixas {
  vigencia: string;
  situacao: 'proposta' | 'aprovada' | 'recusada';
}

/** R2: a mais recente com situação aprovada e vigência até o mês. Sem nenhuma, null. */
export function politicaVigente<T extends { vigencia: string; situacao: string; criado_em?: string }>(linhas: T[], mes: string): T | null {
  const validas = linhas.filter((l) => l.situacao === 'aprovada' && l.vigencia <= mes);
  validas.sort((a, b) => a.vigencia.localeCompare(b.vigencia) || (a.criado_em ?? '').localeCompare(b.criado_em ?? ''));
  return validas.at(-1) ?? null;
}

// ---------------------------------------------------------------------------
// Mínimo da reserva (R1)
// ---------------------------------------------------------------------------

/** N × folha média mensal, onde a folha média é o RH e encargos previstos do ano ÷ 12. Em centavos exatos. */
export function minimoDaReserva(rhAnual: number, meses: number): number {
  return Math.round((c(rhAnual) * meses) / 12) / 100;
}

/** Reserva ÷ mínimo, em %, com uma casa; sem mínimo, null. */
export function percentualDoMinimo(reserva: number, minimo: number): number | null {
  return minimo > 0 ? Math.round((reserva / minimo) * 1000) / 10 : null;
}

// ---------------------------------------------------------------------------
// Uso da reserva (R4 a R6)
// ---------------------------------------------------------------------------

export type SituacaoUso = 'pedido' | 'aprovado' | 'recusado' | 'recomposto';

export function conferirPedidoDeUso(e: { valor: number; motivo: string; prazo: string; mesPedido: string; saldoReserva: number | null }): string[] {
  const erros: string[] = [];
  if (!Number.isFinite(e.valor) || c(e.valor) <= 0) erros.push('O valor do uso da reserva precisa ser maior que zero.');
  else if (e.saldoReserva === null) erros.push('Informe os saldos do mês antes de pedir o uso da reserva.');
  else if (c(e.valor) > c(e.saldoReserva)) erros.push('O valor é maior que o saldo da reserva.');
  if (!e.motivo.trim()) erros.push('Informe o motivo do uso da reserva.');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(e.prazo)) erros.push('Informe o mês de recomposição.');
  else if (e.prazo < e.mesPedido) erros.push('O prazo de recomposição não pode ser antes do mês do pedido.');
  return erros;
}

/** R5: aprovado, ainda não recomposto e o mês atual já passou do prazo. */
export const recomposicaoVencida = (u: { situacao: string; prazo_recomposicao: string }, mesAtual: string) =>
  u.situacao === 'aprovado' && mesAtual > u.prazo_recomposicao;

// ---------------------------------------------------------------------------
// Sinais (S1 a S10)
// ---------------------------------------------------------------------------

export type SituacaoSinal = 'critico' | 'atencao' | 'ok' | 'sem_dado';
const GRAVIDADE: Record<SituacaoSinal, number> = { critico: 0, atencao: 1, ok: 2, sem_dado: 3 };

/** S9: valor exatamente na fronteira conta como a situação melhor. Maior é melhor. */
export function classificarMaior(valor: number | null, ok: number, atencao: number): SituacaoSinal {
  if (valor === null) return 'sem_dado';
  return valor >= ok ? 'ok' : valor >= atencao ? 'atencao' : 'critico';
}

/** S9: menor é melhor. */
export function classificarMenor(valor: number | null, ok: number, atencao: number): SituacaoSinal {
  if (valor === null) return 'sem_dado';
  return valor <= ok ? 'ok' : valor <= atencao ? 'atencao' : 'critico';
}

/** Fim do ano: ok ≥ fim_ok; atenção de zero até fim_ok; crítico abaixo de zero. */
export const classificarFimDoAno = (folga: number | null, f: Faixas) => classificarMaior(folga === null ? null : Math.round(folga * 100) / 100, f.fim_ok, 0);

/** S4: a diferença contra o previsto; atenção vai até −X% da receita prevista no mesmo período. */
export function classificarExecucao(diferenca: number | null, receitaPrevista: number, f: Faixas): SituacaoSinal {
  if (diferenca === null) return 'sem_dado';
  const limite = -Math.round((c(receitaPrevista) * f.exec_atencao) / 100) / 100;
  return classificarMaior(Math.round(diferenca * 100) / 100, 0, limite);
}

export const classificarFolha = (pct: number | null, f: Faixas) => classificarMenor(pct, f.folha_ok, f.folha_atencao);
export const classificarGasto = (pontos: number | null, f: Faixas) => classificarMenor(pontos, f.gasto_ok, f.gasto_atencao);
export const classificarReserva = (pct: number | null, f: Faixas) => classificarMaior(pct, f.reserva_ok, f.reserva_atencao);
export const classificarLivre = (meses: number | null, f: Faixas) => classificarMaior(meses, f.livre_ok, f.livre_atencao);

/** S1: do mais grave para o mais tranquilo (crítico, atenção, ok, sem dado); empate mantém a ordem dada. */
export function ordenarSinais<T extends { situacao: SituacaoSinal }>(sinais: T[]): T[] {
  return sinais.map((s, i) => ({ s, i })).sort((a, b) => GRAVIDADE[a.s.situacao] - GRAVIDADE[b.s.situacao] || a.i - b.i).map((x) => x.s);
}

/** S2: livre disponível ÷ gasto médio mensal com recurso livre (despesa livre ÷ meses informados). */
export function mesesDeLivre(livreDisponivel: number | null, despesaLivreTotal: number, mesesInformados: number): number | null {
  if (livreDisponivel === null || mesesInformados <= 0) return null;
  const media = despesaLivreTotal / mesesInformados;
  if (media <= 0) return null;
  return Math.round((livreDisponivel / media) * 10) / 10;
}

/** S10: dado mais velho que o mês anterior ao atual está desatualizado. */
export const desatualizado = (ate: string | null, mesAtual: string) => ate !== null && ate < mesAnterior(mesAtual);

/** S6: variação percentual de uma série contra a do ano anterior (base zero = sem dado). */
export function variacaoPercentual(atual: number, anterior: number): number | null {
  return anterior > 0 ? ((atual - anterior) / anterior) * 100 : null;
}

/** S6: em pontos percentuais, com uma casa. */
export function pontosDeGasto(despesaAtual: number, despesaAnterior: number, receitaAtual: number, receitaAnterior: number): number | null {
  const d = variacaoPercentual(despesaAtual, despesaAnterior);
  const r = variacaoPercentual(receitaAtual, receitaAnterior);
  return d === null || r === null ? null : Math.round((d - r) * 10) / 10;
}
