/**
 * Regras puras do Painel de execução e dos Recursos livres (Entrega 1C.2). Nada aqui lê ou grava dados.
 * Valores em reais com duas casas; as somas são feitas em centavos.
 */

/** Dias em aberto acima dos quais o adiantamento ganha a etiqueta "Atenção" (indicador adiantamentos_em_aberto). */
export const LIMITE_DIAS_ADIANTAMENTO = 60;

/** Nome usado para despesa sem serviço (decisão de 05/11/2026). */
export const SERVICO_COMUM = 'Comum';

const centavos = (v: number) => Math.round(v * 100);
const emReais = (c: number) => c / 100;

/** R7: soma em centavos exatos. */
export const somar = (valores: number[]) => emReais(valores.reduce((s, v) => s + centavos(v), 0));

/** R2: realizado ÷ previsto em %, uma casa decimal; sem previsto não há execução (null, nunca 0% nem infinito). */
export function execucaoPercentual(realizado: number, previsto: number): number | null {
  if (!previsto) return null;
  return Math.round((realizado / previsto) * 1000) / 10;
}

export interface PeriodoExecucao {
  /** Meses (AAAA-MM) do período, em ordem. */
  meses: string[];
  /** Meses do período sem nenhuma linha informada ("sem dado"): ficam fora das somas dos dois lados. */
  semDado: string[];
  /** Meses do período que contam (informados). */
  contam: string[];
}

/**
 * R3: período padrão = janeiro até o último mês informado; um mês escolhido vale sozinho.
 * Sem nenhum mês informado, o período é vazio.
 */
export function periodoDaExecucao(ano: number, informados: Set<string>, mesEscolhido?: string | null): PeriodoExecucao {
  const doAno = [...informados].filter((m) => m.startsWith(`${ano}-`)).sort();
  let meses: string[];
  if (mesEscolhido && mesEscolhido.startsWith(`${ano}-`)) meses = [mesEscolhido];
  else if (doAno.length === 0) meses = [];
  else {
    const ultimo = Number(doAno[doAno.length - 1].slice(5));
    meses = Array.from({ length: ultimo }, (_, i) => `${ano}-${String(i + 1).padStart(2, '0')}`);
  }
  return { meses, semDado: meses.filter((m) => !informados.has(m)), contam: meses.filter((m) => informados.has(m)) };
}

export interface AdiantamentoMes {
  /** AAAA-MM do adiantamento. */
  mes: string;
  valor: number;
}

export interface SaldoDoTermo {
  adiantado: number;
  ressarcido: number;
  /** adiantado − ressarcido (negativo = ressarcido a mais). */
  emAberto: number;
  ressarcidoAMais: boolean;
  /** Mês do adiantamento mais antigo ainda em aberto (primeiro a entrar, primeiro a sair), ou null. */
  maisAntigoMes: string | null;
}

/** R5: baixa o ressarcimento do adiantamento mais antigo para o mais novo. */
export function saldoDoTermo(adiantamentos: AdiantamentoMes[], ressarcido: number): SaldoDoTermo {
  const ordenados = [...adiantamentos].sort((a, b) => a.mes.localeCompare(b.mes));
  let sobra = centavos(ressarcido);
  let maisAntigo: string | null = null;
  let aberto = 0;
  for (const a of ordenados) {
    const v = centavos(a.valor);
    const baixa = Math.min(v, Math.max(sobra, 0));
    sobra -= baixa;
    const resto = v - baixa;
    if (resto > 0) {
      aberto += resto;
      if (!maisAntigo) maisAntigo = a.mes;
    }
  }
  const adiantado = ordenados.reduce((s, a) => s + centavos(a.valor), 0);
  const emAberto = adiantado - centavos(ressarcido);
  return { adiantado: emReais(adiantado), ressarcido: emReais(centavos(ressarcido)), emAberto: emReais(emAberto), ressarcidoAMais: emAberto < 0, maisAntigoMes: aberto > 0 ? maisAntigo : null };
}

/** Último dia do mês AAAA-MM, como AAAA-MM-DD. */
export function fimDoMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}

/** R5: dias entre o fim do mês do adiantamento e hoje (AAAA-MM-DD); nunca negativo. */
export function diasEmAberto(mes: string, hoje: string): number {
  const dias = Math.round((Date.parse(hoje) - Date.parse(fimDoMes(mes))) / 86_400_000);
  return Math.max(dias, 0);
}

export const adiantamentoEmAtencao = (dias: number) => dias > LIMITE_DIAS_ADIANTAMENTO;

export interface MesAnoAnterior {
  mes: number;
  atual: number | null;
  anterior: number | null;
}

/** R6: só entram os meses informados nos dois anos; os demais ficam de fora (null). */
export function mesesComparaveis(atual: Record<string, number | null>, anterior: Record<string, number | null>): MesAnoAnterior[] {
  return Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0');
    const a = atual[m] ?? null;
    const b = anterior[m] ?? null;
    return a !== null && b !== null ? { mes: i + 1, atual: a, anterior: b } : { mes: i + 1, atual: null, anterior: null };
  });
}

/** Variação em % de um ano contra o outro; null sem base. */
export function variacaoPercentual(atual: number, anterior: number): number | null {
  if (!anterior) return null;
  return Math.round(((atual - anterior) / Math.abs(anterior)) * 1000) / 10;
}
