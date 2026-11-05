/**
 * Arquivos (fotos e vídeos) da instituição, fora das planilhas (ADR-014).
 *
 * - Produção: uma unidade compartilhada do Google Drive da instituição,
 *   acessada pela mesma conta de serviço das planilhas. O navegador manda o
 *   arquivo direto para o Drive (envio retomável), sem passar pelo servidor.
 * - Demonstração: em memória, enviado para uma rota do próprio Elo.
 *
 * Ninguém abre o arquivo pelo Drive: o Elo lê e entrega só a quem pode ver
 * o registro a que ele pertence (Autorizador), registrando a leitura.
 */

export interface ArquivoGuardado {
  id: string;
  nome: string;
  tipo: string;
  tamanho: number;
}

export interface TrechoLido {
  dados: Uint8Array;
  /** Tamanho total do arquivo. */
  total: number;
  inicio: number;
  fim: number;
  tipo: string;
}

export interface ArmazenamentoArquivos {
  /**
   * Abre um envio e devolve o endereço para onde o navegador manda o arquivo
   * (PUT, com o corpo sendo o próprio arquivo). A resposta do PUT é um JSON com o `id`.
   */
  iniciarEnvio(a: { nome: string; tipo: string; tamanho: number; origem: string }): Promise<{ url: string }>;
  /** Confere um arquivo enviado: existe, está na pasta da instituição e não foi para a lixeira. */
  conferir(id: string): Promise<ArquivoGuardado | null>;
  /** Lê um trecho (para vídeo, aos poucos). `fim` é inclusivo. */
  ler(id: string, trecho: { inicio: number; fim: number }): Promise<TrechoLido>;
  /** Confere se a pasta existe e se a conta de serviço pode gravar nela (para a conferência). */
  conferirPasta(): Promise<{ ok: true; nome: string } | { ok: false; motivo: string }>;
}

export class ErroArquivo extends Error {}

// ---------------------------------------------------------------------------
// Google Drive (unidade compartilhada)
// ---------------------------------------------------------------------------

const DRIVE = 'https://www.googleapis.com/drive/v3/files';
const ENVIO = 'https://www.googleapis.com/upload/drive/v3/files';

export class ArquivosGoogleDrive implements ArmazenamentoArquivos {
  constructor(
    private readonly token: () => Promise<string>,
    private readonly pasta: string,
    private readonly buscar: typeof fetch = fetch,
  ) {}

  private async cabecalhos(extra: Record<string, string> = {}) {
    return { Authorization: `Bearer ${await this.token()}`, ...extra };
  }

  async iniciarEnvio(a: { nome: string; tipo: string; tamanho: number; origem: string }) {
    const url = `${ENVIO}?uploadType=resumable&supportsAllDrives=true&fields=id,name,mimeType,size`;
    const r = await this.buscar(url, {
      method: 'POST',
      headers: await this.cabecalhos({
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': a.tipo,
        'X-Upload-Content-Length': String(a.tamanho),
        // O Drive libera o envio pelo navegador (CORS) para esta origem.
        Origin: a.origem,
      }),
      body: JSON.stringify({ name: a.nome, parents: [this.pasta], mimeType: a.tipo }),
    });
    const local = r.headers.get('location');
    if (!r.ok || !local)
      throw new ErroArquivo(`Não foi possível abrir o envio do arquivo (Drive respondeu ${r.status}). Confira a pasta de anexos da instituição.`);
    return { url: local };
  }

  async conferir(id: string): Promise<ArquivoGuardado | null> {
    if (!/^[\w-]{10,}$/.test(id)) return null;
    const r = await this.buscar(`${DRIVE}/${id}?supportsAllDrives=true&fields=id,name,mimeType,size,parents,trashed`, { headers: await this.cabecalhos() });
    if (r.status === 404) return null;
    if (!r.ok) throw new ErroArquivo(`Não foi possível conferir o arquivo (Drive respondeu ${r.status}).`);
    const f = (await r.json()) as { id: string; name: string; mimeType: string; size?: string; parents?: string[]; trashed?: boolean };
    if (f.trashed || !f.parents?.includes(this.pasta)) return null;
    return { id: f.id, nome: f.name, tipo: f.mimeType, tamanho: Number(f.size ?? 0) };
  }

  async ler(id: string, trecho: { inicio: number; fim: number }): Promise<TrechoLido> {
    const r = await this.buscar(`${DRIVE}/${id}?alt=media&supportsAllDrives=true`, {
      headers: await this.cabecalhos({ Range: `bytes=${trecho.inicio}-${trecho.fim}` }),
    });
    if (!r.ok) throw new ErroArquivo(`Não foi possível ler o arquivo (Drive respondeu ${r.status}).`);
    const dados = new Uint8Array(await r.arrayBuffer());
    const faixa = /bytes (\d+)-(\d+)\/(\d+)/.exec(r.headers.get('content-range') ?? '');
    const total = faixa ? Number(faixa[3]) : dados.length;
    const inicio = faixa ? Number(faixa[1]) : 0;
    return { dados, total, inicio, fim: inicio + dados.length - 1, tipo: r.headers.get('content-type') ?? 'application/octet-stream' };
  }

  async conferirPasta() {
    const r = await this.buscar(`${DRIVE}/${this.pasta}?supportsAllDrives=true&fields=id,name,mimeType,driveId,capabilities(canAddChildren)`, {
      headers: await this.cabecalhos(),
    });
    if (r.status === 404) return { ok: false as const, motivo: 'A pasta não foi encontrada ou não foi compartilhada com a conta de serviço.' };
    if (!r.ok) return { ok: false as const, motivo: `O Drive respondeu ${r.status}.` };
    const f = (await r.json()) as { name: string; mimeType: string; driveId?: string; capabilities?: { canAddChildren?: boolean } };
    if (f.mimeType !== 'application/vnd.google-apps.folder') return { ok: false as const, motivo: 'O ID informado não é de uma pasta.' };
    if (!f.driveId)
      return { ok: false as const, motivo: 'A pasta precisa ficar numa unidade compartilhada (a conta de serviço não tem espaço próprio no Drive).' };
    if (!f.capabilities?.canAddChildren)
      return { ok: false as const, motivo: 'A conta de serviço não pode gravar na pasta: dê a ela o papel de Gerente de conteúdo.' };
    return { ok: true as const, nome: f.name };
  }
}

// ---------------------------------------------------------------------------
// Memória (demonstração e testes)
// ---------------------------------------------------------------------------

/** Na demonstração o arquivo passa pelo servidor, que aceita no máximo isto. */
export const LIMITE_ENVIO_DEMONSTRACAO = 4 * 1024 * 1024;

export class ArquivosMemoria implements ArmazenamentoArquivos {
  private readonly arquivos = new Map<string, { nome: string; tipo: string; dados: Uint8Array }>();
  private readonly envios = new Map<string, { nome: string; tipo: string; tamanho: number }>();
  private seq = 0;

  /** `rota` recebe o código do envio e devolve o endereço da rota que aceita o PUT. */
  constructor(private readonly rota: (codigo: string) => string = (c) => `/envio/${c}`) {}

  async iniciarEnvio(a: { nome: string; tipo: string; tamanho: number; origem: string }) {
    if (a.tamanho > LIMITE_ENVIO_DEMONSTRACAO) {
      throw new ErroArquivo('Na demonstração, cada arquivo pode ter até 4 MB. Em produção, o limite é o da requisição.');
    }
    const codigo = `${Date.now().toString(36)}${(this.seq++).toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    this.envios.set(codigo, { nome: a.nome, tipo: a.tipo, tamanho: a.tamanho });
    return { url: this.rota(codigo) };
  }

  /** Recebe o arquivo do envio aberto (rota da demonstração). */
  receber(codigo: string, dados: Uint8Array): ArquivoGuardado {
    const envio = this.envios.get(codigo);
    if (!envio) throw new ErroArquivo('Envio não encontrado ou já usado.');
    if (dados.length !== envio.tamanho) throw new ErroArquivo('O arquivo chegou incompleto. Tente de novo.');
    this.envios.delete(codigo);
    const id = `arquivo-${codigo}`;
    this.arquivos.set(id, { nome: envio.nome, tipo: envio.tipo, dados });
    return { id, nome: envio.nome, tipo: envio.tipo, tamanho: dados.length };
  }

  async conferir(id: string) {
    const f = this.arquivos.get(id);
    return f ? { id, nome: f.nome, tipo: f.tipo, tamanho: f.dados.length } : null;
  }

  async ler(id: string, trecho: { inicio: number; fim: number }) {
    const f = this.arquivos.get(id);
    if (!f) throw new ErroArquivo('Arquivo não encontrado.');
    const fim = Math.min(trecho.fim, f.dados.length - 1);
    return { dados: f.dados.slice(trecho.inicio, fim + 1), total: f.dados.length, inicio: trecho.inicio, fim, tipo: f.tipo };
  }

  async conferirPasta() {
    return { ok: true as const, nome: 'Arquivos da demonstração (em memória)' };
  }
}
