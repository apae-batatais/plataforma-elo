/**
 * Conferência das chamadas à API do Google Planilhas, sem rede:
 * um "fetch" falso registra o que seria enviado e devolve respostas prontas.
 */
import { describe, expect, it } from 'vitest';
import { ArmazenamentoGooglePlanilhas } from '@/nucleo/armazenamento/google-planilhas';

type Chamada = { url: string; method: string; body?: unknown; auth?: string };

function fetchFalso(respostas: (c: Chamada) => { status?: number; json?: unknown; text?: string }) {
  const chamadas: Chamada[] = [];
  const fn = (async (url: string, init: RequestInit = {}) => {
    const c: Chamada = {
      url: decodeURIComponent(String(url).replace(/\+/g, ' ')),
      method: init.method ?? 'GET',
      body: init.body ? JSON.parse(String(init.body)) : undefined,
      auth: (init.headers as Record<string, string>)?.Authorization,
    };
    chamadas.push(c);
    const r = respostas(c);
    const status = r.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => r.json ?? {},
      text: async () => r.text ?? '',
    } as Response;
  }) as typeof fetch;
  return { fn, chamadas };
}

const token = async () => 'token-de-teste';

describe('armazenamento no Google Planilhas', () => {
  it('lê várias abas com uma chamada batchGet, valores sem formatação', async () => {
    const { fn, chamadas } = fetchFalso(() => ({
      json: { valueRanges: [{ values: [['id', 'nome'], ['1', 'Ana']] }, {}] },
    }));
    const a = new ArmazenamentoGooglePlanilhas(token, fn);
    const r = await a.lerAbas('PLAN1', ['Pessoas', "Aba d'Água"]);
    expect(r).toEqual({ Pessoas: [['id', 'nome'], ['1', 'Ana']], "Aba d'Água": [] });
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].url).toContain('/spreadsheets/PLAN1/values:batchGet?');
    expect(chamadas[0].url).toContain("ranges='Pessoas'");
    expect(chamadas[0].url).toContain("ranges='Aba d''Água'");
    expect(chamadas[0].url).toContain('valueRenderOption=UNFORMATTED_VALUE');
    expect(chamadas[0].auth).toBe('Bearer token-de-teste');
  });

  it('acrescenta linhas sem interpretar o texto (RAW) e inserindo novas linhas', async () => {
    const { fn, chamadas } = fetchFalso(() => ({ json: {} }));
    await new ArmazenamentoGooglePlanilhas(token, fn).acrescentar('PLAN1', 'Pessoas', [['1', '=1+1']]);
    expect(chamadas[0].method).toBe('POST');
    expect(chamadas[0].url).toContain("/values/'Pessoas'!A1:append?");
    expect(chamadas[0].url).toContain('valueInputOption=RAW');
    expect(chamadas[0].url).toContain('insertDataOption=INSERT_ROWS');
    expect(chamadas[0].body).toEqual({ values: [['1', '=1+1']] });
  });

  it('regrava uma linha inteira e nunca o cabeçalho', async () => {
    const { fn, chamadas } = fetchFalso(() => ({ json: {} }));
    const a = new ArmazenamentoGooglePlanilhas(token, fn);
    await a.gravarLinha('PLAN1', 'Pessoas', 7, ['1', 'Ana']);
    expect(chamadas[0].method).toBe('PUT');
    expect(chamadas[0].url).toContain("/values/'Pessoas'!A7?valueInputOption=RAW");
    await expect(a.gravarLinha('PLAN1', 'Pessoas', 1, ['x'])).rejects.toThrow(/cabeçalho/);
  });

  it('cria a aba que falta e grava o cabeçalho; aba existente e preenchida fica como está', async () => {
    const { fn, chamadas } = fetchFalso((c) => {
      if (c.url.includes('fields=sheets.properties.title')) return { json: { sheets: [{ properties: { title: 'Existente' } }] } };
      if (c.url.includes('batchGet')) return { json: { valueRanges: [{ values: [['id']] }] } };
      return { json: {} };
    });
    const a = new ArmazenamentoGooglePlanilhas(token, fn);
    expect(await a.garantirAba('PLAN1', 'Nova', ['id', 'nome'])).toBe('criada');
    expect(chamadas.find((c) => c.url.endsWith(':batchUpdate'))?.body).toEqual({
      requests: [{ addSheet: { properties: { title: 'Nova' } } }],
    });
    expect(chamadas.at(-1)?.body).toEqual({ values: [['id', 'nome']] });
    expect(await a.garantirAba('PLAN1', 'Existente', ['id'])).toBe('ja_existia');
  });

  it('sem acesso: explica que é preciso compartilhar com a conta de serviço', async () => {
    const { fn } = fetchFalso(() => ({ status: 403 }));
    await expect(new ArmazenamentoGooglePlanilhas(token, fn).lerAbas('PLAN1', ['A'])).rejects.toThrow(
      /Compartilhe a planilha com a conta de serviço/,
    );
  });

  it('limite de uso do Google: tenta de novo antes de desistir', async () => {
    let n = 0;
    const { fn, chamadas } = fetchFalso(() => (++n < 3 ? { status: 429 } : { json: { valueRanges: [{ values: [] }] } }));
    await new ArmazenamentoGooglePlanilhas(token, fn).lerAbas('PLAN1', ['A']);
    expect(chamadas).toHaveLength(3);
  });
});
