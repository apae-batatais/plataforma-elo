/**
 * Aplica as migrações em um banco PGlite (testes e modo local).
 * Em produção, quem aplica as migrações é a CLI do Supabase.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';

const RAIZ = process.cwd();
const PASTA_SUPABASE = path.join(RAIZ, 'supabase');

export async function prepararBancoLocal(pg: PGlite): Promise<string[]> {
  await pg.exec(`create table if not exists public._migracao_local (
    arquivo text primary key, aplicada_em timestamptz not null default now())`);

  const jaPreparado = await pg.query(`select 1 from pg_roles where rolname = 'authenticated'`);
  if (jaPreparado.rows.length === 0) {
    await pg.exec(readFileSync(path.join(PASTA_SUPABASE, 'test-bootstrap.sql'), 'utf8'));
  }

  const aplicadas = new Set(
    (await pg.query<{ arquivo: string }>(`select arquivo from public._migracao_local`)).rows.map((l) => l.arquivo),
  );
  const pasta = path.join(PASTA_SUPABASE, 'migrations');
  const novas = readdirSync(pasta)
    .filter((f) => f.endsWith('.sql') && !aplicadas.has(f))
    .sort();

  for (const arquivo of novas) {
    try {
      await pg.exec(readFileSync(path.join(pasta, arquivo), 'utf8'));
      await pg.query(`insert into public._migracao_local (arquivo) values ($1)`, [arquivo]);
    } catch (erro) {
      throw new Error(`Falha ao aplicar a migração ${arquivo}: ${(erro as Error).message}`);
    }
  }
  return novas;
}
