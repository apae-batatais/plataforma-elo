/**
 * Aplica as migrações pendentes em um banco.
 * - PGlite (testes, modo local): também simula o mínimo do ambiente Supabase.
 * - Supabase de demonstração: usado pelo script `scripts/demonstracao/preparar.ts`.
 *
 * As migrações vêm de `migracoes.gerado.ts` (cópia de supabase/), para
 * funcionar também onde a pasta supabase/ não está disponível.
 */
import type { ExecutorSql } from './executor';
import { AMBIENTE_SUPABASE_SIMULADO, MIGRACOES } from './migracoes.gerado';

export async function prepararBancoLocal(db: ExecutorSql): Promise<string[]> {
  await db.exec(`create table if not exists public._migracao_local (
    arquivo text primary key, aplicada_em timestamptz not null default now())`);

  // No Supabase os papéis já existem; a simulação só roda em banco embutido.
  const jaPreparado = await db.query(`select 1 from pg_roles where rolname = 'authenticated'`);
  if (jaPreparado.rows.length === 0) {
    await db.exec(AMBIENTE_SUPABASE_SIMULADO);
  }

  const aplicadas = new Set(
    (await db.query<{ arquivo: string }>(`select arquivo from public._migracao_local`)).rows.map((l) => l.arquivo),
  );
  const novas = MIGRACOES.filter((m) => !aplicadas.has(m.arquivo));

  for (const { arquivo, sql } of novas) {
    try {
      await db.exec(`begin;\n${sql}\n;insert into public._migracao_local (arquivo) values ('${arquivo.replace(/'/g, "''")}');\ncommit;`);
    } catch (erro) {
      await db.exec('rollback').catch(() => undefined);
      throw new Error(`Falha ao aplicar a migração ${arquivo}: ${(erro as Error).message}`);
    }
  }
  return novas.map((m) => m.arquivo);
}
