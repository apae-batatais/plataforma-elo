/**
 * Envio de e-mail pela plataforma (ADR-027). Somente servidor.
 *
 * - Demonstração: mensagens guardadas em memória, nada sai de verdade (regra 9).
 * - Produção: Gmail, pela conta de serviço com delegação no domínio, em nome do e-mail de envio da instituição.
 * - Instituição sem e-mail de envio: sem enviador (null); os avisos dentro do Elo continuam.
 */
import 'server-only';
import type { ConfigGeral, Instituicao } from '@/nucleo/config';
import { EnviadorGmail, EnviadorMemoria, type EnviadorDeEmail } from '@/nucleo/email/email';

const ESCOPO = 'https://www.googleapis.com/auth/gmail.send';
const memorias = new Map<string, EnviadorMemoria>();

/** O enviador da instituição, ou null quando ela não informou o e-mail de envio. */
export function enviadorDaInstituicao(geral: ConfigGeral, inst: Instituicao): EnviadorDeEmail | null {
  const remetente = inst.remetenteEmail;
  if (!remetente) return null;
  if (geral.modo === 'demonstracao') {
    const chave = `${inst.codigo}:${remetente}`;
    let m = memorias.get(chave);
    if (!m) memorias.set(chave, (m = new EnviadorMemoria(remetente)));
    return m;
  }
  const conta = geral.contaServico;
  return new EnviadorGmail(remetente, async (em) => {
    const { JWT } = await import('google-auth-library');
    const { token } = await new JWT({ email: conta.client_email, key: conta.private_key, scopes: [ESCOPO], subject: em }).getAccessToken();
    if (!token) throw new Error('sem token');
    return token;
  });
}

/** Demonstração: as mensagens "enviadas" de uma instituição (para conferir na prévia). */
export function mensagensDaDemonstracao(inst: Instituicao) {
  return [...memorias.entries()].filter(([c]) => c.startsWith(`${inst.codigo}:`)).flatMap(([, m]) => m.enviadas);
}
