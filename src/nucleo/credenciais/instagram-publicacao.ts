/**
 * Publicação no Instagram (ADR-028): as duas etapas da Meta (criar o contêiner de mídia e publicar). Só este
 * arquivo e `instagram.ts` conhecem a Meta. O token entra por parâmetro, vem da peça de credenciais e nunca
 * aparece em erro, log nem resposta.
 *
 * Duas implementações: Meta (produção) e memória (demonstração e testes: nada sai de verdade, regra 9).
 */
import { ErroInstagram } from './instagram';

export const MENSAGEM_RECONECTAR = 'A conta precisa ser reconectada.';
export const MENSAGEM_IMAGEM_RECUSADA = 'A imagem não foi aceita pelo Instagram.';
export const MENSAGEM_VIDEO_RECUSADO = 'O vídeo não foi aceito pelo Instagram.';
export const MENSAGEM_SEM_RESPOSTA = 'O Instagram não respondeu como esperado.';

export type StatusDoContainer = 'pronto' | 'processando' | 'erro';

export interface PublicadorInstagram {
  /** Cria o contêiner de uma imagem. A Meta baixa a imagem do endereço público informado. */
  criarContainerDeImagem(token: string, urlDaImagem: string, legenda: string): Promise<string>;
  /** Cria o contêiner de um Reel. A Meta baixa o vídeo do endereço público informado. */
  criarContainerDeVideo(token: string, urlDoVideo: string, legenda: string): Promise<string>;
  /** Cria o contêiner de uma imagem que será um item do carrossel (sem legenda). */
  criarContainerDeItem(token: string, urlDaImagem: string): Promise<string>;
  /** Cria o contêiner do carrossel a partir dos itens já prontos. */
  criarContainerDeCarrossel(token: string, itens: string[], legenda: string): Promise<string>;
  statusDoContainer(token: string, containerId: string): Promise<StatusDoContainer>;
  /** Publica o contêiner pronto e devolve o identificador do post. */
  publicar(token: string, containerId: string): Promise<string>;
  /** Endereço público do post. */
  linkDoPost(token: string, postId: string): Promise<string>;
}

const VERSAO = 'v21.0';

export class PublicadorMeta implements PublicadorInstagram {
  constructor(private readonly fetchFn: typeof fetch = fetch) {}

  private async chamar(metodo: 'GET' | 'POST', caminho: string, token: string, params: Record<string, string> = {}, recusa = MENSAGEM_SEM_RESPOSTA): Promise<Record<string, unknown>> {
    const q = new URLSearchParams({ ...params, access_token: token });
    let r: Response;
    try {
      r = await this.fetchFn(`https://graph.instagram.com/${VERSAO}/${caminho}${metodo === 'GET' ? `?${q}` : ''}`, {
        method: metodo,
        ...(metodo === 'POST' ? { body: q } : {}),
      });
    } catch {
      throw new ErroInstagram(MENSAGEM_SEM_RESPOSTA);
    }
    let j: Record<string, unknown> = {};
    try {
      j = (await r.json()) as Record<string, unknown>;
    } catch {
      // resposta sem corpo
    }
    if (!r.ok) {
      const e = (j.error ?? {}) as { code?: number };
      if (r.status === 401 || e.code === 190) throw new ErroInstagram(MENSAGEM_RECONECTAR);
      throw new ErroInstagram(recusa);
    }
    return j;
  }

  async criarContainerDeImagem(token: string, urlDaImagem: string, legenda: string): Promise<string> {
    const j = await this.chamar('POST', 'me/media', token, { image_url: urlDaImagem, caption: legenda }, MENSAGEM_IMAGEM_RECUSADA);
    if (typeof j.id !== 'string') throw new ErroInstagram(MENSAGEM_IMAGEM_RECUSADA);
    return j.id;
  }

  async criarContainerDeVideo(token: string, urlDoVideo: string, legenda: string): Promise<string> {
    const j = await this.chamar('POST', 'me/media', token, { media_type: 'REELS', video_url: urlDoVideo, caption: legenda }, MENSAGEM_VIDEO_RECUSADO);
    if (typeof j.id !== 'string') throw new ErroInstagram(MENSAGEM_VIDEO_RECUSADO);
    return j.id;
  }

  async criarContainerDeItem(token: string, urlDaImagem: string): Promise<string> {
    const j = await this.chamar('POST', 'me/media', token, { image_url: urlDaImagem, is_carousel_item: 'true' }, MENSAGEM_IMAGEM_RECUSADA);
    if (typeof j.id !== 'string') throw new ErroInstagram(MENSAGEM_IMAGEM_RECUSADA);
    return j.id;
  }

  async criarContainerDeCarrossel(token: string, itens: string[], legenda: string): Promise<string> {
    const j = await this.chamar('POST', 'me/media', token, { media_type: 'CAROUSEL', children: itens.join(','), caption: legenda }, MENSAGEM_IMAGEM_RECUSADA);
    if (typeof j.id !== 'string') throw new ErroInstagram(MENSAGEM_IMAGEM_RECUSADA);
    return j.id;
  }

  async statusDoContainer(token: string, containerId: string): Promise<StatusDoContainer> {
    const j = await this.chamar('GET', encodeURIComponent(containerId), token, { fields: 'status_code' });
    if (j.status_code === 'FINISHED') return 'pronto';
    if (j.status_code === 'ERROR' || j.status_code === 'EXPIRED') return 'erro';
    return 'processando';
  }

  async publicar(token: string, containerId: string): Promise<string> {
    const j = await this.chamar('POST', 'me/media_publish', token, { creation_id: containerId });
    if (typeof j.id !== 'string') throw new ErroInstagram(MENSAGEM_SEM_RESPOSTA);
    return j.id;
  }

  async linkDoPost(token: string, postId: string): Promise<string> {
    const j = await this.chamar('GET', encodeURIComponent(postId), token, { fields: 'permalink' });
    if (typeof j.permalink !== 'string' || !j.permalink.startsWith('https://')) throw new ErroInstagram(MENSAGEM_SEM_RESPOSTA);
    return j.permalink;
  }
}

/** Demonstração e testes: a "Meta" é fictícia e guarda o que recebeu. */
export class PublicadorInstagramMemoria implements PublicadorInstagram {
  containers: { id: string; url: string; legenda: string; token: string; tipo: 'imagem' | 'video' | 'item' | 'carrossel'; itens?: string[] }[] = [];
  publicados: string[] = [];
  /** Quantas consultas de status devolvem "processando" antes de ficar pronto. */
  processandoPor = 0;
  falharContainer: string | null = null;
  falharStatus = false;
  falharPublicar: string | null = null;
  falharLink = false;
  private consultas = 0;

  async criarContainerDeImagem(token: string, url: string, legenda: string): Promise<string> {
    if (this.falharContainer) throw new ErroInstagram(this.falharContainer);
    return this.guardar({ url, legenda, token, tipo: 'imagem' });
  }

  async criarContainerDeVideo(token: string, url: string, legenda: string): Promise<string> {
    if (this.falharContainer) throw new ErroInstagram(this.falharContainer);
    return this.guardar({ url, legenda, token, tipo: 'video' });
  }

  async criarContainerDeItem(token: string, url: string): Promise<string> {
    if (this.falharContainer) throw new ErroInstagram(this.falharContainer);
    return this.guardar({ url, legenda: '', token, tipo: 'item' });
  }

  async criarContainerDeCarrossel(token: string, itens: string[], legenda: string): Promise<string> {
    if (this.falharContainer) throw new ErroInstagram(this.falharContainer);
    return this.guardar({ url: '', legenda, token, tipo: 'carrossel', itens });
  }

  private guardar(c: Omit<(typeof this.containers)[number], 'id'>): string {
    const id = `container-${this.containers.length + 1}`;
    this.containers.push({ id, ...c });
    return id;
  }

  async statusDoContainer(): Promise<StatusDoContainer> {
    if (this.falharStatus) return 'erro';
    this.consultas += 1;
    return this.consultas > this.processandoPor ? 'pronto' : 'processando';
  }

  async publicar(_token: string, containerId: string): Promise<string> {
    if (this.falharPublicar) throw new ErroInstagram(this.falharPublicar);
    this.publicados.push(containerId);
    return `post-${this.publicados.length}`;
  }

  async linkDoPost(_token: string, postId: string): Promise<string> {
    if (this.falharLink) throw new ErroInstagram(MENSAGEM_SEM_RESPOSTA);
    return `https://www.instagram.com/p/${postId}/`;
  }
}
