/**
 * Sessão assinada (cookie). Guarda só o e-mail, o nome e a instituição; as
 * permissões são lidas a cada requisição, para que uma mudança de acesso valha
 * na hora. A sessão de uma instituição não vale em outra (ADR-012).
 */
import { SignJWT, jwtVerify } from 'jose';

export const DURACAO_SESSAO_HORAS = 8;

const chave = (segredo: string) => new TextEncoder().encode(segredo);

export interface Sessao {
  email: string;
  nome: string;
  /** Código da instituição em que a pessoa entrou (sessões antigas não têm). */
  instituicao?: string;
}

export async function assinarSessao(segredo: string, email: string, nome: string, instituicao?: string): Promise<string> {
  return new SignJWT(instituicao ? { nome, inst: instituicao } : { nome })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(email)
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_SESSAO_HORAS}h`)
    .sign(chave(segredo));
}

export async function lerSessao(segredo: string, token: string | undefined): Promise<Sessao | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, chave(segredo), { algorithms: ['HS256'] });
    if (!payload.sub) return null;
    const nome = typeof payload.nome === 'string' ? payload.nome : payload.sub;
    return typeof payload.inst === 'string' ? { email: payload.sub, nome, instituicao: payload.inst } : { email: payload.sub, nome };
  } catch {
    return null;
  }
}

/**
 * A sessão vale nesta instituição? Precisa ter sido aberta nela. Sessão antiga,
 * sem instituição, só vale enquanto o Elo atende uma instituição só.
 */
export function sessaoValeNa(sessao: Sessao, instituicao: string, unica: boolean): boolean {
  return sessao.instituicao ? sessao.instituicao === instituicao : unica;
}
