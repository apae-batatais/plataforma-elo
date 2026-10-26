/**
 * Banco local embutido (PGlite) para desenvolvimento sem contas externas.
 * Os dados ficam em `.dados-locais/` (fora do Git) e são sempre fictícios.
 */
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import type { Banco } from './contexto';
import { prepararBancoLocal } from './migracoes-locais';

export const PASTA_DADOS_LOCAIS = path.join(process.cwd(), '.dados-locais');

export async function abrirBancoLocal(): Promise<{ pg: PGlite; db: Banco }> {
  const pg = new PGlite(PASTA_DADOS_LOCAIS);
  await prepararBancoLocal(pg);
  return { pg, db: drizzle(pg) as unknown as Banco };
}
