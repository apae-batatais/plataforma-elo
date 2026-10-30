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

  it('cria as abas que faltam e preenche as vazias em poucas chamadas; aba com conteúdo fica como está', async () => {
    const { fn, chamadas } = fetchFalso((c) => {
      if (c.url.includes('fields=sheets'))
        return { json: { sheets: [{ properties: { title: 'Cheia' } }, { properties: { title: 'Vazia' } }] } };
      if (c.url.includes('batchGet')) return { json: { valueRanges: [{ values: [['id']] }, {}] } };
      return { json: {} };
    });
    const a = new ArmazenamentoGooglePlanilhas(token, fn);
    const criadas = await a.garantirAbas('PLAN1', [
      { aba: 'Nova1', cabecalho: ['id', 'nome'] },
      { aba: 'Cheia', cabecalho: ['id'] },
      { aba: 'Vazia', cabecalho: ['id', 'x'] },
      { aba: 'Nova2', cabecalho: ['id'] },
    ]);
    expect(criadas).toEqual(['Nova1', 'Nova2', 'Vazia']);
    expect(chamadas).toHaveLength(4);
    expect(chamadas.find((c) => c.url.endsWith(':batchUpdate'))?.body).toEqual({
      requests: [{ addSheet: { properties: { title: 'Nova1' } } }, { addSheet: { properties: { title: 'Nova2' } } }],
    });
    expect(chamadas.at(-1)?.url).toContain('/values:batchUpdate');
    expect(chamadas.at(-1)?.body).toEqual({
      valueInputOption: 'RAW',
      data: [
        { range: "'Nova1'!A1", values: [['id', 'nome']] },
        { range: "'Nova2'!A1", values: [['id']] },
        { range: "'Vazia'!A1", values: [['id', 'x']] },
      ],
    });
  });

  it('aba que já existe sem colunas novas: acrescenta só as que faltam, no fim do cabeçalho', async () => {
    const { fn, chamadas } = fetchFalso((c) => {
      if (c.url.includes('fields=sheets')) return { json: { sheets: [{ properties: { title: 'Despesas' } }] } };
      if (c.url.includes('batchGet')) return { json: { valueRanges: [{ values: [['id', 'versao', 'descricao']] }] } };
      return { json: {} };
    });
    const r = await new ArmazenamentoGooglePlanilhas(token, fn).garantirAbas('PLAN1', [{ aba: 'Despesas', cabecalho: ['id', 'versao', 'descricao', 'categoria', 'motivo'] }]);
    expect(r).toEqual(['Despesas (colunas novas: categoria, motivo)']);
    expect(chamadas.at(-1)?.body).toEqual({ valueInputOption: 'RAW', data: [{ range: "'Despesas'!D1", values: [['categoria', 'motivo']] }] });
  });

  it('cabeçalho maior que a grade da aba: alarga a aba antes de escrever (erro "exceeds grid limits")', async () => {
    const { fn, chamadas } = fetchFalso((c) => {
      if (c.url.includes('fields=sheets'))
        return { json: { sheets: [{ properties: { title: 'Despesas', sheetId: 7, gridProperties: { columnCount: 30 } } }] } };
      if (c.url.includes('batchGet')) return { json: { valueRanges: [{ values: [Array.from({ length: 30 }, (_, i) => `c${i}`)] }] } };
      return { json: {} };
    });
    const cabecalho = [...Array.from({ length: 30 }, (_, i) => `c${i}`), 'cotado_por'];
    const nova = Array.from({ length: 40 }, (_, i) => `n${i}`);
    const r = await new ArmazenamentoGooglePlanilhas(token, fn).garantirAbas('PLAN1', [
      { aba: 'Despesas', cabecalho },
      { aba: 'Larga', cabecalho: nova },
    ]);
    expect(r).toEqual(['Larga', 'Despesas (colunas novas: cotado_por)']);
    const estrutura = chamadas.find((c) => c.url.endsWith(':batchUpdate'))?.body as { requests: unknown[] };
    expect(estrutura.requests).toEqual([
      { addSheet: { properties: { title: 'Larga', gridProperties: { columnCount: 40 } } } },
      { appendDimension: { sheetId: 7, dimension: 'COLUMNS', length: 1 } },
    ]);
    // A grade é alargada antes de escrever o cabeçalho.
    const ordem = chamadas.map((c) => (c.url.includes('values:batchUpdate') ? 'valores' : c.url.endsWith(':batchUpdate') ? 'estrutura' : 'leitura'));
    expect(ordem.indexOf('estrutura')).toBeLessThan(ordem.indexOf('valores'));
    expect(chamadas.at(-1)?.body).toEqual({ valueInputOption: 'RAW', data: [{ range: "'Despesas'!AE1", values: [['cotado_por']] }] });
  });

  it('sem acesso: explica que é preciso compartilhar com a conta de serviço', async () => {
    const { fn } = fetchFalso(() => ({ status: 403 }));
    await expect(new ArmazenamentoGooglePlanilhas(token, fn).lerAbas('PLAN1', ['A'])).rejects.toThrow(
      /não tem acesso à planilha.*conta de serviço/,
    );
  });

  it('limite de uso do Google: tenta de novo antes de desistir', async () => {
    let n = 0;
    const { fn, chamadas } = fetchFalso(() => (++n < 3 ? { status: 429 } : { json: { valueRanges: [{ values: [] }] } }));
    await new ArmazenamentoGooglePlanilhas(token, fn).lerAbas('PLAN1', ['A']);
    expect(chamadas).toHaveLength(3);
  });
});
