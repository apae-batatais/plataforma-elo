/**
 * Pasta da instituição no Drive compartilhado (ADR-018): onde o Elo cria as
 * próprias planilhas e a pasta de anexos.
 *
 * - Cada arquivo criado recebe uma marca invisível (propriedade de app do
 *   Drive) com "<instituição>/<chave>", para o Elo nunca criar duplicata,
 *   mesmo que alguém renomeie o arquivo.
 * - O Elo só cria e marca. Nunca apaga nem move arquivo ou pasta.
 * - Criar arquivo vazio não lê o conteúdo de nenhuma planilha.
 */
import { ErroArmazenamento } from './armazenamento';
import { motivoDoDrive } from './arquivos';

export type TipoDeItem = 'planilha' | 'pasta';
export type SituacaoNoDrive = 'existe' | 'lixeira' | 'ausente';

export interface ArmazenamentoPastas {
  /** A pasta existe, está num Drive compartilhado e a conta de serviço pode criar arquivos nela. */
  conferirPasta(pasta: string): Promise<{ ok: true; nome: string } | { ok: false; motivo: string }>;
  /** O arquivo existe, está na lixeira ou não foi encontrado. */
  situacao(id: string): Promise<SituacaoNoDrive>;
  /** Procura, dentro da pasta, um item não apagado com a marca. */
  procurar(pasta: string, marca: string): Promise<string | null>;
  /** Cria um item vazio dentro da pasta, já com a marca. Devolve o ID. */
  criar(pasta: string, item: { nome: string; tipo: TipoDeItem; marca: string }): Promise<string>;
  /** Põe a marca num item que já existe (não muda nome, conteúdo nem lugar). */
  marcar(id: string, marca: string): Promise<void>;
}

/** Extrai o ID da pasta de um link do Drive (…/folders/<id>?…) ou de um ID colado direto. */
export function idDaPasta(texto: string): string | null {
  const t = texto.trim();
  const doLink = /\/folders\/([\w-]+)/.exec(t);
  if (doLink) return doLink[1];
  return /^[\w-]{10,}$/.test(t) ? t : null;
}

export const ENDERECO_DO_ARQUIVO = (id: string, tipo: TipoDeItem) =>
  tipo === 'pasta' ? `https://drive.google.com/drive/folders/${id}` : `https://docs.google.com/spreadsheets/d/${id}`;

// ---------------------------------------------------------------------------
// Google Drive
// ---------------------------------------------------------------------------

const DRIVE = 'https://www.googleapis.com/drive/v3/files';
const MIME = { planilha: 'application/vnd.google-apps.spreadsheet', pasta: 'application/vnd.google-apps.folder' } as const;
const CHAVE_DA_MARCA = 'elo_item';

export class PastasGoogleDrive implements ArmazenamentoPastas {
  constructor(
    private readonly token: () => Promise<string>,
    private readonly buscar: typeof fetch = fetch,
  ) {}

  private async chamar(url: string, init: RequestInit = {}) {
    return this.buscar(url, {
      ...init,
      headers: { Authorization: `Bearer ${await this.token()}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });
  }

  async conferirPasta(pasta: string) {
    const r = await this.chamar(`${DRIVE}/${encodeURIComponent(pasta)}?supportsAllDrives=true&fields=id,name,mimeType,driveId,trashed,capabilities(canAddChildren)`);
    if (r.status === 404) return { ok: false as const, motivo: 'A pasta não foi encontrada ou não foi compartilhada com a conta de serviço.' };
    if (!r.ok) return { ok: false as const, motivo: await motivoDoDrive(r) };
    const f = (await r.json()) as { name: string; mimeType: string; driveId?: string; trashed?: boolean; capabilities?: { canAddChildren?: boolean } };
    if (f.mimeType !== MIME.pasta) return { ok: false as const, motivo: 'O link informado não é de uma pasta.' };
    if (f.trashed) return { ok: false as const, motivo: 'A pasta está na lixeira do Drive.' };
    if (!f.driveId) return { ok: false as const, motivo: 'A pasta precisa ficar num Drive compartilhado (a conta de serviço não tem espaço próprio no Drive).' };
    if (!f.capabilities?.canAddChildren)
      return { ok: false as const, motivo: 'A conta de serviço não pode criar arquivos na pasta: dê a ela o papel de Gerente de conteúdo.' };
    return { ok: true as const, nome: f.name };
  }

  async situacao(id: string): Promise<SituacaoNoDrive> {
    if (!/^[\w-]{10,}$/.test(id)) return 'ausente';
    const r = await this.chamar(`${DRIVE}/${encodeURIComponent(id)}?supportsAllDrives=true&fields=id,trashed`);
    if (r.status === 404) return 'ausente';
    if (!r.ok) throw new ErroArmazenamento(`Não foi possível conferir o arquivo no Drive. ${await motivoDoDrive(r)}`);
    return ((await r.json()) as { trashed?: boolean }).trashed ? 'lixeira' : 'existe';
  }

  async procurar(pasta: string, marca: string) {
    const aspas = (t: string) => t.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const q = `'${aspas(pasta)}' in parents and trashed = false and appProperties has { key='${CHAVE_DA_MARCA}' and value='${aspas(marca)}' }`;
    const params = new URLSearchParams({ q, fields: 'files(id)', pageSize: '2', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true', corpora: 'allDrives' });
    const r = await this.chamar(`${DRIVE}?${params}`);
    if (!r.ok) throw new ErroArmazenamento(`Não foi possível procurar na pasta. ${await motivoDoDrive(r)}`);
    const { files } = (await r.json()) as { files?: { id: string }[] };
    return files?.[0]?.id ?? null;
  }

  async criar(pasta: string, item: { nome: string; tipo: TipoDeItem; marca: string }) {
    const r = await this.chamar(`${DRIVE}?supportsAllDrives=true&fields=id`, {
      method: 'POST',
      body: JSON.stringify({ name: item.nome, mimeType: MIME[item.tipo], parents: [pasta], appProperties: { [CHAVE_DA_MARCA]: item.marca } }),
    });
    if (!r.ok) throw new ErroArmazenamento(`Não foi possível criar "${item.nome}" na pasta. ${await motivoDoDrive(r)}`);
    return ((await r.json()) as { id: string }).id;
  }

  async marcar(id: string, marca: string) {
    const r = await this.chamar(`${DRIVE}/${encodeURIComponent(id)}?supportsAllDrives=true&fields=id`, {
      method: 'PATCH',
      body: JSON.stringify({ appProperties: { [CHAVE_DA_MARCA]: marca } }),
    });
    if (!r.ok) throw new ErroArmazenamento(`Não foi possível marcar o arquivo. ${await motivoDoDrive(r)}`);
  }
}

// ---------------------------------------------------------------------------
// Memória (demonstração e testes)
// ---------------------------------------------------------------------------

interface ItemMemoria {
  pasta: string | null;
  nome: string;
  tipo: TipoDeItem;
  marca: string | null;
  lixeira: boolean;
}

export class PastasMemoria implements ArmazenamentoPastas {
  readonly itens = new Map<string, ItemMemoria>();
  /** Pastas que a conta de serviço enxerga e se aceitam arquivos novos. */
  private readonly pastas = new Map<string, { nome: string; motivo?: string }>();
  private seq = 0;

  /** `aoCriar` deixa o teste (ou a demonstração) criar a planilha de verdade na memória. */
  constructor(private readonly aoCriar?: (id: string, item: { nome: string; tipo: TipoDeItem }) => void) {}

  /** Cadastra uma pasta que existe; `motivo` simula uma pasta que não serve (ex.: sem permissão). */
  adicionarPasta(id: string, nome = 'Elo · pasta', motivo?: string) {
    this.pastas.set(id, { nome, motivo });
  }

  /** Cadastra um arquivo que já existia (por exemplo, as planilhas atuais da instituição). */
  adicionarItem(id: string, item: Partial<ItemMemoria> = {}) {
    this.itens.set(id, { pasta: null, nome: id, tipo: 'planilha', marca: null, lixeira: false, ...item });
  }

  async conferirPasta(pasta: string) {
    const p = this.pastas.get(pasta);
    if (!p) return { ok: false as const, motivo: 'A pasta não foi encontrada ou não foi compartilhada com a conta de serviço.' };
    return p.motivo ? { ok: false as const, motivo: p.motivo } : { ok: true as const, nome: p.nome };
  }

  async situacao(id: string): Promise<SituacaoNoDrive> {
    const i = this.itens.get(id);
    return !i ? 'ausente' : i.lixeira ? 'lixeira' : 'existe';
  }

  async procurar(pasta: string, marca: string) {
    for (const [id, i] of this.itens) if (i.pasta === pasta && i.marca === marca && !i.lixeira) return id;
    return null;
  }

  async criar(pasta: string, item: { nome: string; tipo: TipoDeItem; marca: string }) {
    const id = `memoria-${(this.seq++).toString(36)}-${item.marca.replace(/[^\w-]/g, '-')}`.padEnd(24, 'x');
    this.itens.set(id, { pasta, nome: item.nome, tipo: item.tipo, marca: item.marca, lixeira: false });
    this.aoCriar?.(id, item);
    return id;
  }

  async marcar(id: string, marca: string) {
    const i = this.itens.get(id);
    if (i) i.marca = marca;
  }
}
