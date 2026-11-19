/**
 * Ligação com o Instagram (ADR-028): "Instagram Login" da Meta, um app para todo o Elo. Só este arquivo conhece
 * a Meta. A pessoa entra com a própria conta profissional e autoriza; o Elo recebe um token de longa duração
 * (cerca de 60 dias). Ninguém digita senha nem copia token.
 *
 * Duas implementações: Meta (produção) e memória (demonstração e testes: nada sai de verdade, regra 9).
 */
import { SignJWT, jwtVerify } from 'jose';

/** Erro com mensagem já pronta para a pessoa, sem termo técnico e sem segredo. */
export class ErroInstagram extends Error {}

export interface ContaConectada {
  /** Token de longa duração. Segredo: só a camada de credenciais o guarda (cifrado). */
  token: string;
  usuario: string;
  venceEm: Date;
}

export interface ProvedorInstagram {
  /** Endereço da Meta para a pessoa autorizar. */
  urlDeAutorizacao(estado: string, retorno: string): string;
  /** Troca o código devolvido pela Meta pelo token de longa duração e confere que a conta é profissional. */
  conectar(codigo: string, retorno: string): Promise<ContaConectada>;
  /** Renova o token (a Meta só renova token com mais de 24 horas e ainda válido). */
  renovar(token: string): Promise<{ token: string; venceEm: Date }>;
}

export const MENSAGEM_NAO_CONECTOU = 'Não foi possível conectar. Confira se a conta é profissional e tente de novo.';
export const MENSAGEM_NAO_LIBERADO = 'O Instagram desta instituição ainda não foi liberado pela Diretoria do Elo.';

const ESCOPOS = 'instagram_business_basic,instagram_business_content_publish';
const SEGUNDOS_POR_DIA = 86400;

export class ProvedorMeta implements ProvedorInstagram {
  constructor(
    private readonly appId: string,
    private readonly appSecret: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  urlDeAutorizacao(estado: string, retorno: string): string {
    const q = new URLSearchParams({ client_id: this.appId, redirect_uri: retorno, response_type: 'code', scope: ESCOPOS, state: estado });
    return `https://www.instagram.com/oauth/authorize?${q}`;
  }

  private async json(r: Response): Promise<Record<string, unknown>> {
    try {
      return (await r.json()) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  async conectar(codigo: string, retorno: string): Promise<ContaConectada> {
    const curto = await this.fetchFn('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      body: new URLSearchParams({ client_id: this.appId, client_secret: this.appSecret, grant_type: 'authorization_code', redirect_uri: retorno, code: codigo }),
    });
    const c = await this.json(curto);
    if (!curto.ok || typeof c.access_token !== 'string') throw new ErroInstagram(curto.status === 400 || curto.status === 403 ? MENSAGEM_NAO_LIBERADO : MENSAGEM_NAO_CONECTOU);
    const longo = await this.fetchFn(`https://graph.instagram.com/access_token?${new URLSearchParams({ grant_type: 'ig_exchange_token', client_secret: this.appSecret, access_token: c.access_token })}`);
    const l = await this.json(longo);
    if (!longo.ok || typeof l.access_token !== 'string') throw new ErroInstagram(MENSAGEM_NAO_CONECTOU);
    const eu = await this.fetchFn(`https://graph.instagram.com/me?${new URLSearchParams({ fields: 'username,account_type', access_token: l.access_token })}`);
    const e = await this.json(eu);
    if (!eu.ok || typeof e.username !== 'string') throw new ErroInstagram(MENSAGEM_NAO_CONECTOU);
    const tipo = String(e.account_type ?? '').toUpperCase();
    if (tipo !== 'BUSINESS' && tipo !== 'MEDIA_CREATOR') {
      throw new ErroInstagram('Esta conta do Instagram não é profissional. Mude a conta para profissional (comercial ou criador de conteúdo) nas configurações do Instagram e tente de novo.');
    }
    const segundos = typeof l.expires_in === 'number' ? l.expires_in : 60 * SEGUNDOS_POR_DIA;
    return { token: l.access_token, usuario: e.username, venceEm: new Date(Date.now() + segundos * 1000) };
  }

  async renovar(token: string): Promise<{ token: string; venceEm: Date }> {
    const r = await this.fetchFn(`https://graph.instagram.com/refresh_access_token?${new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: token })}`);
    const j = await this.json(r);
    if (!r.ok || typeof j.access_token !== 'string') throw new ErroInstagram('A Meta não renovou a chave de acesso.');
    const segundos = typeof j.expires_in === 'number' ? j.expires_in : 60 * SEGUNDOS_POR_DIA;
    return { token: j.access_token, venceEm: new Date(Date.now() + segundos * 1000) };
  }
}

/** Demonstração e testes: a "Meta" é fictícia. O código `demo` conecta a conta fictícia; `recusa` simula erro. */
export class ProvedorInstagramMemoria implements ProvedorInstagram {
  renovacoes = 0;
  falharRenovacao = false;
  constructor(
    private readonly usuario = 'conta_demonstracao',
    private readonly dias = 60,
    private readonly agora: () => Date = () => new Date(),
  ) {}

  urlDeAutorizacao(estado: string, retorno: string): string {
    return `${retorno}?${new URLSearchParams({ code: 'demo', state: estado })}`;
  }

  async conectar(codigo: string): Promise<ContaConectada> {
    if (codigo === 'nao_profissional') throw new ErroInstagram('Esta conta do Instagram não é profissional. Mude a conta para profissional (comercial ou criador de conteúdo) nas configurações do Instagram e tente de novo.');
    if (codigo !== 'demo') throw new ErroInstagram(MENSAGEM_NAO_CONECTOU);
    return { token: `fictício-${Math.random().toString(36).slice(2)}`, usuario: this.usuario, venceEm: new Date(this.agora().getTime() + this.dias * SEGUNDOS_POR_DIA * 1000) };
  }

  async renovar(): Promise<{ token: string; venceEm: Date }> {
    if (this.falharRenovacao) throw new ErroInstagram('falhou');
    this.renovacoes += 1;
    return { token: `fictício-renovado-${this.renovacoes}`, venceEm: new Date(this.agora().getTime() + this.dias * SEGUNDOS_POR_DIA * 1000) };
  }
}

// ---------------------------------------------------------------------------
// Estado da conexão: ida e volta pela Meta, assinado e preso a quem começou
// ---------------------------------------------------------------------------

const chave = (segredo: string) => new TextEncoder().encode(segredo);
const VALIDADE_ESTADO = '10m';

export async function assinarEstadoDaConexao(segredo: string, email: string, instituicao: string): Promise<string> {
  return new SignJWT({ inst: instituicao, uso: 'instagram' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(email)
    .setIssuedAt()
    .setExpirationTime(VALIDADE_ESTADO)
    .sign(chave(segredo));
}

/** Confere o estado devolvido pela Meta: assinatura, validade, mesma pessoa e mesma instituição. */
export async function conferirEstadoDaConexao(segredo: string, estado: string | null, email: string, instituicao: string): Promise<boolean> {
  if (!estado) return false;
  try {
    const { payload } = await jwtVerify(estado, chave(segredo), { algorithms: ['HS256'] });
    return payload.uso === 'instagram' && payload.sub === email && payload.inst === instituicao;
  } catch {
    return false;
  }
}
