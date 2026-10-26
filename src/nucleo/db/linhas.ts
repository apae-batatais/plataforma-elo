/**
 * `db.execute(sql)` devolve formatos diferentes conforme o driver
 * (postgres.js devolve uma lista; PGlite devolve `{ rows }`).
 * Esta função padroniza para uma lista de linhas.
 */
export function linhas<T = Record<string, unknown>>(resultado: unknown): T[] {
  if (Array.isArray(resultado)) return resultado as T[];
  if (resultado && typeof resultado === 'object' && 'rows' in resultado) {
    return (resultado as { rows: T[] }).rows;
  }
  throw new Error('Formato de resultado do banco não reconhecido');
}
