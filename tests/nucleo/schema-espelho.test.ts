/**
 * Garante que o esquema tipado (Drizzle) espelha as migrações SQL.
 * Se alguém mudar uma migração e esquecer o schema.ts (ou o contrário),
 * este teste aponta a tabela e a coluna divergentes.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import * as schema from '@/nucleo/db/schema';
import { criarBancoTeste, type BancoTeste } from '../apoio/banco-teste';

let b: BancoTeste;
beforeAll(async () => {
  b = await criarBancoTeste();
});
afterAll(async () => b.fechar());

const tabelas: PgTable[] = (Object.values(schema) as unknown[]).filter((v): v is PgTable => v instanceof PgTable);

describe('schema.ts espelha o banco', () => {
  it('cobre todas as tabelas do schema core', async () => {
    const noBanco = (await b.admin(`select tablename from pg_tables where schemaname = 'core' order by 1`)).map(
      (l) => l.tablename,
    );
    const noCodigo = tabelas.map((t) => getTableConfig(t).name).sort();
    expect(noCodigo).toEqual(noBanco);
  });

  it.each(tabelas.map((t) => [getTableConfig(t).name, t] as const))('colunas de core.%s existem no banco', async (nome, tabela) => {
    const noBanco = new Set(
      (await b.admin(`select column_name from information_schema.columns where table_schema = 'core' and table_name = $1`, [nome])).map(
        (l) => l.column_name as string,
      ),
    );
    const faltando = getTableConfig(tabela)
      .columns.map((c) => c.name)
      .filter((c) => !noBanco.has(c));
    expect(faltando).toEqual([]);
  });
});
