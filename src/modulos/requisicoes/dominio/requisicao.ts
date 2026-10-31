/**
 * Regras puras das requisições: situações, caminho entre elas, centros de
 * custo (percentuais), itens, campos de cada formulário e quem aprova.
 * Nada aqui lê nem grava planilhas.
 */
import { z } from 'zod';

export const CATEGORIAS = ['material', 'servico'] as const;
export type Categoria = (typeof CATEGORIAS)[number];

/** Fichas disponíveis. Cada tipo de requisição usa uma. Novas entram uma por entrega. */
export const FORMULARIOS = ['materiais'] as const;
export type Formulario = (typeof FORMULARIOS)[number];
export const NOME_FORMULARIO: Record<Formulario, string> = { materiais: 'Materiais (itens, retirada ou entrega, evento)' };

export const SITUACOES = ['enviada', 'devolvida', 'aprovada', 'recusada', 'em_atendimento', 'atendida', 'atendida_parcial', 'cancelada'] as const;
export type Situacao = (typeof SITUACOES)[number];
export const NOME_SITUACAO: Record<Situacao, string> = {
  enviada: 'Aguardando aprovação',
  devolvida: 'Devolvida para ajuste',
  aprovada: 'Aprovada, na fila do setor',
  recusada: 'Recusada',
  em_atendimento: 'Em atendimento',
  atendida: 'Atendida',
  atendida_parcial: 'Atendida em parte',
  cancelada: 'Cancelada',
};
export const SITUACOES_ENCERRADAS: readonly Situacao[] = ['recusada', 'atendida', 'atendida_parcial', 'cancelada'];

export type Acao = 'enviar' | 'reenviar' | 'aprovar' | 'devolver' | 'recusar' | 'cancelar' | 'receber' | 'concluir';
export const NOME_ACAO: Record<Acao, string> = {
  enviar: 'Enviou',
  reenviar: 'Ajustou e reenviou',
  aprovar: 'Aprovou',
  devolver: 'Devolveu para ajuste',
  recusar: 'Recusou',
  cancelar: 'Cancelou',
  receber: 'Recebeu para atender',
  concluir: 'Concluiu o atendimento',
};

/** De quais situações cada ação pode partir. */
const ORIGEM: Record<Acao, readonly (Situacao | null)[]> = {
  enviar: [null],
  reenviar: ['devolvida'],
  aprovar: ['enviada'],
  devolver: ['enviada'],
  recusar: ['enviada'],
  cancelar: ['enviada', 'devolvida'],
  receber: ['aprovada'],
  concluir: ['em_atendimento'],
};

export class ErroRequisicao extends Error {}

export function conferirTransicao(acao: Acao, atual: Situacao | null) {
  if (!ORIGEM[acao].includes(atual)) {
    throw new ErroRequisicao(`Não dá para ${acao} uma requisição ${atual ? `que está "${NOME_SITUACAO[atual].toLowerCase()}"` : 'nova'}. Recarregue a página para ver a situação atual.`);
  }
}

// ---------------------------------------------------------------------------
// Centros de custo e itens
// ---------------------------------------------------------------------------

export interface Centro {
  servico: string;
  percentual: number;
}

const centesimos = (v: number) => Math.round(v * 100);

export function conferirCentros(centros: Centro[]): string[] {
  const erros: string[] = [];
  if (centros.length === 0) erros.push('Informe pelo menos um centro de custo.');
  const vistos = new Set<string>();
  for (const c of centros) {
    if (!c.servico) erros.push('Escolha o serviço em todas as linhas de centro de custo.');
    else if (vistos.has(c.servico)) erros.push('Um centro de custo aparece mais de uma vez.');
    vistos.add(c.servico);
    if (!Number.isFinite(c.percentual) || c.percentual <= 0 || c.percentual > 100) erros.push('Cada percentual deve ser maior que 0 e no máximo 100.');
  }
  const soma = centros.reduce((s, c) => s + centesimos(Number.isFinite(c.percentual) ? c.percentual : 0), 0) / 100;
  if (centros.length > 0 && soma !== 100) erros.push(`Os centros de custo somam ${soma.toLocaleString('pt-BR')}%; precisam somar 100%.`);
  return [...new Set(erros)];
}

export interface ItemPedido {
  quantidade: number;
  unidade: string;
  descricao: string;
}

export function conferirItens(itens: ItemPedido[]): string[] {
  const erros: string[] = [];
  if (itens.length === 0) erros.push('Inclua pelo menos um item.');
  for (const [i, x] of itens.entries()) {
    if (!x.descricao.trim()) erros.push(`Item ${i + 1}: descreva o item.`);
    if (!x.unidade.trim()) erros.push(`Item ${i + 1}: informe a unidade (un, kg, L, pacote…).`);
    if (!Number.isFinite(x.quantidade) || x.quantidade <= 0) erros.push(`Item ${i + 1}: a quantidade precisa ser maior que zero.`);
  }
  return erros;
}

// ---------------------------------------------------------------------------
// Campos próprios da ficha de materiais (modelo da requisição da cozinha)
// ---------------------------------------------------------------------------

const opcional = z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().trim().nullable().optional());

export const esquemaDetalhesMateriais = z.object({
  entrega: z
    .object({
      modo: z.enum(['retirada', 'entrega']),
      horario: opcional,
      local: opcional,
      responsavel: opcional,
    })
    .nullable()
    .optional(),
  evento: z
    .object({
      nome: z.string().trim().min(1, 'Informe o nome do evento.'),
      data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data do evento.'),
      horario: opcional,
      local: opcional,
      publico: opcional,
      participantes: z.number().int().min(0).nullable().optional(),
    })
    .nullable()
    .optional(),
  utensilios: opcional,
});
export type DetalhesMateriais = z.infer<typeof esquemaDetalhesMateriais>;

// ---------------------------------------------------------------------------
// Quem aprova
// ---------------------------------------------------------------------------

/** Atribuições de perfil (do Núcleo), só com o que importa aqui. */
export interface AtribuicaoAprovacao {
  email: string;
  perfil: string;
  escopoTipo: 'global' | 'unidade' | 'area' | 'servico';
  escopo: string | null;
}

/**
 * Coordenação de um serviço: quem tem um perfil com a permissão de aprovar
 * requisições num escopo que cobre o serviço (o próprio serviço, a área ou a
 * unidade dele). Atribuições globais (Diretoria) não contam como coordenação.
 */
export function coordenadoresDoServico(
  servico: { codigo: string; area: string | null; unidade: string | null },
  atribuicoes: AtribuicaoAprovacao[],
  perfisQueAprovam: Set<string>,
): Set<string> {
  const r = new Set<string>();
  for (const a of atribuicoes) {
    if (!perfisQueAprovam.has(a.perfil) || a.escopoTipo === 'global') continue;
    const cobre =
      (a.escopoTipo === 'servico' && a.escopo === servico.codigo) ||
      (a.escopoTipo === 'area' && a.escopo === servico.area) ||
      (a.escopoTipo === 'unidade' && a.escopo === servico.unidade);
    if (cobre) r.add(a.email);
  }
  return r;
}

export type RotaAprovacao = { tipo: 'coordenacao'; coordenadores: string[] } | { tipo: 'diretoria'; motivo: 'propria_coordenacao' | 'sem_coordenacao' };

/**
 * Para onde vai a aprovação:
 * - todos os centros precisam ter a mesma coordenação (senão, uma requisição por coordenação);
 * - se quem pede é dessa coordenação, aprova a Diretoria;
 * - centros sem coordenação cadastrada: aprova a Diretoria, para não ficar parada.
 */
export function rotaDeAprovacao(requisitante: string, coordenacoesDosCentros: Set<string>[]): RotaAprovacao {
  const vazios = coordenacoesDosCentros.filter((s) => s.size === 0).length;
  if (vazios === coordenacoesDosCentros.length) return { tipo: 'diretoria', motivo: 'sem_coordenacao' };
  const comum = vazios > 0 ? [] : [...coordenacoesDosCentros[0]].filter((e) => coordenacoesDosCentros.every((s) => s.has(e)));
  if (comum.length === 0) {
    throw new ErroRequisicao('Os centros de custo escolhidos são de coordenações diferentes. Abra uma requisição para cada coordenação.');
  }
  if (comum.includes(requisitante)) return { tipo: 'diretoria', motivo: 'propria_coordenacao' };
  return { tipo: 'coordenacao', coordenadores: comum.sort() };
}

/** Número da requisição: REQ-AAAA-NNNN, sequencial no ano. */
export function proximoNumero(ano: number, existentes: string[]): string {
  const prefixo = `REQ-${ano}-`;
  const maior = existentes.filter((n) => n.startsWith(prefixo)).reduce((m, n) => Math.max(m, Number(n.slice(prefixo.length)) || 0), 0);
  return `${prefixo}${String(maior + 1).padStart(4, '0')}`;
}
