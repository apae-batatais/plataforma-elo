/**
 * Armazenamento no Google Planilhas, acessado pela conta de serviço da plataforma.
 *
 * As planilhas ficam compartilhadas (como Editor) só com a conta de serviço e
 * com a Diretoria, que é a dona. A equipe acessa os dados apenas pelo site.
 */
import { ErroArmazenamento, ErroEstruturaAusente, type Armazenamento, type Linha } from './armazenamento';

const API = 'https://sheets.googleapis.com/v4/spreadsheets';

export type ObterToken = () => Promise<string>;
type Fetch = typeof fetch;

/** Nome de aba entre aspas, como a API exige ('Minha Aba'!A1). */
/** 0 → A, 25 → Z, 26 → AA. */
function letraDaColuna(i: number): string {
  return i < 26 ? String.fromCharCode(65 + i) : letraDaColuna(Math.floor(i / 26) - 1) + letraDaColuna(i % 26);
}

function intervalo(aba: string, celula = ''): string {
  return `'${aba.replace(/'/g, "''")}'${celula ? `!${celula}` : ''}`;
}

export class ArmazenamentoGooglePlanilhas implements Armazenamento {
  constructor(
    private readonly obterToken: ObterToken,
    private readonly fetchFn: Fetch = fetch,
  ) {}

  private async chamar(planilha: string, caminho: string, init: RequestInit = {}, tentativa = 1): Promise<unknown> {
    const token = await this.obterToken();
    const resposta = await this.fetchFn(`${API}/${encodeURIComponent(planilha)}${caminho}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });
    if (resposta.ok) return resposta.json();

    if ((resposta.status === 429 || resposta.status >= 500) && tentativa < 3) {
      await new Promise((r) => setTimeout(r, 500 * tentativa));
      return this.chamar(planilha, caminho, init, tentativa + 1);
    }
    const detalhe = await resposta.text().catch(() => '');
    if (resposta.status === 403) {
      throw new ErroArmazenamento(
        `A conta de serviço da plataforma não tem acesso à planilha ${planilha}. No Drive, adicione o e-mail da conta de serviço como membro do Drive compartilhado (Administrador de conteúdo) ou compartilhe a planilha com ela como Editor. Se o Google Sheets API não estiver ativado no projeto do Google Cloud, ative-o.`,
      );
    }
    if (resposta.status === 404) {
      throw new ErroArmazenamento(
        `Planilha ${planilha} não encontrada. Confira o ID na variável PLANILHAS da Netlify e se a planilha está compartilhada com a conta de serviço.`,
      );
    }
    if (resposta.status === 400 && /Unable to parse range/i.test(detalhe)) {
      throw new ErroEstruturaAusente('As planilhas ainda não têm as abas da plataforma. Rode "Preparar estrutura".');
    }
    if (resposta.status === 429) throw new ErroArmazenamento('Limite de uso do Google atingido. Tente de novo em um minuto.');
    throw new ErroArmazenamento(`Erro ${resposta.status} ao acessar a planilha ${planilha}: ${detalhe.slice(0, 200)}`);
  }

  async lerAbas(planilha: string, abas: readonly string[]) {
    if (abas.length === 0) return {};
    const params = new URLSearchParams({
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
      majorDimension: 'ROWS',
    });
    for (const a of abas) params.append('ranges', intervalo(a));
    const corpo = (await this.chamar(planilha, `/values:batchGet?${params}`)) as {
      valueRanges?: { values?: Linha[] }[];
    };
    const resultado: Record<string, Linha[]> = {};
    abas.forEach((a, i) => {
      resultado[a] = corpo.valueRanges?.[i]?.values ?? [];
    });
    return resultado;
  }

  async acrescentar(planilha: string, aba: string, linhas: Linha[]) {
    if (linhas.length === 0) return;
    const params = new URLSearchParams({ valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS' });
    await this.chamar(planilha, `/values/${encodeURIComponent(intervalo(aba, 'A1'))}:append?${params}`, {
      method: 'POST',
      body: JSON.stringify({ values: linhas }),
    });
  }

  async gravarLinha(planilha: string, aba: string, numero: number, valores: Linha) {
    if (numero < 2) throw new ErroArmazenamento('O cabeçalho não pode ser regravado por aqui.');
    const params = new URLSearchParams({ valueInputOption: 'RAW' });
    await this.chamar(planilha, `/values/${encodeURIComponent(intervalo(aba, `A${numero}`))}?${params}`, {
      method: 'PUT',
      body: JSON.stringify({ values: [valores] }),
    });
  }

  /**
   * Em poucas chamadas: 1) lista as abas existentes; 2) lê a primeira linha das
   * que já existem; 3) cria de uma vez as que faltam; 4) grava de uma vez os
   * cabeçalhos das novas e das vazias.
   */
  async garantirAbas(planilha: string, abas: readonly { aba: string; cabecalho: readonly string[] }[]) {
    if (abas.length === 0) return [];
    const meta = (await this.chamar(planilha, '?fields=sheets.properties(title,sheetId,gridProperties.columnCount)')) as {
      sheets?: { properties?: { title?: string; sheetId?: number; gridProperties?: { columnCount?: number } } }[];
    };
    const existentes = new Set((meta.sheets ?? []).map((s) => s.properties?.title ?? ''));
    // Uma aba nova no Google tem 26 colunas; o cabeçalho não pode passar do limite da grade.
    const COLUNAS_PADRAO = 26;
    const grade = new Map(
      (meta.sheets ?? []).map((s) => [s.properties?.title ?? '', { id: s.properties?.sheetId, colunas: s.properties?.gridProperties?.columnCount ?? COLUNAS_PADRAO }]),
    );
    const faltando = abas.filter((a) => !existentes.has(a.aba));
    const jaExistem = abas.filter((a) => existentes.has(a.aba));

    let vazias: typeof abas = [];
    /** Abas que já existem mas não têm todas as colunas: as que faltam vão para o fim do cabeçalho. */
    const completar: { aba: string; inicio: number; colunas: string[] }[] = [];
    if (jaExistem.length > 0) {
      const params = new URLSearchParams({ majorDimension: 'ROWS' });
      for (const a of jaExistem) params.append('ranges', intervalo(a.aba, '1:1'));
      const corpo = (await this.chamar(planilha, `/values:batchGet?${params}`)) as { valueRanges?: { values?: Linha[] }[] };
      vazias = jaExistem.filter((_, i) => (corpo.valueRanges?.[i]?.values ?? []).length === 0);
      jaExistem.forEach((a, i) => {
        const atual = (corpo.valueRanges?.[i]?.values?.[0] ?? []).map((c) => String(c ?? '').trim());
        if (atual.length === 0) return;
        const faltam = a.cabecalho.filter((c) => !atual.includes(c));
        if (faltam.length) completar.push({ aba: a.aba, inicio: atual.length, colunas: faltam });
      });
    }
    // Abas novas já nascem com colunas suficientes; abas existentes com cabeçalho maior que a grade ganham colunas.
    const alargar = [
      ...vazias.map((a) => ({ aba: a.aba, precisa: a.cabecalho.length })),
      ...completar.map((c) => ({ aba: c.aba, precisa: c.inicio + c.colunas.length })),
    ]
      .map((x) => ({ ...x, ...grade.get(x.aba)! }))
      .filter((x) => x.id !== undefined && x.precisa > x.colunas);
    const pedidos = [
      ...faltando.map((a) => ({
        addSheet: { properties: { title: a.aba, ...(a.cabecalho.length > COLUNAS_PADRAO ? { gridProperties: { columnCount: a.cabecalho.length } } : {}) } },
      })),
      ...alargar.map((x) => ({ appendDimension: { sheetId: x.id, dimension: 'COLUMNS', length: x.precisa - x.colunas } })),
    ];
    if (pedidos.length > 0) {
      await this.chamar(planilha, ':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: pedidos }) });
    }
    const preencher = [...faltando, ...vazias];
    if (preencher.length > 0) {
      await this.chamar(planilha, '/values:batchUpdate', {
        method: 'POST',
        body: JSON.stringify({
          valueInputOption: 'RAW',
          data: preencher.map((a) => ({ range: intervalo(a.aba, 'A1'), values: [a.cabecalho] })),
        }),
      });
    }
    if (completar.length > 0) {
      await this.chamar(planilha, '/values:batchUpdate', {
        method: 'POST',
        body: JSON.stringify({
          valueInputOption: 'RAW',
          data: completar.map((c) => ({ range: intervalo(c.aba, `${letraDaColuna(c.inicio)}1`), values: [c.colunas] })),
        }),
      });
    }
    return [...preencher.map((a) => a.aba), ...completar.map((c) => `${c.aba} (colunas novas: ${c.colunas.join(', ')})`)];
  }

  async listarAbas(planilha: string) {
    const meta = (await this.chamar(planilha, '?fields=sheets.properties.title')) as { sheets?: { properties?: { title?: string } }[] };
    return (meta.sheets ?? []).map((s) => s.properties?.title ?? '').filter(Boolean);
  }

  /** Atalho para uma aba só. */
  async garantirAba(planilha: string, aba: string, cabecalho: readonly string[]) {
    return (await this.garantirAbas(planilha, [{ aba, cabecalho }])).length ? ('criada' as const) : ('ja_existia' as const);
  }
}
