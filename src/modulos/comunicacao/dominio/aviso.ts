/**
 * Avisos e lembrete por e-mail da Comunicação (ADR-027, entrega 3): modelos de texto FIXOS.
 * O texto traz só o número do pedido, o que fazer e o link do Elo; nunca título, descrição, nome de
 * atendido nem anexo. Nada aqui lê nem grava planilhas.
 */

export const MODELOS_AVISO = ['devolvido', 'aprovacao', 'publicado', 'revisao', 'lembrete', 'falha'] as const;
export type ModeloAviso = (typeof MODELOS_AVISO)[number];

/** Quem recebe cada modelo: quem pediu, ou quem tem a permissão. */
export const DESTINO_DO_AVISO: Record<ModeloAviso, { solicitante: true } | { permissao: string }> = {
  devolvido: { solicitante: true },
  publicado: { solicitante: true },
  aprovacao: { permissao: 'comunicacao.aprovar' },
  revisao: { permissao: 'comunicacao.revisar' },
  lembrete: { permissao: 'comunicacao.revisar' },
  falha: { permissao: 'comunicacao.revisar' },
};

/** Como o histórico do pedido chama quem recebeu (sem endereço). */
export const NOME_DO_DESTINO: Record<ModeloAviso, string> = {
  devolvido: 'quem fez o pedido',
  publicado: 'quem fez o pedido',
  aprovacao: 'a coordenação da Comunicação',
  revisao: 'a Comunicação',
  lembrete: 'a Comunicação',
  falha: 'a Comunicação',
};

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export interface ConteudoAviso {
  assunto: string;
  texto: string;
}

/** Monta assunto e texto. `numero` é COM-AAAA-NNNN e `id` a linha do pedido (para o link); `n` é a contagem dos resumos; `base` é o endereço do Elo. */
export function conteudoDoAviso(modelo: ModeloAviso, d: { numero?: string; id?: string; n?: number; base: string }): ConteudoAviso {
  const link = (caminho: string) => `\n\nAbrir no Elo: ${d.base.replace(/\/+$/, '')}${caminho}`;
  const n = d.n ?? 0;
  const pedido = d.numero ?? '';
  switch (modelo) {
    case 'devolvido':
      return { assunto: `Pedido ${pedido} devolvido para ajuste`, texto: `Seu pedido foi devolvido para ajuste. Abra o Elo para ver o que ajustar.${link(`/comunicacao/${d.id ?? ""}`)}` };
    case 'aprovacao':
      return { assunto: `Pedido ${pedido} aguardando aprovação`, texto: `Um pedido espera a sua aprovação.${link(`/comunicacao/${d.id ?? ""}`)}` };
    case 'publicado':
      return { assunto: `Pedido ${pedido} publicado`, texto: `Seu pedido foi publicado.${link(`/comunicacao/${d.id ?? ""}`)}` };
    case 'revisao':
      return {
        assunto: `${plural(n, 'pedido aguardando revisão', 'pedidos aguardando revisão')}`,
        texto: `Há ${plural(n, 'pedido aguardando revisão', 'pedidos aguardando revisão')}.${link('/comunicacao/pedidos')}`,
      };
    case 'lembrete':
      return { assunto: `Hoje: ${plural(n, 'pedido para publicar', 'pedidos para publicar')}`, texto: `Hoje: ${plural(n, 'pedido para publicar', 'pedidos para publicar')}.${link('/comunicacao/calendario')}` };
    case 'falha':
      return {
        assunto: `O envio do pedido ${pedido} falhou`,
        texto: `O envio do pedido ${pedido} falhou. Abra o Elo para tentar de novo ou enviar à mão.${link(`/comunicacao/${d.id ?? ""}`)}`,
      };
  }
}

/** Avisos dos pedidos (um por mudança de situação): a situação nova decide o modelo. */
export function modeloDaMudanca(para: string): ModeloAviso | null {
  return para === 'devolvido' ? 'devolvido' : para === 'aguardando_aprovacao' ? 'aprovacao' : para === 'publicado' ? 'publicado' : null;
}

/** A situação atual do pedido ainda pede este aviso? (Se já mudou, o aviso perdeu o sentido.) */
export function avisoAindaVale(modelo: ModeloAviso, situacao: string): boolean {
  return modelo === 'devolvido' ? situacao === 'devolvido' : modelo === 'aprovacao' ? situacao === 'aguardando_aprovacao' : true;
}
