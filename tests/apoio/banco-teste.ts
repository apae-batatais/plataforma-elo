/**
 * Banco de testes: um Postgres completo em memória (PGlite), com o mínimo
 * do ambiente Supabase e todas as migrações aplicadas na ordem.
 * Cada chamada cria um banco novo e isolado.
 */
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import type { Banco } from '@/nucleo/db/contexto';
import { prepararBancoLocal } from '@/nucleo/db/migracoes-locais';

export interface BancoTeste {
  pg: PGlite;
  db: Banco;
  /** Executa SQL como dono do banco (prepara cenários; ignora RLS). */
  admin: (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
  /** Executa SQL como um usuário logado (RLS valendo). */
  como: (usuarioId: string, sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
  fechar: () => Promise<void>;
}

export function envolverBanco(pg: PGlite): BancoTeste {
  const db = drizzle(pg) as unknown as Banco;

  const admin = async (sql: string, params: unknown[] = []) =>
    (await pg.query<Record<string, unknown>>(sql, params)).rows;

  const como = async (usuarioId: string, sql: string, params: unknown[] = []) =>
    pg.transaction(async (tx) => {
      await tx.exec('set local role authenticated');
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: usuarioId, role: 'authenticated' }),
      ]);
      return (await tx.query<Record<string, unknown>>(sql, params)).rows;
    });

  return { pg, db, admin, como, fechar: () => pg.close() };
}

export async function criarBancoTeste(): Promise<BancoTeste> {
  const pg = new PGlite();
  await prepararBancoLocal(pg);
  return envolverBanco(pg);
}

/**
 * Cria uma pessoa, a conta de usuário dela e as atribuições de perfil.
 * Retorna o id do usuário.
 */
export async function criarUsuarioTeste(
  banco: BancoTeste,
  nome: string,
  atribuicoes: { perfil: string; escopoTipo?: string; escopoId?: string | null }[],
): Promise<string> {
  const [{ id: pessoaId }] = (await banco.admin(
    `insert into core.pessoa (nome) values ($1) returning id`,
    [nome],
  )) as { id: string }[];
  const [{ id: usuarioId }] = (await banco.admin(
    `insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id`,
    [`${nome.toLowerCase().replace(/\s+/g, '.')}@teste.local`],
  )) as { id: string }[];
  await banco.admin(`insert into core.usuario (id, pessoa_id, email) select id, $2, email from auth.users where id = $1`, [
    usuarioId,
    pessoaId,
  ]);
  for (const a of atribuicoes) {
    await banco.admin(
      `insert into core.atribuicao (usuario_id, perfil_id, escopo_tipo, escopo_id)
       select $1, id, $3, $4 from core.perfil where codigo = $2`,
      [usuarioId, a.perfil, a.escopoTipo ?? 'global', a.escopoId ?? null],
    );
  }
  return usuarioId;
}
