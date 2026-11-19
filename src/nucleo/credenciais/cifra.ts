/**
 * Cifra dos segredos guardados pelo Elo (ADR-028): AES-256-GCM, com a chave mestra `ELO_CHAVE_CREDENCIAIS`
 * (Secret da hospedagem). A planilha só vê o texto cifrado. O contexto (instituição e serviço) entra como dado
 * autenticado: um valor copiado de uma linha para outra, ou de uma instituição para outra, não decifra.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/** Problema com a cifra. A mensagem nunca cita o valor nem a chave. */
export class ErroCifra extends Error {}

const VERSAO = 'v1';

function chaveDe(segredo: string | undefined): Buffer {
  const s = (segredo ?? '').trim();
  if (s.length < 32) throw new ErroCifra('A chave de credenciais (ELO_CHAVE_CREDENCIAIS) não está configurada ou é curta demais (mínimo 32 caracteres).');
  return createHash('sha256').update(s).digest();
}

export function cifrar(valor: string, contexto: string, segredo: string | undefined = process.env.ELO_CHAVE_CREDENCIAIS): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', chaveDe(segredo), iv);
  c.setAAD(Buffer.from(contexto));
  const dados = Buffer.concat([c.update(valor, 'utf8'), c.final()]);
  return [VERSAO, iv.toString('base64url'), c.getAuthTag().toString('base64url'), dados.toString('base64url')].join('.');
}

export function decifrar(cifrado: string, contexto: string, segredo: string | undefined = process.env.ELO_CHAVE_CREDENCIAIS): string {
  const [versao, iv, tag, dados] = cifrado.split('.');
  if (versao !== VERSAO || !iv || !tag || !dados) throw new ErroCifra('O valor guardado não está no formato esperado. Conecte a conta de novo.');
  try {
    const d = createDecipheriv('aes-256-gcm', chaveDe(segredo), Buffer.from(iv, 'base64url'));
    d.setAAD(Buffer.from(contexto));
    d.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(dados, 'base64url')), d.final()]).toString('utf8');
  } catch (e) {
    if (e instanceof ErroCifra) throw e;
    throw new ErroCifra('Não foi possível ler o valor guardado (a chave mudou ou o valor foi alterado). Conecte a conta de novo.');
  }
}
