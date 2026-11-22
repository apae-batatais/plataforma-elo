/**
 * Fase 5 (entrega P5): check-list de encerramento, relatório final, lições aprendidas e atraso.
 * Regras puras, sem leitura nem gravação.
 */
import { diasEntre } from './acompanhamento';
import type { Etapa } from './projeto';

/** Itens do check-list (regra 23): contratual, financeiro e administrativo. */
export const ITENS_CHECKLIST = ['contratual', 'financeiro', 'administrativo'] as const;
/** Textos do encerramento: o relatório final é obrigatório; transição e sustentabilidade são opcionais. */
export const ITENS_TEXTO = ['relatorio_final', 'transicao', 'sustentabilidade'] as const;
export const ITENS_ENCERRAMENTO = [...ITENS_CHECKLIST, ...ITENS_TEXTO] as const;
export type ItemEncerramento = (typeof ITENS_ENCERRAMENTO)[number];
export type ItemChecklist = (typeof ITENS_CHECKLIST)[number];
export type ItemTexto = (typeof ITENS_TEXTO)[number];

export const NOME_ITEM_ENCERRAMENTO: Record<ItemEncerramento, string> = {
  contratual: 'Contratual: contratos, termos e compromissos com terceiros encerrados',
  financeiro: 'Financeiro: gastos conferidos e saldo ou devolução resolvidos',
  administrativo: 'Administrativo: documentos guardados e acessos retirados',
  relatorio_final: 'Relatório final',
  transicao: 'Transição: quem continua o que o projeto deixou',
  sustentabilidade: 'Sustentabilidade: o que mantém os resultados depois do projeto',
};

export const CATEGORIAS_LICAO = ['planejamento', 'execucao', 'financeiro', 'pessoas', 'parceiros', 'outra'] as const;
export type CategoriaLicao = (typeof CATEGORIAS_LICAO)[number];
export const NOME_CATEGORIA_LICAO: Record<CategoriaLicao, string> = {
  planejamento: 'Planejamento',
  execucao: 'Execução',
  financeiro: 'Financeiro',
  pessoas: 'Pessoas',
  parceiros: 'Parceiros',
  outra: 'Outra',
};

/** Prazo padrão, em dias, para concluir a fase 5 antes de o projeto aparecer como atrasado (regra 25). */
export const DIAS_ENCERRAMENTO_PADRAO = 30;

/** Etapas em que se registra lição: o projeto em implementação, em encerramento, parado ou cancelado. */
export const ETAPAS_COM_LICAO: ReadonlySet<Etapa> = new Set<Etapa>(['implementacao', 'encerramento', 'parado', 'cancelado']);

/** Regra 23: o que falta para abrir a porta de encerramento (lista vazia = pronto). */
export function faltaParaEncerrar(e: {
  atividadesAbertas: number;
  problemasAbertos: number;
  checklistFaltando: ItemChecklist[];
  temRelatorioFinal: boolean;
  licoes: number;
}): string[] {
  const falta: string[] = [];
  if (e.atividadesAbertas > 0) falta.push(`${e.atividadesAbertas} ${e.atividadesAbertas === 1 ? 'atividade ainda não foi concluída nem cancelada' : 'atividades ainda não foram concluídas nem canceladas'}`);
  if (e.problemasAbertos > 0) falta.push(`${e.problemasAbertos} ${e.problemasAbertos === 1 ? 'problema ainda sem solução' : 'problemas ainda sem solução'}`);
  for (const i of e.checklistFaltando) falta.push(`Check-list: ${NOME_ITEM_ENCERRAMENTO[i].split(':')[0].toLowerCase()}`);
  if (!e.temRelatorioFinal) falta.push('Relatório final');
  if (e.licoes < 1) falta.push('Pelo menos uma lição aprendida');
  return falta;
}

/**
 * Regra 25: em implementação com o fim previsto vencido, ou em encerramento há mais dias que o configurado.
 * Devolve o motivo em palavras, ou null se não está atrasado.
 */
export function encerramentoAtrasado(
  p: { etapa: Etapa; fim_previsto: string | null; encerramento_iniciado_em: string | null },
  hoje: string,
  limiteDias: number = DIAS_ENCERRAMENTO_PADRAO,
): string | null {
  if (p.etapa === 'implementacao' && p.fim_previsto && p.fim_previsto < hoje) {
    const d = diasEntre(p.fim_previsto, hoje);
    return `O fim previsto passou há ${d} ${d === 1 ? 'dia' : 'dias'} e o projeto ainda não entrou em encerramento.`;
  }
  if (p.etapa === 'encerramento' && p.encerramento_iniciado_em) {
    const d = diasEntre(p.encerramento_iniciado_em, hoje);
    if (d > limiteDias) return `O encerramento começou há ${d} dias (o combinado é até ${limiteDias}).`;
  }
  return null;
}

export interface FiltroLicoes {
  categoria?: CategoriaLicao | null;
  tipo?: string | null;
  porte?: string | null;
  texto?: string | null;
}

/** Regra 24: filtros da consulta; o texto procura sem diferenciar maiúsculas e acentos. */
export function licaoCombina(l: { categoria: CategoriaLicao; o_que_aconteceu: string; fazer_diferente: string }, projeto: { tipo: string; porte: string }, f: FiltroLicoes): boolean {
  if (f.categoria && l.categoria !== f.categoria) return false;
  if (f.tipo && projeto.tipo !== f.tipo) return false;
  if (f.porte && projeto.porte !== f.porte) return false;
  const t = semAcento(f.texto ?? '');
  if (t && !semAcento(`${l.o_que_aconteceu} ${l.fazer_diferente}`).includes(t)) return false;
  return true;
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
