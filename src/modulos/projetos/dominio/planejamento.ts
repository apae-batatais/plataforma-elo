/**
 * Planejamento do projeto (entrega P3): atividades com datas e responsável, e o orçamento do projeto.
 * Regras puras, sem leitura nem gravação. Datas são texto AAAA-MM-DD.
 */
import { ErroProjetos } from './projeto';

export const SITUACOES_ATIVIDADE = ['a_fazer', 'em_andamento', 'concluida', 'cancelada'] as const;
export type SituacaoAtividade = (typeof SITUACOES_ATIVIDADE)[number];
/** `atrasada` não é gravada: é calculada (regra 20). */
export type SituacaoExibida = SituacaoAtividade | 'atrasada';
export const NOME_SITUACAO_ATIVIDADE: Record<SituacaoExibida, string> = {
  a_fazer: 'A fazer',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
  atrasada: 'Atrasada',
};

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Aceita só uma data de calendário válida (AAAA-MM-DD). */
export function dataValida(v: string): boolean {
  if (!DATA.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export const hojeEm = (agora: Date): string => agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

/** Regra 20: fim previsto passado e atividade ainda aberta (a fazer ou em andamento). */
export function estaAtrasada(a: { situacao: SituacaoAtividade; fim_previsto: string }, hoje: string): boolean {
  return (a.situacao === 'a_fazer' || a.situacao === 'em_andamento') && a.fim_previsto < hoje;
}

export function situacaoExibida(a: { situacao: SituacaoAtividade; fim_previsto: string }, hoje: string): SituacaoExibida {
  return estaAtrasada(a, hoje) ? 'atrasada' : a.situacao;
}

export interface DadosPlanoAtividade {
  descricao: string;
  responsavel: string;
  inicioPrevisto: string;
  fimPrevisto: string;
  /** Peso no andamento do projeto (opcional, maior que zero). */
  peso: number | null;
}

/** Confere descrição, responsável, datas previstas e peso. Devolve os valores limpos. */
export function conferirPlanoAtividade(d: DadosPlanoAtividade): DadosPlanoAtividade {
  const descricao = d.descricao.trim();
  if (!descricao) throw new ErroProjetos('Descreva a atividade.');
  const responsavel = d.responsavel.trim().toLowerCase();
  if (!responsavel) throw new ErroProjetos('Diga quem é a pessoa responsável pela atividade.');
  if (!dataValida(d.inicioPrevisto)) throw new ErroProjetos('Informe a data prevista de início.');
  if (!dataValida(d.fimPrevisto)) throw new ErroProjetos('Informe a data prevista de fim.');
  if (d.fimPrevisto < d.inicioPrevisto) throw new ErroProjetos('O fim previsto não pode ser antes do início previsto.');
  if (d.peso !== null && (!Number.isFinite(d.peso) || d.peso <= 0)) throw new ErroProjetos('O peso, se informado, precisa ser maior que zero.');
  return { descricao, responsavel, inicioPrevisto: d.inicioPrevisto, fimPrevisto: d.fimPrevisto, peso: d.peso };
}

export interface DadosAndamento {
  situacao: SituacaoAtividade;
  inicioReal: string | null;
  fimReal: string | null;
}

/** Regra 20: concluir exige a data real de fim; datas reais não podem estar no futuro nem se contradizer. */
export function conferirAndamento(d: DadosAndamento, hoje: string): DadosAndamento {
  if (!(SITUACOES_ATIVIDADE as readonly string[]).includes(d.situacao)) throw new ErroProjetos('Escolha a situação da atividade.');
  const inicioReal = d.inicioReal?.trim() || null;
  const fimReal = d.fimReal?.trim() || null;
  if (inicioReal && !dataValida(inicioReal)) throw new ErroProjetos('A data real de início não é válida.');
  if (fimReal && !dataValida(fimReal)) throw new ErroProjetos('A data real de fim não é válida.');
  if (d.situacao === 'concluida' && !fimReal) throw new ErroProjetos('Para concluir a atividade, informe a data real de fim.');
  if (d.situacao !== 'concluida' && fimReal) throw new ErroProjetos('A data real de fim só vale para atividade concluída.');
  if (inicioReal && inicioReal > hoje) throw new ErroProjetos('A data real de início não pode estar no futuro.');
  if (fimReal && fimReal > hoje) throw new ErroProjetos('A data real de fim não pode estar no futuro.');
  if (inicioReal && fimReal && fimReal < inicioReal) throw new ErroProjetos('O fim real não pode ser antes do início real.');
  return { situacao: d.situacao, inicioReal, fimReal };
}

/** Andamento do projeto pelo peso das atividades (sem peso, cada uma vale 1). Canceladas não contam. Resultado de 0 a 100. */
export function andamentoPercentual(atividades: readonly { situacao: SituacaoAtividade; peso: number | null }[]): number | null {
  const validas = atividades.filter((a) => a.situacao !== 'cancelada');
  const total = validas.reduce((s, a) => s + (a.peso ?? 1), 0);
  if (total === 0) return null;
  const feito = validas.filter((a) => a.situacao === 'concluida').reduce((s, a) => s + (a.peso ?? 1), 0);
  return Math.round((feito / total) * 100);
}

export interface DadosLinhaOrcamento {
  categoria: string;
  descricao: string;
  valorPlanejado: number;
  fonte: string | null;
}

/** Confere a linha do orçamento do projeto: categoria, descrição e valor igual ou maior que zero. */
export function conferirLinhaOrcamento(d: DadosLinhaOrcamento): DadosLinhaOrcamento {
  const categoria = d.categoria.trim();
  const descricao = d.descricao.trim();
  if (!categoria) throw new ErroProjetos('Informe a categoria da linha (ex.: pessoal, materiais, serviços).');
  if (!descricao) throw new ErroProjetos('Descreva a linha do orçamento.');
  if (!Number.isFinite(d.valorPlanejado) || d.valorPlanejado < 0) throw new ErroProjetos('O valor planejado precisa ser um número igual ou maior que zero.');
  return { categoria, descricao, valorPlanejado: Math.round(d.valorPlanejado * 100) / 100, fonte: d.fonte?.trim() || null };
}

/** Soma das linhas, em centavos para não acumular erro de arredondamento. */
export const totalOrcamento = (linhas: readonly { valor_planejado: number }[]): number => linhas.reduce((s, l) => s + Math.round(l.valor_planejado * 100), 0) / 100;
