/**
 * Envio de e-mail do Elo (ADR-027, entrega 1): contrato, memória, Gmail (com fetch simulado),
 * e-mail de envio no cadastro da instituição, e-mail de teste e a chave da rotina.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { lerTabela, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { conferirMensagem, EnviadorGmail, EnviadorMemoria, ErroEmail, emailDoDominio, LIMITE_ANEXOS_BYTES, montarMime } from '@/nucleo/email/email';
import { RegistrosAuditoria } from '@/nucleo/estrutura/tabelas';
import {
  autorizadorDaRede,
  enviarEmailDeTeste,
  instituicoesCadastradas,
  painelDaRede,
  prepararRede,
  salvarInstituicao,
  type DadosInstituicao,
} from '@/nucleo/rede/rede';

vi.mock('server-only', () => ({}));

const ID = (n: number) => `1${String(n).repeat(25)}AbC`;
let rede: Planilhas;
const operadora = () => autorizadorDaRede(rede, 'rede@operadora.org', ['rede@operadora.org']);
const dados = (extra: Partial<DadosInstituicao> = {}): DadosInstituicao => ({
  codigo: 'inst-a',
  nome: 'Instituição A',
  dominio: 'inst-a.org.br',
  enderecos: [],
  planilhas: { nucleo: ID(1), auditoria: ID(2) },
  administradoresIniciais: [],
  unidades: [{ codigo: 'sede', nome: 'Sede' }],
  ...extra,
});

beforeEach(async () => {
  rede = { armazenamento: new ArmazenamentoMemoria(['rede']), idDe: () => 'rede' };
  await prepararRede(rede);
});

describe('mensagem', () => {
  it('exige destino válido, assunto e anexos até 10 MB', () => {
    expect(() => conferirMensagem({ assunto: 'a', texto: 'b' })).toThrow(/destinat/);
    expect(() => conferirMensagem({ para: ['sem-arroba'], assunto: 'a', texto: 'b' })).toThrow(/inválido/);
    expect(() => conferirMensagem({ para: ['a@x.org'], assunto: ' ', texto: 'b' })).toThrow(/assunto/);
    expect(() => conferirMensagem({ para: ['a@x.org'], assunto: 'a\r\nBcc: x@y.org', texto: 'b' })).toThrow(/quebra/);
    const grande = { nome: 'a.pdf', tipo: 'application/pdf', dados: new Uint8Array(LIMITE_ANEXOS_BYTES + 1) };
    expect(() => conferirMensagem({ para: ['a@x.org'], assunto: 'a', texto: 'b', anexos: [grande] })).toThrow(/10 MB/);
    expect(() => conferirMensagem({ cco: ['a@x.org', 'b@x.org'], assunto: 'a', texto: 'b' })).not.toThrow();
  });

  it('o MIME leva Cco, assunto com acento codificado e anexo; sem destino visível, o "Para" é o remetente', () => {
    const mime = montarMime(
      'nao-responda@inst.org.br',
      { cco: ['a@x.org', 'b@x.org'], assunto: 'Release à imprensa', texto: 'Olá', anexos: [{ nome: 'nota "1".pdf', tipo: 'application/pdf', dados: new Uint8Array([1, 2, 3]) }] },
      'LIM',
    );
    expect(mime).toContain('From: nao-responda@inst.org.br');
    expect(mime).toContain('To: nao-responda@inst.org.br');
    expect(mime).toContain('Bcc: a@x.org, b@x.org');
    expect(mime).toMatch(/Subject: =\?UTF-8\?B\?/);
    expect(mime).toContain('multipart/mixed; boundary="LIM"');
    expect(mime).toContain('filename="nota _1_.pdf"');
    expect(mime).toContain(Buffer.from('Olá').toString('base64'));
  });

  it('e-mail do domínio da instituição', () => {
    expect(emailDoDominio('Nao-Responda@Inst.org.br', 'inst.org.br')).toBe(true);
    expect(emailDoDominio('x@gmail.com', 'inst.org.br')).toBe(false);
    expect(emailDoDominio('x@outra-inst.org.br', 'inst.org.br')).toBe(false);
    expect(emailDoDominio('x@@inst.org.br', 'inst.org.br')).toBe(false);
  });
});

describe('enviador em memória', () => {
  it('guarda o que foi enviado e simula falha', async () => {
    const e = new EnviadorMemoria('nao-responda@inst.org.br');
    await e.enviar({ para: ['a@x.org'], assunto: 'Oi', texto: 'texto' });
    expect(e.enviadas).toHaveLength(1);
    e.falhar = 'Gmail fora do ar';
    await expect(e.enviar({ para: ['a@x.org'], assunto: 'Oi', texto: 'texto' })).rejects.toThrow('Gmail fora do ar');
    expect(e.enviadas).toHaveLength(1);
  });
});

describe('enviador do Gmail', () => {
  const msg = { para: ['pessoa@x.org'], assunto: 'Oi', texto: 'segredo-do-texto' };

  it('envia em nome do remetente, com o token dele, a mensagem em base64url', async () => {
    const chamadas: { url: string; init: RequestInit }[] = [];
    const f = (async (url: string, init: RequestInit) => {
      chamadas.push({ url, init });
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    const tokens: string[] = [];
    await new EnviadorGmail('nao-responda@inst.org.br', async (r) => (tokens.push(r), 'tok'), f).enviar(msg);
    expect(tokens).toEqual(['nao-responda@inst.org.br']);
    expect(chamadas[0].url).toContain('gmail.googleapis.com/gmail/v1/users/me/messages/send');
    expect((chamadas[0].init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    const { raw } = JSON.parse(String(chamadas[0].init.body)) as { raw: string };
    expect(Buffer.from(raw, 'base64url').toString()).toContain('From: nao-responda@inst.org.br');
  });

  it('erro do Gmail vira mensagem resumida, sem endereço nem texto da mensagem', async () => {
    const f = (async () => new Response(JSON.stringify({ error: { message: 'Delegation denied for pessoa@x.org segredo-do-texto', errors: [{ reason: 'forbidden' }] } }), { status: 403 })) as unknown as typeof fetch;
    const erro = await new EnviadorGmail('nao-responda@inst.org.br', async () => 'tok', f).enviar(msg).catch((e) => e);
    expect(erro).toBeInstanceOf(ErroEmail);
    expect(erro.message).toMatch(/delegação/);
    expect(erro.message).not.toContain('pessoa@x.org');
    expect(erro.message).not.toContain('segredo-do-texto');
  });

  it('sem delegação no domínio, o erro explica o que a administração do Google faz', async () => {
    const f = (async () => new Response('{}')) as unknown as typeof fetch;
    const e = new EnviadorGmail(
      'nao-responda@inst.org.br',
      async () => {
        throw new Error('unauthorized_client');
      },
      f,
    );
    await expect(e.enviar(msg)).rejects.toThrow(/delegação no domínio/);
  });

  it('Gmail API desativada e limite diário têm texto próprio', async () => {
    const resp = (status: number, corpo: unknown) => (async () => new Response(JSON.stringify(corpo), { status })) as unknown as typeof fetch;
    const desativada = resp(403, { error: { message: 'Gmail API has not been used in project', errors: [{ reason: 'accessNotConfigured' }] } });
    await expect(new EnviadorGmail('a@b.org', async () => 't', desativada).enviar(msg)).rejects.toThrow(/Gmail API não está ativada/);
    await expect(new EnviadorGmail('a@b.org', async () => 't', resp(429, {})).enviar(msg)).rejects.toThrow(/Limite diário/);
  });
});

describe('e-mail de envio no cadastro da instituição', () => {
  it('é opcional, guardado em minúsculas e volta na instituição', async () => {
    await salvarInstituicao(rede, await operadora(), dados());
    expect((await instituicoesCadastradas(rede))[0].remetenteEmail).toBeUndefined();
    const { instituicoes } = await painelDaRede(rede, await operadora());
    await salvarInstituicao(rede, await operadora(), dados({ remetenteEmail: 'Nao-Responda@Inst-A.org.br' }), { id: instituicoes[0].id, versao: instituicoes[0].versao });
    expect((await instituicoesCadastradas(rede))[0].remetenteEmail).toBe('nao-responda@inst-a.org.br');
  });

  it('precisa ser do domínio da instituição', async () => {
    await expect(salvarInstituicao(rede, await operadora(), dados({ remetenteEmail: 'avisos@gmail.com' }))).rejects.toThrow(/domínio da instituição/);
    await expect(salvarInstituicao(rede, await operadora(), dados({ remetenteEmail: 'nao-responda@outro.org.br' }))).rejects.toThrow(/domínio da instituição/);
    expect(await instituicoesCadastradas(rede)).toHaveLength(0);
  });

  it('alterar o e-mail de envio registra auditoria só com a coluna', async () => {
    await salvarInstituicao(rede, await operadora(), dados());
    const { instituicoes } = await painelDaRede(rede, await operadora());
    await salvarInstituicao(rede, await operadora(), dados({ remetenteEmail: 'nao-responda@inst-a.org.br' }), { id: instituicoes[0].id, versao: instituicoes[0].versao });
    const linhas = (await lerTabela(rede, RegistrosAuditoria)).ativos();
    const alteracao = linhas.find((l) => l.acao === 'alteracao');
    expect(alteracao?.detalhes).toContain('remetente_email');
    expect(JSON.stringify(linhas)).not.toContain('nao-responda@inst-a.org.br');
  });

  it('só a Administração da rede altera o e-mail de envio', async () => {
    const estranho = await autorizadorDaRede(rede, 'alguem@inst-a.org.br', ['rede@operadora.org']);
    await expect(salvarInstituicao(rede, estranho, dados({ remetenteEmail: 'nao-responda@inst-a.org.br' }))).rejects.toBeInstanceOf(ErroPermissao);
  });
});

describe('e-mail de teste', () => {
  const inst = { id: 'i1', nome: 'Instituição A', remetenteEmail: 'nao-responda@inst-a.org.br' };

  it('vai só para quem pediu, sem dado da instituição além do nome, e registra auditoria', async () => {
    const e = new EnviadorMemoria('nao-responda@inst-a.org.br');
    await enviarEmailDeTeste(rede, await operadora(), inst, e);
    expect(e.enviadas).toHaveLength(1);
    expect(e.enviadas[0].para).toEqual(['rede@operadora.org']);
    expect(e.enviadas[0].cco).toBeUndefined();
    const auditoria = (await lerTabela(rede, RegistrosAuditoria)).ativos();
    expect(auditoria).toHaveLength(1);
    expect(auditoria[0].usuario).toBe('rede@operadora.org');
  });

  it('sem e-mail de envio, avisa a administração e não envia', async () => {
    await expect(enviarEmailDeTeste(rede, await operadora(), { ...inst, remetenteEmail: undefined }, null)).rejects.toThrow(/ainda não tem o e-mail de envio/);
  });

  it('falha do Gmail volta como mensagem à administração, sem auditar envio que não houve', async () => {
    const e = new EnviadorMemoria('nao-responda@inst-a.org.br');
    e.falhar = 'Delegação não autorizada.';
    await expect(enviarEmailDeTeste(rede, await operadora(), inst, e)).rejects.toThrow('Delegação não autorizada.');
    expect((await lerTabela(rede, RegistrosAuditoria)).ativos()).toHaveLength(0);
  });

  it('quem não administra a rede não envia', async () => {
    const estranho = await autorizadorDaRede(rede, 'alguem@inst-a.org.br', ['rede@operadora.org']);
    await expect(enviarEmailDeTeste(rede, estranho, inst, new EnviadorMemoria('x@y.org'))).rejects.toBeInstanceOf(ErroPermissao);
  });
});

describe('chave da rotina', () => {
  const CHAVE = 'x'.repeat(40);

  it('só passa com a chave certa; sem chave configurada ou curta demais, nada passa', async () => {
    const { chaveDaRotinaValida } = await import('@/plataforma/rotina');
    expect(chaveDaRotinaValida(CHAVE, CHAVE)).toBe(true);
    expect(chaveDaRotinaValida('y'.repeat(40), CHAVE)).toBe(false);
    expect(chaveDaRotinaValida(CHAVE.slice(1), CHAVE)).toBe(false);
    expect(chaveDaRotinaValida(null, CHAVE)).toBe(false);
    expect(chaveDaRotinaValida('', '')).toBe(false);
    expect(chaveDaRotinaValida('curta', 'curta')).toBe(false);
    expect(chaveDaRotinaValida(CHAVE, undefined)).toBe(false);
  });

  it('a rota recusa chamada sem a chave e aceita com ela, devolvendo só contagens', async () => {
    vi.stubEnv('ROTINA_TOKEN', CHAVE);
    vi.stubEnv('MODO_DEMONSTRACAO', '1');
    const { POST } = await import('@/app/api/rotina/route');
    const sem = await POST(new Request('http://x/api/rotina', { method: 'POST' }));
    expect(sem.status).toBe(401);
    const errada = await POST(new Request('http://x/api/rotina', { method: 'POST', headers: { authorization: 'Bearer outra' } }));
    expect(errada.status).toBe(401);
    const ok = await POST(new Request('http://x/api/rotina', { method: 'POST', headers: { authorization: `Bearer ${CHAVE}` } }));
    expect(ok.status).toBe(200);
    const corpo = (await ok.json()) as { instituicoes: number };
    expect(corpo.instituicoes).toBe(2);
    vi.unstubAllEnvs();
  });
});
