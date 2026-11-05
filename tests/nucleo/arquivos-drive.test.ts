/**
 * Pasta de anexos no Drive (ADR-014): o Elo explica o que fazer quando o
 * Google recusa, e abre o envio direto pelo navegador. Sem acesso real: respostas falsas.
 */
import { describe, expect, it } from 'vitest';
import { ArquivosGoogleDrive } from '@/nucleo/armazenamento/arquivos';

const resposta = (status: number, corpo: unknown, cabecalhos: Record<string, string> = {}) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json', ...cabecalhos } });
const drive = (r: () => Response, pedidos: { url: string; init?: RequestInit }[] = []) =>
  new ArquivosGoogleDrive(async () => 'token', 'pasta123', (async (url: string, init?: RequestInit) => {
    pedidos.push({ url, init });
    return r();
  }) as typeof fetch);

describe('pasta de anexos no Drive', () => {
  it('API do Drive desativada: diz para ativar no Google Cloud', async () => {
    const r = await drive(() =>
      resposta(403, {
        error: { message: 'Google Drive API has not been used in project 123 before or it is disabled.', errors: [{ reason: 'accessNotConfigured' }] },
      }),
    ).conferirPasta();
    expect(r).toMatchObject({
      ok: false,
      motivo: expect.stringMatching(/Google Drive API não está ativada.*Biblioteca.*Google: Google Drive API has not been used/),
    });
  });

  it('outros casos: sem acesso, fora de unidade compartilhada, sem poder gravar, tudo certo', async () => {
    expect(await drive(() => resposta(404, {})).conferirPasta()).toMatchObject({ ok: false, motivo: expect.stringMatching(/não foi encontrada/) });
    expect(await drive(() => resposta(403, { error: { message: 'x', errors: [{ reason: 'forbidden' }] } })).conferirPasta()).toMatchObject({
      motivo: expect.stringMatching(/Gerente de conteúdo/),
    });
    const pasta = (extra: object) => resposta(200, { name: 'Anexos', mimeType: 'application/vnd.google-apps.folder', ...extra });
    expect(await drive(() => pasta({ capabilities: { canAddChildren: true } })).conferirPasta()).toMatchObject({
      motivo: expect.stringMatching(/unidade compartilhada/),
    });
    expect(await drive(() => pasta({ driveId: 'd1', capabilities: { canAddChildren: false } })).conferirPasta()).toMatchObject({
      motivo: expect.stringMatching(/não pode gravar/),
    });
    expect(await drive(() => pasta({ driveId: 'd1', capabilities: { canAddChildren: true } })).conferirPasta()).toEqual({ ok: true, nome: 'Anexos' });
  });

  it('abre o envio retomável na pasta, com a origem do Elo para o navegador poder enviar', async () => {
    const pedidos: { url: string; init?: RequestInit }[] = [];
    const r = await drive(() => resposta(200, {}, { Location: 'https://upload.exemplo/sessao' }), pedidos).iniciarEnvio({
      nome: 'f.jpg',
      tipo: 'image/jpeg',
      tamanho: 1000,
      origem: 'https://elo.exemplo',
    });
    expect(r.url).toBe('https://upload.exemplo/sessao');
    const cab = pedidos[0].init!.headers as Record<string, string>;
    expect(pedidos[0].url).toMatch(/uploadType=resumable&supportsAllDrives=true/);
    expect(cab.Origin).toBe('https://elo.exemplo');
    expect(JSON.parse(String(pedidos[0].init!.body))).toEqual({ name: 'f.jpg', parents: ['pasta123'], mimeType: 'image/jpeg' });
  });
});
