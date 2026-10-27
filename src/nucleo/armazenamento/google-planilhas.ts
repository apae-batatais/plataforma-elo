/**
 * Armazenamento no Google Planilhas, acessado pela conta de serviço da plataforma.
 *
 * As planilhas ficam compartilhadas (como Editor) só com a conta de serviço e
 * com a Diretoria, que é a dona. A equipe acessa os dados apenas pelo site.
 */
import { ErroArmazenamento, type Armazenamento, type Linha } from './armazenamento';

const API = 'https://sheets.googleapis.com/v4/spreadsheets';

export type ObterToken = () => Promise<string>;
type Fetch = typeof fetch;

/** Nome de aba entre aspas, como a API exige ('Minha Aba'!A1). */
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
        `Sem acesso à planilha ${planilha}. Compartilhe a planilha com a conta de serviço da plataforma como Editor.`,
      );
    }
    if (resposta.status === 404) throw new ErroArmazenamento(`Planilha ${planilha} não encontrada.`);
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

  async garantirAba(planilha: string, aba: string, cabecalho: readonly string[]) {
    const meta = (await this.chamar(planilha, '?fields=sheets.properties.title')) as {
      sheets?: { properties?: { title?: string } }[];
    };
    const existe = (meta.sheets ?? []).some((s) => s.properties?.title === aba);
    if (!existe) {
      await this.chamar(planilha, ':batchUpdate', {
        method: 'POST',
        body: JSON.stringify({ requests: [{ addSheet: { properties: { title: aba } } }] }),
      });
    } else {
      const atual = await this.lerAbas(planilha, [aba]);
      if ((atual[aba] ?? []).length > 0) return 'ja_existia' as const;
    }
    const params = new URLSearchParams({ valueInputOption: 'RAW' });
    await this.chamar(planilha, `/values/${encodeURIComponent(intervalo(aba, 'A1'))}?${params}`, {
      method: 'PUT',
      body: JSON.stringify({ values: [cabecalho] }),
    });
    return 'criada' as const;
  }
}
