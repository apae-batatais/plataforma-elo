/**
 * Aplica as migrações em um banco PGlite (testes, modo local e demonstração).
 * Em produção, quem aplica as migrações é a CLI do Supabase.
 *
 * As migrações vêm de `migracoes.gerado.ts` (cópia de supabase/), para
 * funcionar também onde a pasta supabase/ não está disponível.
 */
import type { PGlite } from '@electric-sql/pglite';
import { AMBIENTE_SUPABASE_SIMULADO, MIGRACOES } from './migracoes.gerado';

export async function prepararBancoLocal(pg: PGlite): Promise<string[]> {
  await pg.exec(`create table if not exists public._migracao_local (
    arquivo text primary key, aplicada_em timestamptz not null default now())`);

  const jaPreparado = await pg.query(`select 1 from pg_roles where rolname = 'authenticated'`);
  if (jaPreparado.rows.length === 0) {
    await pg.exec(AMBIENTE_SUPABASE_SIMULADO);
  }

  const aplicadas = new Set(
    (await pg.query<{ arquivo: string }>(`select arquivo from public._migracao_local`)).rows.map((l) => l.arquivo),
  );
  const novas = MIGRACOES.filter((m) => !aplicadas.has(m.arquivo));

  for (const { arquivo, sql } of novas) {
    try {
      await pg.exec(sql);
      await pg.query(`insert into public._migracao_local (arquivo) values ($1)`, [arquivo]);
    } catch (erro) {
      throw new Error(`Falha ao aplicar a migração ${arquivo}: ${(erro as Error).message}`);
    }
  }
  return novas.map((m) => m.arquivo);
}
