/**
 * Forma mínima de executar SQL, comum ao PGlite (testes, modo local) e ao
 * Postgres do Supabase (via postgres.js). Usada por migrações e dados fictícios.
 */
export interface ExecutorSql {
  /** Executa um ou mais comandos, sem parâmetros. */
  exec(sql: string): Promise<unknown>;
  /** Executa um comando com parâmetros ($1, $2, ...) e devolve as linhas. */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export type TipoAmbiente = 'demonstracao' | 'producao';

/** Tipo do banco, ou null se ainda não foi definido (banco novo). */
export async function lerAmbiente(db: ExecutorSql): Promise<TipoAmbiente | null> {
  const { rows } = await db.query<{ tipo: TipoAmbiente }>(`select tipo from core.ambiente`);
  return rows[0]?.tipo ?? null;
}
