/**
 * Regras puras do app Educação (sem planilha, tela ou permissão): subtotais por dimensão, principal
 * barreira, nota sugerida pela frequência, conferência de datas e sugestão do instrumento.
 * O cálculo do total e das faixas é do motor (`src/capacidades/motor-avaliacao`).
 */
import {
  calcularEscore,
  dominiosDeMenorPercentual,
  VALOR_MAXIMO,
  VALOR_MINIMO,
  type Escore,
  type Instrumento,
  type Respostas,
} from '@/capacidades/motor-avaliacao';

export class ErroEducacao extends Error {}

/** O item de frequência e assiduidade é o 7º nos três instrumentos. */
export const ITEM_FREQUENCIA = 7;

/** Legenda geral das notas (decisão 3 da especificação); em Barreira, nota alta = barreira ausente. */
export const LEGENDA_NOTAS: Record<'evolucao' | 'adequacao' | 'barreira', readonly [string, string, string, string]> = {
  evolucao: ['0 · nenhuma evolução', '1 · pouca evolução', '2 · evolução parcial', '3 · evolução plena'],
  adequacao: ['0 · nenhuma adequação', '1 · pouca adequação', '2 · adequação parcial', '3 · adequação plena'],
  barreira: ['0 · barreira severa', '1 · barreira importante', '2 · barreira leve', '3 · barreira ausente'],
};

export const LEGENDA_FREQUENCIA = ['0 · menos de 40%', '1 · de 40% a 59%', '2 · de 60% a 79%', '3 · 80% ou mais'] as const;

/** Sugere a nota do item 7 pelo percentual de frequência (0 a 100); null se não for um percentual válido. */
export function notaDeFrequencia(percentual: number): number | null {
  if (!Number.isFinite(percentual) || percentual < 0 || percentual > 100) return null;
  if (percentual < 40) return 0;
  if (percentual < 60) return 1;
  if (percentual < 80) return 2;
  return 3;
}

export interface Subtotal {
  codigo: string;
  nome: string;
  pontos: number;
  maximo: number;
  percentual: number | null;
}

export interface Resultado {
  total: number;
  maximo: number;
  subtotais: Subtotal[];
  /** Nome da faixa do total; null se faltar item ou se o total não cair em faixa. */
  faixa: string | null;
  completo: boolean;
  /** Dimensão(ões) de menor percentual do máximo (a "principal barreira"); em empate, todas. */
  principalBarreira: string[];
}

/** Total, subtotais, faixa e principal barreira, sempre calculados na leitura. */
export function resultadoDe(instrumento: Instrumento, respostas: Respostas): Resultado {
  const escore: Escore = calcularEscore(instrumento, respostas);
  return {
    total: escore.total,
    maximo: escore.maximo,
    subtotais: escore.dominios.map((d) => ({ codigo: d.codigo, nome: d.nome, pontos: d.pontos, maximo: d.maximo, percentual: d.percentual })),
    faixa: escore.enquadramento?.nome ?? null,
    completo: escore.completo,
    principalBarreira: escore.completo ? dominiosDeMenorPercentual(escore).map((d) => d.nome) : [],
  };
}

/** Confere as respostas de um rascunho: inteiros de 0 a 3 em itens que existem. */
export function respostasValidas(instrumento: Instrumento, bruto: Record<string, unknown>): Respostas {
  const r: Respostas = {};
  for (const [chave, valor] of Object.entries(bruto)) {
    if (valor === undefined || valor === null || valor === '') continue;
    const numero = Number(chave);
    if (!instrumento.itens.some((i) => i.numero === numero)) throw new ErroEducacao(`O item ${chave} não existe neste instrumento.`);
    const v = Number(valor);
    if (!Number.isInteger(v) || v < VALOR_MINIMO || v > VALOR_MAXIMO) {
      throw new ErroEducacao(`A resposta do item ${numero} deve ser um número inteiro de ${VALOR_MINIMO} a ${VALOR_MAXIMO}.`);
    }
    r[numero] = v;
  }
  return r;
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Regra 7: período com início ≤ fim e fim não futuro; ingresso não futuro. Devolve o motivo da recusa ou null. */
export function recusaDeDatas(d: { periodoInicio?: string | null; periodoFim?: string | null; dataIngresso?: string | null }, hoje: string): string | null {
  for (const [nome, v] of [['O início do período', d.periodoInicio], ['O fim do período', d.periodoFim], ['A data de ingresso', d.dataIngresso]] as const) {
    if (v && !DATA.test(v)) return `${nome} precisa ser uma data válida.`;
  }
  if (d.periodoInicio && d.periodoFim && d.periodoInicio > d.periodoFim) return 'O início do período não pode ser depois do fim.';
  if (d.periodoFim && d.periodoFim > hoje) return 'O fim do período não pode estar no futuro.';
  if (d.periodoInicio && d.periodoInicio > hoje) return 'O início do período não pode estar no futuro.';
  if (d.dataIngresso && d.dataIngresso > hoje) return 'A data de ingresso não pode estar no futuro.';
  return null;
}

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Sugere o instrumento pelo nome do serviço; null quando o nome não indica (a pessoa escolhe). */
export function instrumentoSugerido(nomeDoServico: string): string | null {
  const n = semAcento(nomeDoServico);
  if (n.includes('infantil')) return 'educacao_infantil';
  if (n.includes('fundamental')) return 'ensino_fundamental';
  if (n.includes('trabalho')) return 'educacao_trabalho';
  return null;
}

export const DIAS_AVISO_REAVALIACAO = 30;

export type SituacaoReavaliacao = 'em_dia' | 'vence_em_breve' | 'atrasada';

/** Regra 13: situação da reavaliação a partir do dia do vencimento (AAAA-MM-DD) e de hoje. */
export function situacaoDaReavaliacao(vence: string, hoje: string): { situacao: SituacaoReavaliacao; dias: number } {
  const dias = Math.round((Date.parse(`${vence}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) / 86_400_000);
  return { dias, situacao: dias < 0 ? 'atrasada' : dias <= DIAS_AVISO_REAVALIACAO ? 'vence_em_breve' : 'em_dia' };
}
