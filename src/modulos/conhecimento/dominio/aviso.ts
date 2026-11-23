/**
 * Regras puras do aviso por e-mail da Base de Conhecimento (regras 21 e 22, ADR-027).
 * O texto é fixo e genérico: nunca leva título nem conteúdo da publicação.
 */

export const SITUACOES_ENVIO = ['pendente', 'enviado', 'falhou', 'cancelado'] as const;
export type SituacaoEnvio = (typeof SITUACOES_ENVIO)[number];

export const MAX_TENTATIVAS = 3;
export const MAX_ENVIOS_POR_RODADA = 100;

/** Minutos de espera depois da tentativa de número `n` (1: +15 min; 2: +60 min). */
export const esperaAposTentativa = (n: number) => (n <= 1 ? 15 : 60);

export const ASSUNTO_DO_AVISO = 'Há um documento novo para você ler na Base de Conhecimento';

export function textoDoAviso(base: string): string {
  return [
    'Olá!',
    '',
    'Há um documento novo para você ler na Base de Conhecimento do Elo.',
    'Ele pede a sua ciência ou um teste de compreensão. Abra o Elo, entre em "Base de Conhecimento" e veja "Falta você".',
    '',
    `${base.replace(/\/+$/, '')}/conhecimento`,
    '',
    'Esta mensagem é automática; não responda.',
  ].join('\n');
}

/** Um aviso por publicação e edição (regra 22). */
export const chaveDoAviso = (publicacaoId: string, edicao: number) => `${publicacaoId}:${edicao}`;
