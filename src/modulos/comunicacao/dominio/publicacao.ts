/**
 * Regras puras da publicação automática no Instagram (ADR-028). Nada aqui lê nem grava planilhas.
 */

export const TIPOS_PUBLICACAO = ['post', 'reel', 'carrossel'] as const;
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

export const CARROSSEL_MIN = 2;
export const CARROSSEL_MAX = 10;

/** Mídia do pedido que interessa à publicação (já sem os anexos encerrados). */
export interface MidiaDoPedido {
  tipo: 'foto' | 'documento' | 'video';
  mime: string;
}

/**
 * Que publicação o pedido vira. Reel: um vídeo. Post com 1 foto: post; com 2 a 10 fotos: carrossel
 * (decisão do roadmap: o número de imagens decide, sem novo tipo de peça). Devolve o motivo se não dá.
 */
export function tipoDePublicacao(tipoPeca: string, midias: MidiaDoPedido[]): { tipo: TipoPublicacao; mensagem?: undefined } | { tipo?: undefined; mensagem: string } {
  const fotos = midias.filter((m) => m.tipo === 'foto');
  const videos = midias.filter((m) => m.tipo === 'video');
  if (tipoPeca === 'reel_instagram') {
    if (videos.length !== 1) return { mensagem: 'O Reel precisa de exatamente 1 vídeo anexado ao pedido (MP4 ou MOV).' };
    return { tipo: 'reel' };
  }
  if (tipoPeca !== 'post_instagram') return { mensagem: 'A publicação pelo Elo vale para post, carrossel e Reel. Publique este pedido à mão.' };
  if (videos.length > 0) return { mensagem: 'Post e carrossel usam só fotos. Tire o vídeo do pedido ou publique à mão.' };
  if (fotos.length === 0) return { mensagem: 'O pedido não tem a foto exigida pelo Instagram.' };
  if (fotos.length > CARROSSEL_MAX) return { mensagem: `O carrossel aceita até ${CARROSSEL_MAX} fotos.` };
  if (fotos.some((f) => !imagemAceita(f.mime))) return { mensagem: 'As fotos precisam ser JPG para o Instagram. Ajuste o pedido e anexe as fotos de novo.' };
  return { tipo: fotos.length === 1 ? 'post' : 'carrossel' };
}

/** O vídeo do Reel precisa ser MP4 ou MOV (o Instagram recomenda MP4). */
export const videoAceito = (mime: string): boolean => ['video/mp4', 'video/quicktime'].includes(mime.toLowerCase().split(';')[0].trim());
