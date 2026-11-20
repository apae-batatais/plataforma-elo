/**
 * Instrumento do Centro Especializado em Reabilitação (CER), eixo Saúde.
 * É um DADO do motor de avaliação (versão 1), não código do motor: texto, dimensão e
 * etiqueta CIF de cada item exatamente como no documento validado pela Diretoria.
 * Depois de usado, não muda: alterar cria nova versão (ADR-007).
 */
import { definirInstrumento, type Instrumento } from '@/capacidades/motor-avaliacao';

export const CODIGO_CER = 'cer';
/** Área do cadastro cujos serviços usam este app. */
export const AREA_SAUDE = 'saude';
/** Reavaliação a cada 12 meses (decisão técnica; ver especificação). */
export const MESES_ENTRE_AVALIACOES = 12;

export const DOMINIOS_CER = {
  evolucao: 'Evolução',
  adequacao: 'Adequação',
  barreira: 'Barreira',
} as const;

export const INSTRUMENTO_CER: Instrumento = definirInstrumento({
  codigo: CODIGO_CER,
  versao: 1,
  eixo: 'saude',
  nome: 'Centro Especializado em Reabilitação (CER) — Saúde',
  dominios: Object.entries(DOMINIOS_CER).map(([codigo, nome]) => ({ codigo, nome })),
  itens: [
    { numero: 1, texto: 'Evolução da funcionalidade motora', dominio: 'evolucao', etiqueta: 'b7/s7' },
    { numero: 2, texto: 'Evolução em atividades e participação (tarefas cotidianas da reabilitação)', dominio: 'evolucao', etiqueta: 'd2' },
    { numero: 3, texto: 'Evolução em habilidades de comunicação/cognição', dominio: 'evolucao', etiqueta: 'd3/b1' },
    { numero: 4, texto: 'Adesão e resposta terapêutica às intervenções', dominio: 'evolucao', etiqueta: 'd2/b1' },
    { numero: 5, texto: 'Adequação do plano terapêutico ao quadro clínico atual', dominio: 'adequacao', etiqueta: 'e5' },
    { numero: 6, texto: 'Adequação do nível de complexidade do CER (média/alta) ao estágio atual', dominio: 'adequacao', etiqueta: 'e5' },
    { numero: 7, texto: 'Frequência e assiduidade às sessões terapêuticas', dominio: 'barreira', etiqueta: 'e5' },
    { numero: 8, texto: 'Estabilidade clínica geral (intercorrências, comorbidades, hospitalizações)', dominio: 'barreira', etiqueta: 'b/s' },
    { numero: 9, texto: 'Suporte familiar para continuidade do tratamento fora do CER', dominio: 'barreira', etiqueta: 'e3' },
    { numero: 10, texto: 'Barreiras de transporte/acesso geográfico', dominio: 'barreira', etiqueta: 'e1' },
  ],
  faixas: [
    { nome: 'Não evoluindo / serviço potencialmente inadequado', de: 0, ate: 10 },
    { nome: 'Evolução parcial / sinais de estagnação', de: 11, ate: 20 },
    { nome: 'Evoluindo adequadamente', de: 21, ate: 30 },
  ],
});

/** Número do item de frequência (faixas objetivas). */
export const ITEM_FREQUENCIA = 7;

/** Legenda geral dos níveis (o documento não traz o texto de cada nota por item). */
export const LEGENDA_NIVEIS = [
  { nota: 0, evolucao: 'Nenhuma evolução ou adequação', barreira: 'Barreira severa' },
  { nota: 1, evolucao: 'Evolução ou adequação mínima', barreira: 'Barreira importante' },
  { nota: 2, evolucao: 'Evolução ou adequação parcial', barreira: 'Barreira leve' },
  { nota: 3, evolucao: 'Evolução ou adequação plena', barreira: 'Barreira ausente' },
] as const;

/** Faixas de frequência do item 7 (percentual das sessões do período). */
export const FAIXAS_FREQUENCIA = ['menos de 40%', '40 a 59%', '60 a 79%', '80% ou mais'] as const;

/** Sugere a nota do item 7 pelo percentual de frequência (0 a 100). Devolve null se o percentual não vale. */
export function notaDaFrequencia(percentual: number): 0 | 1 | 2 | 3 | null {
  if (!Number.isFinite(percentual) || percentual < 0 || percentual > 100) return null;
  if (percentual < 40) return 0;
  if (percentual < 60) return 1;
  if (percentual < 80) return 2;
  return 3;
}

/** Orientação mostrada junto da faixa (leitura do enquadramento, não é norma). */
export const ENCAMINHAMENTO_POR_FAIXA: Record<string, string> = {
  'Evoluindo adequadamente': 'A reabilitação segue no ritmo esperado. Mantenha o plano e reavalie no prazo.',
  'Evolução parcial / sinais de estagnação': 'Há sinais de estagnação. Revise o plano terapêutico com a equipe e olhe as barreiras.',
  'Não evoluindo / serviço potencialmente inadequado': 'A pessoa não está evoluindo. Discuta com a coordenação técnica se o serviço ainda é o adequado.',
};

export class ErroSaude extends Error {}

const ehData = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`));

export interface DadosPeriodo {
  periodoInicio: string;
  periodoFim: string;
  dataIngresso: string;
}

/** Regra 7: período com início ≤ fim, fim e ingresso não futuros. Devolve o motivo da recusa ou null. */
export function recusaDePeriodo(d: DadosPeriodo, hoje: string): string | null {
  if (![d.periodoInicio, d.periodoFim, d.dataIngresso].every(ehData)) return 'Informe o início e o fim do período e a data de ingresso.';
  if (d.periodoInicio > d.periodoFim) return 'O início do período não pode ser depois do fim.';
  if (d.periodoFim > hoje) return 'O fim do período não pode ser no futuro.';
  if (d.dataIngresso > hoje) return 'A data de ingresso não pode ser no futuro.';
  return null;
}

export const DIAS_AVISO_REAVALIACAO = 30;

export type SituacaoReavaliacao = 'em_dia' | 'vence_em_breve' | 'atrasada';

/** Regra 12: situação da reavaliação a partir do dia do vencimento (AAAA-MM-DD) e de hoje. */
export function situacaoDaReavaliacao(vence: string, hoje: string): { situacao: SituacaoReavaliacao; dias: number } {
  const dias = Math.round((Date.parse(`${vence}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) / 86_400_000);
  return { dias, situacao: dias < 0 ? 'atrasada' : dias <= DIAS_AVISO_REAVALIACAO ? 'vence_em_breve' : 'em_dia' };
}
