/**
 * Indicadores do marco lógico com número vindo do cadastro (ligações, onda 2, entrega L4).
 * Regras puras: fontes oferecidas, situação contra a meta e frases. O mínimo de 5 pessoas é aplicado na
 * origem (Núcleo e Avaliação); aqui só se lê `valor`, `base` e `motivo`.
 */
export const FONTES_NUMERO = ['manual', 'vinculos_ativos', 'indice_cuidado', 'reavaliacao_em_dia'] as const;
export type FonteNumero = (typeof FONTES_NUMERO)[number];

export const NOME_FONTE_NUMERO: Record<FonteNumero, string> = {
  manual: 'Digitado à mão',
  vinculos_ativos: 'Pessoas com vínculo ativo no serviço',
  indice_cuidado: 'Índice médio de necessidade de cuidado do serviço',
  reavaliacao_em_dia: '% de pessoas com reavaliação em dia',
};

export const MOTIVOS_SEM_NUMERO = ['poucos_casos', 'sem_dados', 'indisponivel'] as const;
export type MotivoMedicao = (typeof MOTIVOS_SEM_NUMERO)[number];

export const ORIGENS_MEDICAO = ['relatorio', 'encerramento', 'manual'] as const;
export type OrigemMedicao = (typeof ORIGENS_MEDICAO)[number];

export const NOME_ORIGEM: Record<OrigemMedicao, string> = {
  relatorio: 'Relatório de monitoramento',
  encerramento: 'Encerramento do projeto',
  manual: 'Medição registrada',
};

export const ehFonteAutomatica = (f: FonteNumero): boolean => f !== 'manual';

export type SituacaoDaMeta = 'dentro' | 'abaixo';

/** Regra L6: sem meta, sem número ("poucos casos", "sem dados") ou sem leitura, a situação não é calculada. */
export function situacaoDaMeta(valor: number | null, meta: number | null): SituacaoDaMeta | null {
  if (valor === null || meta === null) return null;
  return valor >= meta ? 'dentro' : 'abaixo';
}

/** Percentual só na fonte de reavaliação. */
export const ehPercentual = (f: FonteNumero): boolean => f === 'reavaliacao_em_dia';

const num = (v: number) => v.toLocaleString('pt-BR');

/** Frase do número, por fonte. Nunca recebe valor quando há motivo (poucos casos). */
export function fraseDoNumero(f: FonteNumero, valor: number): string {
  if (f === 'vinculos_ativos') return `${num(valor)} ${valor === 1 ? 'pessoa com vínculo ativo' : 'pessoas com vínculo ativo'}`;
  if (f === 'indice_cuidado') return `Índice médio de ${num(valor)}`;
  if (f === 'reavaliacao_em_dia') return `${num(valor)}% das pessoas com reavaliação em dia`;
  return num(valor);
}

export const TEXTO_MOTIVO: Record<MotivoMedicao, string> = {
  poucos_casos: 'Poucos casos para divulgar (menos de 5 pessoas)',
  sem_dados: 'Sem dados ainda',
  indisponivel: 'Ligação indisponível; informe à mão, se quiser',
};
