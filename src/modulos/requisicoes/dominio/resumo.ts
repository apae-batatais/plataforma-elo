/**
 * Texto do resumo diário por e-mail (entrega 7, ADR-027). Fixo e genérico: só as contagens e o link do Elo.
 * Nunca leva número de requisição, nome de quem pediu nem texto do pedido.
 */
export interface Contagens {
  aprovar: number;
  devolvidas: number;
  atrasadas: number;
}

/** Hora (Brasília) a partir da qual o resumo sai, e hora até a qual a rotina ainda tenta (recupera rodadas perdidas). */
export const HORA_DO_RESUMO = 7;
export const HORA_LIMITE_DO_RESUMO = 12;

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function conteudoDoResumo(c: Contagens, urlBase: string): { assunto: string; texto: string } {
  const linhas = [
    c.aprovar > 0 ? `- ${plural(c.aprovar, 'requisição aguarda', 'requisições aguardam')} a sua aprovação.` : null,
    c.devolvidas > 0 ? `- ${plural(c.devolvidas, 'requisição sua foi devolvida', 'requisições suas foram devolvidas')} para ajuste.` : null,
    c.atrasadas > 0 ? `- ${plural(c.atrasadas, 'requisição está atrasada', 'requisições estão atrasadas')} no seu setor ou escopo.` : null,
  ].filter((l): l is string => l !== null);
  return {
    assunto: 'Elo: resumo de Requisições',
    texto: ['Bom dia! Este é o resumo de hoje em Requisições:', '', ...linhas, '', `Abra o Elo para ver: ${urlBase}/requisicoes`, '', 'Esta é uma mensagem automática; não responda.'].join('\n'),
  };
}
