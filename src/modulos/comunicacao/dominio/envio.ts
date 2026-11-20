/**
 * Regras puras dos envios automáticos de e-mail (ADR-027): situações, tentativas e a espera entre elas.
 * Nada aqui lê nem grava planilhas.
 */

export const TIPOS_ENVIO = ['release', 'artigo', 'aviso', 'lembrete'] as const;
export type TipoEnvio = (typeof TIPOS_ENVIO)[number];

export const SITUACOES_ENVIO = ['pendente', 'enviado', 'falhou', 'cancelado'] as const;
export type SituacaoEnvio = (typeof SITUACOES_ENVIO)[number];

export const NOME_SITUACAO_ENVIO: Record<SituacaoEnvio, string> = {
  pendente: 'Aguardando a hora marcada',
  enviado: 'Enviado',
  falhou: 'Falhou',
  cancelado: 'Cancelado',
};

/** Tentativas por envio (a primeira e mais duas) e máximo de envios por rodada e por instituição. */
export const MAX_TENTATIVAS = 3;
export const MAX_ENVIOS_POR_RODADA = 100;

/** Minutos de espera depois da tentativa de número `n` (1: +15 min; 2: +60 min). */
export function esperaAposTentativa(n: number): number {
  return n <= 1 ? 15 : 60;
}

/** Assunto do e-mail: o título do pedido, sem quebra de linha. */
export const assuntoDoEnvio = (titulo: string) => titulo.replace(/[\r\n]+/g, ' ').trim();

/** Grupos e contatos gravados no pedido (JSON); texto ilegível vale como vazio. */
export function lerDestinatarios(json: string | null): { grupos: string[]; contatos: string[] } {
  try {
    const v = JSON.parse(json ?? '{}') as { grupos?: unknown; contatos?: unknown };
    const lista = (x: unknown) => (Array.isArray(x) ? x.filter((i): i is string => typeof i === 'string') : []);
    return { grupos: lista(v.grupos), contatos: lista(v.contatos) };
  } catch {
    return { grupos: [], contatos: [] };
  }
}
