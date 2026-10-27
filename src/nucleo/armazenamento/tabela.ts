/**
 * Tabelas: como a camada de aplicação lê e grava registros nas abas.
 *
 * - Linha 1 de cada aba é o cabeçalho; as colunas são encontradas pelo nome,
 *   então a ordem das colunas na planilha não importa.
 * - Toda tabela de registros tem as colunas de controle abaixo. Nada é apagado:
 *   registros são encerrados (ativo = FALSE).
 * - Edição simultânea: cada registro tem `versao`. Quem grava informa a versão
 *   que leu; se outra pessoa gravou antes, a gravação é recusada (ErroConflito).
 */
import { z } from 'zod';
import { ErroArmazenamento, type Armazenamento, type Celula, type Linha } from './armazenamento';

export const COLUNAS_CONTROLE = ['id', 'versao', 'ativo', 'criado_em', 'criado_por', 'atualizado_em', 'atualizado_por'] as const;

export type Sigilo = 'interno' | 'pessoal' | 'sensivel';

export interface DefinicaoTabela<E extends z.ZodObject> {
  /** Chave da planilha no catálogo (ex.: "nucleo", "auditoria"). */
  planilha: string;
  aba: string;
  /** Campos de negócio, na ordem em que a aba é criada. */
  esquema: E;
  /** Nível de sigilo das colunas que não são "interno". */
  sigilo?: Partial<Record<keyof z.infer<E> & string, Exclude<Sigilo, 'interno'>>>;
  /** "registros" (com colunas de controle) ou "somente_inclusao" (ex.: auditoria). */
  modo?: 'registros' | 'somente_inclusao';
}

export interface Controle {
  id: string;
  versao: number;
  ativo: boolean;
  criado_em: string;
  criado_por: string;
  atualizado_em: string;
  atualizado_por: string;
}

export type Registro<E extends z.ZodObject> = z.infer<E> & Controle;

/** Dados para incluir: campos que aceitam vazio (null) são opcionais. */
export type Entrada<E extends z.ZodObject, S = z.infer<E>> = {
  [K in keyof S as null extends S[K] ? never : K]: S[K];
} & {
  [K in keyof S as null extends S[K] ? K : never]?: S[K];
};

export class ErroConflito extends Error {
  constructor(public readonly id: string) {
    super('Este registro foi alterado por outra pessoa enquanto você editava. Recarregue a página e refaça a alteração.');
  }
}

export class ErroNaoEncontrado extends Error {}

export function definirTabela<E extends z.ZodObject>(def: DefinicaoTabela<E>): DefinicaoTabela<E> {
  return { modo: 'registros', ...def };
}

/** Cabeçalho completo da aba, na ordem em que ela é criada. */
export function cabecalhoDe(def: DefinicaoTabela<z.ZodObject>): string[] {
  const campos = Object.keys(def.esquema.shape);
  return def.modo === 'somente_inclusao' ? campos : [...COLUNAS_CONTROLE, ...campos];
}

// ---------------------------------------------------------------------------
// Conversões entre células e valores
// ---------------------------------------------------------------------------

function vazio(v: unknown): boolean {
  return v === undefined || v === null || v === '';
}

/** Campos de texto obrigatório. */
export const texto = () => z.preprocess((v) => (vazio(v) ? undefined : String(v).trim()), z.string().min(1));
/** Campos de texto opcional (célula vazia vira null). */
export const textoOpcional = () => z.preprocess((v) => (vazio(v) ? null : String(v).trim()), z.string().nullable());
/** Número opcional. */
export const numeroOpcional = () =>
  z.preprocess((v) => (vazio(v) ? null : typeof v === 'number' ? v : Number(String(v).replace(',', '.'))), z.number().nullable());
/** Verdadeiro/falso (aceita TRUE/FALSE, SIM/NÃO). */
export const booleano = () =>
  z.preprocess((v) => {
    if (typeof v === 'boolean') return v;
    const t = String(v ?? '').trim().toUpperCase();
    return ['TRUE', 'VERDADEIRO', 'SIM', '1'].includes(t);
  }, z.boolean());
/** Data AAAA-MM-DD opcional. */
export const dataOpcional = () =>
  z.preprocess((v) => (vazio(v) ? null : String(v).trim()), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data no formato AAAA-MM-DD').nullable());

const esquemaControle = z.object({
  id: texto(),
  versao: z.preprocess((v) => (vazio(v) ? 1 : Number(v)), z.number().int().min(1)),
  ativo: z.preprocess((v) => (vazio(v) ? true : v), booleano()),
  criado_em: textoOpcional().transform((v) => v ?? ''),
  criado_por: textoOpcional().transform((v) => v ?? ''),
  atualizado_em: textoOpcional().transform((v) => v ?? ''),
  atualizado_por: textoOpcional().transform((v) => v ?? ''),
});

function paraCelula(v: unknown): Celula {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  return JSON.stringify(v);
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

interface LinhaLida<T> {
  numero: number;
  registro: T;
}

export class TabelaLida<E extends z.ZodObject> {
  private constructor(
    readonly def: DefinicaoTabela<E>,
    readonly cabecalho: string[],
    private readonly linhas: LinhaLida<Registro<E>>[],
  ) {}

  /** Valida o cabeçalho e converte as linhas. Erros citam planilha, aba, linha e coluna. */
  static de<E extends z.ZodObject>(def: DefinicaoTabela<E>, linhas: Linha[]): TabelaLida<E> {
    if (linhas.length === 0) {
      throw new ErroArmazenamento(`A aba "${def.aba}" (planilha ${def.planilha}) está vazia ou não existe. Rode "Preparar estrutura".`);
    }
    const cabecalho = linhas[0].map((c) => String(c ?? '').trim());
    const faltando = cabecalhoDe(def).filter((c) => !cabecalho.includes(c));
    if (faltando.length > 0) {
      throw new ErroArmazenamento(`A aba "${def.aba}" (planilha ${def.planilha}) está sem as colunas: ${faltando.join(', ')}.`);
    }
    const esquema = def.modo === 'somente_inclusao' ? def.esquema : esquemaControle.extend(def.esquema.shape);
    const lidas: LinhaLida<Registro<E>>[] = [];
    linhas.slice(1).forEach((linha, i) => {
      if (linha.every((c) => vazio(c))) return;
      const bruto = Object.fromEntries(cabecalho.map((c, j) => [c, linha[j] ?? '']));
      const r = esquema.safeParse(bruto);
      if (!r.success) {
        const problema = r.error.issues[0];
        throw new ErroArmazenamento(
          `Valor inválido na aba "${def.aba}", linha ${i + 2}, coluna "${problema.path.join('.')}": ${problema.message}.`,
        );
      }
      lidas.push({ numero: i + 2, registro: r.data as Registro<E> });
    });
    return new TabelaLida(def, cabecalho, lidas);
  }

  todos(): Registro<E>[] {
    return this.linhas.map((l) => l.registro);
  }

  ativos(): Registro<E>[] {
    return this.todos().filter((r) => r.ativo !== false);
  }

  porId(id: string): Registro<E> | undefined {
    return this.linhas.find((l) => l.registro.id === id)?.registro;
  }

  numeroDaLinha(id: string): number | undefined {
    return this.linhas.find((l) => l.registro.id === id)?.numero;
  }

  /** Monta a linha na ordem do cabeçalho da planilha. */
  paraLinha(valores: Record<string, unknown>): Linha {
    return this.cabecalho.map((c) => paraCelula(valores[c]));
  }
}

// ---------------------------------------------------------------------------
// Gravação
// ---------------------------------------------------------------------------

export interface Autoria {
  email: string;
  agora?: () => Date;
}

export interface Planilhas {
  armazenamento: Armazenamento;
  /** Converte a chave do catálogo no identificador da planilha no Drive. */
  idDe(chave: string): string;
}

export async function lerTabela<E extends z.ZodObject>(p: Planilhas, def: DefinicaoTabela<E>): Promise<TabelaLida<E>> {
  const abas = await p.armazenamento.lerAbas(p.idDe(def.planilha), [def.aba]);
  return TabelaLida.de(def, abas[def.aba] ?? []);
}

/**
 * Lê várias tabelas com o menor número de chamadas: uma por planilha.
 * Devolve as tabelas na mesma ordem pedida.
 */
export async function lerTabelas<const D extends readonly DefinicaoTabela<z.ZodObject>[]>(
  p: Planilhas,
  defs: D,
): Promise<{ [K in keyof D]: D[K] extends DefinicaoTabela<infer E> ? TabelaLida<E> : never }> {
  const porPlanilha = new Map<string, string[]>();
  for (const d of defs) porPlanilha.set(d.planilha, [...(porPlanilha.get(d.planilha) ?? []), d.aba]);
  const lidas = new Map<string, Record<string, Linha[]>>();
  await Promise.all(
    [...porPlanilha].map(async ([chave, abas]) => {
      lidas.set(chave, await p.armazenamento.lerAbas(p.idDe(chave), [...new Set(abas)]));
    }),
  );
  return defs.map((d) => TabelaLida.de(d, lidas.get(d.planilha)?.[d.aba] ?? [])) as never;
}

export async function inserir<E extends z.ZodObject>(
  p: Planilhas,
  def: DefinicaoTabela<E>,
  dados: Entrada<E>,
  autoria: Autoria,
): Promise<Registro<E>> {
  const campos = def.esquema.parse(dados);
  const tabela = await lerTabela(p, def);
  const agora = (autoria.agora?.() ?? new Date()).toISOString();
  const registro = (
    def.modo === 'somente_inclusao'
      ? campos
      : {
          id: crypto.randomUUID(),
          versao: 1,
          ativo: true,
          criado_em: agora,
          criado_por: autoria.email,
          atualizado_em: agora,
          atualizado_por: autoria.email,
          ...campos,
        }
  ) as Registro<E>;
  await p.armazenamento.acrescentar(p.idDe(def.planilha), def.aba, [tabela.paraLinha(registro)]);
  return registro;
}

/**
 * Altera campos de um registro. Lê a aba de novo na hora de gravar para
 * conferir a versão, para não sobrescrever a alteração de outra pessoa.
 */
export async function atualizar<E extends z.ZodObject>(
  p: Planilhas,
  def: DefinicaoTabela<E>,
  id: string,
  versaoLida: number,
  mudancas: Partial<z.infer<E>> & { ativo?: boolean },
  autoria: Autoria,
): Promise<{ registro: Registro<E>; colunasAlteradas: string[] }> {
  if (def.modo === 'somente_inclusao') throw new Error(`A aba "${def.aba}" é somente inclusão.`);
  const tabela = await lerTabela(p, def);
  const atual = tabela.porId(id);
  const numero = tabela.numeroDaLinha(id);
  if (!atual || !numero) throw new ErroNaoEncontrado(`Registro ${id} não encontrado em "${def.aba}".`);
  if (atual.versao !== versaoLida) throw new ErroConflito(id);

  const { ativo, ...resto } = mudancas;
  const campos = def.esquema.partial().parse(resto) as Partial<z.infer<E>>;
  const novo = {
    ...atual,
    ...campos,
    ...(ativo === undefined ? {} : { ativo }),
    versao: atual.versao + 1,
    atualizado_em: (autoria.agora?.() ?? new Date()).toISOString(),
    atualizado_por: autoria.email,
  } as Registro<E>;
  const colunasAlteradas = Object.keys(novo).filter(
    (c) => !['versao', 'atualizado_em', 'atualizado_por'].includes(c) &&
      (novo as Record<string, unknown>)[c] !== (atual as Record<string, unknown>)[c],
  );
  await p.armazenamento.gravarLinha(p.idDe(def.planilha), def.aba, numero, tabela.paraLinha(novo));
  return { registro: novo, colunasAlteradas };
}
