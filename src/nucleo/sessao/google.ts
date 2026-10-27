/**
 * Confere o login do Google (ID token) no servidor: assinatura, destinatário,
 * e-mail verificado e domínio institucional.
 */
import { OAuth2Client } from 'google-auth-library';

export interface IdentidadeGoogle {
  email: string;
  nome: string;
}

export class ErroLogin extends Error {}

export async function conferirLoginGoogle(
  credencial: string,
  clientId: string,
  dominio: string,
  cliente: Pick<OAuth2Client, 'verifyIdToken'> = new OAuth2Client(clientId),
): Promise<IdentidadeGoogle> {
  let payload;
  try {
    payload = (await cliente.verifyIdToken({ idToken: credencial, audience: clientId })).getPayload();
  } catch {
    throw new ErroLogin('Não foi possível confirmar o login com o Google. Tente de novo.');
  }
  if (!payload?.email || !payload.email_verified) throw new ErroLogin('E-mail do Google não verificado.');
  if (payload.hd !== dominio) throw new ErroLogin(`Use sua conta institucional @${dominio}.`);
  return { email: payload.email.toLowerCase(), nome: payload.name ?? payload.email };
}
