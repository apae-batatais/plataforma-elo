/**
 * Regras puras do pedido de publicação: tipos de peça, situações, caminho
 * entre elas e numeração. Nada aqui lê nem grava planilhas.
 */

export const TIPOS_PECA = ['post_instagram', 'reel_instagram', 'release', 'artigo', 'entrevista'] as const;
export type TipoPeca = (typeof TIPOS_PECA)[number];
export const NOME_TIPO_PECA: Record<TipoPeca, string> = {
  post_instagram: 'Post no Instagram',
  reel_instagram: 'Reel no Instagram',
  release: 'Release',
  artigo: 'Artigo',
  entrevista: 'Entrevista',
};

export const SITUACOES = [
  'aguardando_revisao',
  'em_revisao',
  'devolvido',
  'aguardando_aprovacao',
  'aprovado',
  'agendado',
  'publicado',
  'realizada',
  'recusado',
  'cancelado',
  'juntado',
] as const;
export type Situacao = (typeof SITUACOES)[number];
export const NOME_SITUACAO: Record<Situacao, string> = {
  aguardando_revisao: 'Aguardando revisão',
  em_revisao: 'Em revisão',
  devolvido: 'Devolvido',
  aguardando_aprovacao: 'Aguardando aprovação',
  aprovado: 'Aprovado',
  agendado: 'Agendado',
  publicado: 'Publicado',
  realizada: 'Realizada',
  recusado: 'Recusado',
  cancelado: 'Cancelado',
  juntado: 'Juntado',
};
/** Situações em que o pedido não anda mais. */
export const SITUACOES_FINAIS: ReadonlySet<Situacao> = new Set<Situacao>(['publicado', 'realizada', 'recusado', 'cancelado', 'juntado']);

export const ACOES = [
  'iniciar_revisao',
  'enviar_aprovacao',
  'devolver',
  'recusar',
  'juntar',
  'reenviar',
  'cancelar',
  'aprovar',
  'pedir_ajustes',
  'agendar',
  'reagendar',
  'publicar',
] as const;
export type Acao = (typeof ACOES)[number];

/** Ações que só valem com um comentário explicando o motivo. */
export const COMENTARIO_OBRIGATORIO: ReadonlySet<Acao> = new Set<Acao>(['devolver', 'recusar', 'pedir_ajustes']);

export class ErroComunicacao extends Error {}

/** De cada situação, para onde cada ação leva. */
const CAMINHO: Partial<Record<Situacao, Partial<Record<Acao, Situacao>>>> = {
  aguardando_revisao: { iniciar_revisao: 'em_revisao', cancelar: 'cancelado' },
  em_revisao: { enviar_aprovacao: 'aguardando_aprovacao', devolver: 'devolvido', recusar: 'recusado', juntar: 'juntado' },
  devolvido: { reenviar: 'aguardando_revisao', cancelar: 'cancelado' },
  aguardando_aprovacao: { aprovar: 'aprovado', pedir_ajustes: 'em_revisao', recusar: 'recusado' },
  aprovado: { agendar: 'agendado' },
  agendado: { reagendar: 'agendado' }, // "publicar" depende do tipo da peça
};

/** Devolve a situação nova ou lança erro se a ação não vale para a situação atual. */
export function conferirTransicao(de: Situacao, acao: Acao, tipo: TipoPeca): Situacao {
  if (de === 'agendado' && acao === 'publicar') return tipo === 'entrevista' ? 'realizada' : 'publicado';
  const para = CAMINHO[de]?.[acao];
  if (!para) throw new ErroComunicacao(`Esta ação não vale para um pedido em "${NOME_SITUACAO[de]}".`);
  return para;
}

/** Próximo número do ano, no formato COM-AAAA-NNNN. */
export function proximoNumero(existentes: string[], ano: number): string {
  const prefixo = `COM-${ano}-`;
  const maior = existentes.filter((n) => n.startsWith(prefixo)).reduce((m, n) => Math.max(m, Number(n.slice(prefixo.length)) || 0), 0);
  return `${prefixo}${String(maior + 1).padStart(4, '0')}`;
}
