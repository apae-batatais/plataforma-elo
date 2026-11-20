/**
 * Regras puras da publicação automática no Instagram (ADR-028). Nada aqui lê nem grava planilhas.
 */

export const TIPOS_PUBLICACAO = ['post'] as const;
export type TipoPublicacao = (typeof TIPOS_PUBLICACAO)[number];

export const SITUACOES_PUBLICACAO = ['pendente', 'publicando', 'publicada', 'falhou', 'cancelada'] as const;
export type SituacaoPublicacao = (typeof SITUACOES_PUBLICACAO)[number];
export const NOME_SITUACAO_PUBLICACAO: Record<SituacaoPublicacao, string> = {
  pendente: 'Aguardando a hora',
  publicando: 'Publicando',
  publicada: 'Publicada',
  falhou: 'Falhou',
  cancelada: 'Cancelada',
};

export const MAX_TENTATIVAS = 3;
/** Espera depois de cada tentativa que falhou (minutos): 15 depois da 1ª, 60 depois da 2ª. */
export const ESPERA_ENTRE_TENTATIVAS_MIN = [15, 60] as const;
/** Menor limite que a Meta documenta por conta em 24 horas. */
export const MAX_POR_CONTA_EM_24H = 50;
export const MAX_POR_RODADA = 25;
/** Validade do endereço temporário da mídia. */
export const VALIDADE_MIDIA_MIN = 60;
export const LEGENDA_MAXIMA = 2200;
/** Atraso a partir do qual a Comunicação é avisada de que a publicação não saiu. */
export const ATRASO_PARA_AVISAR_MIN = 60;

const MIN = 60_000;

/** Quando tentar de novo, depois da `tentativa`-ésima falha; null = esgotou. */
export function proximaTentativa(tentativa: number, agora: Date): Date | null {
  if (tentativa >= MAX_TENTATIVAS) return null;
  return new Date(agora.getTime() + ESPERA_ENTRE_TENTATIVAS_MIN[tentativa - 1] * MIN);
}

export const venceMidiaEm = (agora: Date): Date => new Date(agora.getTime() + VALIDADE_MIDIA_MIN * MIN);

/** Confere a legenda (a descrição do pedido). */
export function conferirLegenda(legenda: string): string | null {
  return legenda.length > LEGENDA_MAXIMA ? `A descrição do pedido passa de ${LEGENDA_MAXIMA.toLocaleString('pt-BR')} caracteres, o limite da legenda do Instagram.` : null;
}

/** A Meta só aceita JPG no contêiner de imagem. */
export const imagemAceita = (mime: string): boolean => mime.toLowerCase().split(';')[0].trim() === 'image/jpeg';
