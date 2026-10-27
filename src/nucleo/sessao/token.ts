/**
 * Sessão assinada (cookie). Guarda só o e-mail e o nome; as permissões são
 * lidas a cada requisição, para que uma mudança de acesso valha na hora.
 */
import { SignJWT, jwtVerify } from 'jose';

export const DURACAO_SESSAO_HORAS = 8;

const chave = (segredo: string) => new TextEncoder().encode(segredo);

export async function assinarSessao(segredo: string, email: string, nome: string): Promise<string> {
  return new SignJWT({ nome })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(email)
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_SESSAO_HORAS}h`)
    .sign(chave(segredo));
}

export async function lerSessao(segredo: string, token: string | undefined): Promise<{ email: string; nome: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, chave(segredo), { algorithms: ['HS256'] });
    if (!payload.sub) return null;
    return { email: payload.sub, nome: typeof payload.nome === 'string' ? payload.nome : payload.sub };
  } catch {
    return null;
  }
}
