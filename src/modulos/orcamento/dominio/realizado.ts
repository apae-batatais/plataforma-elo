/**
 * Regras puras do realizado informado à mão (Entrega 1C.1). Nada aqui lê ou grava dados.
 */
import { mesAnterior } from './tesouraria';

export type TipoRealizado = 'despesa' | 'receita';

export const NATUREZAS_DESPESA = ['rh', 'encargos', 'custeio', 'investimento', 'tarifas', 'adiantamento_termo'] as const;
export const NATUREZAS_RECEITA = ['receita_comum', 'ressarcimento'] as const;
export type Natureza = (typeof NATUREZAS_DESPESA)[number] | (typeof NATUREZAS_RECEITA)[number];

export const ROTULO_NATUREZA: Record<Natureza, string> = {
  rh: 'Recursos humanos',
  encargos: 'Encargos',
  custeio: 'Custeio',
  investimento: 'Investimento / obras',
  tarifas: 'Tarifas',
  adiantamento_termo: 'Adiantamento a termo',
  receita_comum: 'Receita comum',
  ressarcimento: 'Ressarcimento',
};

export const naturezasDo = (tipo: TipoRealizado): readonly Natureza[] => (tipo === 'despesa' ? NATUREZAS_DESPESA : NATUREZAS_RECEITA);

/** Natureza sugerida: grupo de RH → recursos humanos; senão custeio; receita → receita comum. */
export function naturezaSugerida(tipo: TipoRealizado, grupoRh: boolean): Natureza {
  if (tipo === 'receita') return 'receita_comum';
  return grupoRh ? 'rh' : 'custeio';
}

export interface DadosLinha {
  tipo: TipoRealizado;
  servico: string | null;
  grupoId: string | null;
  fonteId: string;
  natureza: Natureza;
  valor: number;
  naoRecorrente: boolean;
  motivo: string | null;
}

/** Devolve só as mensagens que se aplicam. Vazio = linha válida (R3, R4, R6). */
export function conferirLinha(l: DadosLinha): string[] {
  const erros: string[] = [];
  if (l.tipo !== 'despesa' && l.tipo !== 'receita') return ['Tipo de linha inválido.'];
  if (!Number.isFinite(l.valor)) erros.push('Valor inválido.');
  else if (l.valor < 0) erros.push('O valor não pode ser negativo. Estorno ou devolução entra como um valor menor, com observação.');
  if (!l.fonteId) erros.push('Escolha a fonte.');
  if (!(naturezasDo(l.tipo) as readonly string[]).includes(l.natureza)) erros.push('Escolha uma natureza válida para o tipo da linha.');
  if (l.tipo === 'despesa') {
    if (!l.servico) erros.push('Escolha o serviço da despesa.');
    if (!l.grupoId) erros.push('Escolha o grupo de gasto da despesa.');
  } else if (l.servico || l.grupoId) {
    erros.push('Receita não tem serviço nem grupo.');
  }
  if (l.naoRecorrente && !(l.motivo ?? '').trim()) erros.push('Informe o motivo de a linha ser não recorrente.');
  return erros;
}

/** Chave única de uma linha (R1): mês, tipo, serviço, grupo, fonte e natureza. */
export const chaveLinha = (l: { mes: string; tipo: string; servico: string | null; grupoId: string | null; fonteId: string; natureza: string }) =>
  [l.mes, l.tipo, l.servico ?? '', l.grupoId ?? '', l.fonteId, l.natureza].join('|');

/** O mês pode ser informado: formato AAAA-MM, não futuro e dentro dos últimos 24 meses (contando o atual). */
export function mesInformavel(mes: string, atual: string): boolean {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes) || mes > atual) return false;
  let m = atual;
  for (let i = 0; i < 24; i++) {
    if (m === mes) return true;
    m = mesAnterior(m);
  }
  return false;
}

export interface TotaisMes {
  despesa: number;
  receita: number;
  resultado: number;
}

/** R7: nada é digitado; tudo é soma das linhas, em centavos exatos. */
export function totaisDoMes(linhas: { tipo: TipoRealizado; valor: number }[]): TotaisMes {
  let d = 0;
  let r = 0;
  for (const l of linhas) {
    const c = Math.round(l.valor * 100);
    if (l.tipo === 'despesa') d += c;
    else r += c;
  }
  return { despesa: d / 100, receita: r / 100, resultado: (r - d) / 100 };
}

/** Diferença para o previsto em %, ou null sem previsto. */
export function diferencaPercentual(realizado: number, previsto: number): number | null {
  if (!previsto) return null;
  return Math.round(((realizado - previsto) / previsto) * 1000) / 10;
}

/** R11: o último mês fechado (o anterior ao atual) sem nenhuma linha informada, ou null. */
export function mesPendente(mesesComLinha: Set<string>, atual: string): string | null {
  const alvo = mesAnterior(atual);
  return mesesComLinha.has(alvo) ? null : alvo;
}

/** R12: compara só os meses informados nos dois anos; mês sem dado em qualquer um é null, nunca zero. */
export function compararAnos(
  atual: Record<string, number | null>,
  anterior: Record<string, number | null>,
): { mes: number; atual: number | null; anterior: number | null; diferenca: number | null }[] {
  return Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0');
    const a = atual[m] ?? null;
    const b = anterior[m] ?? null;
    return { mes: i + 1, atual: a, anterior: b, diferenca: a !== null && b !== null ? Math.round((a - b) * 100) / 100 : null };
  });
}

/** R13: um ano com realizado no app usa o realizado, não a importação do Histórico (1E). */
export const anoUsaRealizado = (anosComRealizado: Set<number>, ano: number) => anosComRealizado.has(ano);
