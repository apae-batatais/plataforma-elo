/**
 * Envio de e-mail do Elo (ADR-027).
 *
 * Contrato `EnviadorDeEmail` com duas implementações: Gmail (conta de serviço com delegação no domínio,
 * agindo "em nome de" o remetente da instituição) e memória (demonstração e testes: nada sai de verdade).
 * Os apps pedem o envio por este contrato e nunca conhecem o Gmail.
 */

export class ErroEmail extends Error {}

export interface AnexoEmail {
  nome: string;
  tipo: string;
  dados: Uint8Array;
}

export interface MensagemEmail {
  /** Quem recebe de forma visível. Avisos pessoais usam só este campo. */
  para?: string[];
  /** Cópia oculta (envio a vários contatos: um e-mail só, todos em Cco). */
  cco?: string[];
  assunto: string;
  texto: string;
  anexos?: AnexoEmail[];
}

export interface EnviadorDeEmail {
  /** Remetente (o "não-responda@" da instituição). */
  readonly remetente: string;
  enviar(mensagem: MensagemEmail): Promise<void>;
}

/** Limite de anexos de uma mensagem (ADR-027, item 8). */
export const LIMITE_ANEXOS_BYTES = 10 * 1024 * 1024;

const FORMATO_EMAIL = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/;

export const emailValido = (e: string) => FORMATO_EMAIL.test(e.trim());

/** O e-mail é do domínio da instituição (ou de um subdomínio dele)? */
export function emailDoDominio(email: string, dominio: string): boolean {
  const e = email.trim().toLowerCase();
  const d = dominio.trim().toLowerCase();
  return emailValido(e) && e.endsWith(`@${d}`);
}

/** Confere a mensagem antes de montar: destinatário, assunto sem quebra de linha e tamanho dos anexos. */
export function conferirMensagem(m: MensagemEmail): void {
  const destinos = [...(m.para ?? []), ...(m.cco ?? [])];
  if (destinos.length === 0) throw new ErroEmail('A mensagem não tem destinatário.');
  const ruim = destinos.find((d) => !emailValido(d));
  if (ruim !== undefined) throw new ErroEmail('A mensagem tem um endereço de destino inválido.');
  if (!m.assunto.trim()) throw new ErroEmail('A mensagem precisa de assunto.');
  if (/[\r\n]/.test(m.assunto)) throw new ErroEmail('O assunto não pode ter quebra de linha.');
  const total = (m.anexos ?? []).reduce((s, a) => s + a.dados.length, 0);
  if (total > LIMITE_ANEXOS_BYTES) throw new ErroEmail('Os anexos passam de 10 MB.');
}

// ---------------------------------------------------------------------------
// Montagem da mensagem (MIME, base64url para a API do Gmail)
// ---------------------------------------------------------------------------

const b64 = (dados: Uint8Array | string) => Buffer.from(dados).toString('base64');
const quebrar = (s: string) => s.replace(/(.{76})/g, '$1\r\n');
/** Cabeçalho com acentos (RFC 2047). */
const cabecalho = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);
const nomeSeguro = (s: string) => s.replace(/[\r\n"\\]/g, '_');

export function montarMime(remetente: string, m: MensagemEmail, limite = `elo-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`): string {
  conferirMensagem(m);
  const cab = [
    `From: ${remetente}`,
    // Gmail exige ao menos um "To": sem destino visível, a mensagem vai para o próprio remetente e os demais ficam em Cco.
    `To: ${(m.para?.length ? m.para : [remetente]).join(', ')}`,
    ...(m.cco?.length ? [`Bcc: ${m.cco.join(', ')}`] : []),
    `Subject: ${cabecalho(m.assunto)}`,
    'MIME-Version: 1.0',
  ];
  const corpo = `Content-Type: text/plain; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n${quebrar(b64(m.texto))}`;
  if (!m.anexos?.length) return `${cab.join('\r\n')}\r\n${corpo}`;
  const partes = [
    `--${limite}\r\n${corpo}`,
    ...m.anexos.map(
      (a) =>
        `--${limite}\r\nContent-Type: ${a.tipo.replace(/[\r\n]/g, '')}; name="${nomeSeguro(a.nome)}"\r\nContent-Disposition: attachment; filename="${nomeSeguro(a.nome)}"\r\nContent-Transfer-Encoding: base64\r\n\r\n${quebrar(b64(a.dados))}`,
    ),
  ];
  return `${cab.join('\r\n')}\r\nContent-Type: multipart/mixed; boundary="${limite}"\r\n\r\n${partes.join('\r\n')}\r\n--${limite}--`;
}

// ---------------------------------------------------------------------------
// Implementações
// ---------------------------------------------------------------------------

/** Demonstração e testes: guarda as mensagens e permite simular falha. Nunca sai de verdade (regra 9). */
export class EnviadorMemoria implements EnviadorDeEmail {
  readonly enviadas: MensagemEmail[] = [];
  falhar: string | null = null;
  constructor(readonly remetente: string) {}
  async enviar(m: MensagemEmail): Promise<void> {
    conferirMensagem(m);
    if (this.falhar) throw new ErroEmail(this.falhar);
    this.enviadas.push(m);
  }
}

export type ObterTokenDelegado = (remetente: string) => Promise<string>;

const API_GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

/**
 * Gmail: `users.messages.send` com o escopo `gmail.send`. O token vem da conta de serviço agindo em nome do
 * remetente (delegação no domínio). O erro devolvido é resumido: nunca cita endereço nem texto da mensagem.
 */
export class EnviadorGmail implements EnviadorDeEmail {
  constructor(
    readonly remetente: string,
    private readonly obterToken: ObterTokenDelegado,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async enviar(m: MensagemEmail): Promise<void> {
    const raw = Buffer.from(montarMime(this.remetente, m)).toString('base64url');
    let token: string;
    try {
      token = await this.obterToken(this.remetente);
    } catch {
      throw new ErroEmail(
        'O Google não autorizou o Elo a enviar em nome do e-mail de envio. Confira, no Google Workspace da instituição, a delegação no domínio da conta de serviço (escopo gmail.send) e se o e-mail de envio existe.',
      );
    }
    const r = await this.fetchFn(API_GMAIL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    });
    if (r.ok) return;
    throw new ErroEmail(await motivoDoGmail(r));
  }
}

async function motivoDoGmail(r: Response): Promise<string> {
  let razao = '';
  let texto = '';
  try {
    const c = (await r.json()) as { error?: { message?: string; errors?: { reason?: string }[]; status?: string } };
    razao = c.error?.errors?.[0]?.reason ?? c.error?.status ?? '';
    texto = c.error?.message ?? '';
  } catch {
    // Sem JSON: fica só o código.
  }
  if (/accessNotConfigured|SERVICE_DISABLED/i.test(razao) || /has not been used|is disabled/i.test(texto))
    return 'A Gmail API não está ativada no projeto do Google Cloud da conta de serviço. Ative em console.cloud.google.com › APIs e serviços › Biblioteca › Gmail API.';
  if (r.status === 401 || r.status === 403 || /insufficient|forbidden|permission/i.test(razao))
    return `O Gmail recusou o envio (${r.status}). Confira a delegação no domínio da conta de serviço (escopo gmail.send) e se o e-mail de envio é do domínio da instituição.`;
  if (r.status === 429) return 'Limite diário de envios do Gmail atingido. Tente de novo mais tarde.';
  if (r.status === 400) return 'O Gmail recusou a mensagem (400): confira o e-mail de envio e os destinos.';
  return `O Gmail respondeu ${r.status}.`;
}
