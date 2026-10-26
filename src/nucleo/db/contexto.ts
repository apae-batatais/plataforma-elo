/**
 * Execução de consultas em nome de um usuário.
 *
 * Toda operação feita para um usuário roda dentro de `comoUsuario`, que
 * troca o papel do banco para `authenticated` e informa o id do usuário.
 * Assim as políticas de Row Level Security valem também para o servidor:
 * se uma tela pedir o que o usuário não pode ver, o banco não entrega.
 *
 * `comoSistema` é só para rotinas internas (entrega de eventos, cálculo de
 * indicadores). Nunca use para atender um pedido de usuário.
 */
import { sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Banco = PgDatabase<PgQueryResultHKT, any>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function comoUsuario<T>(
  db: Banco,
  usuarioId: string,
  operacao: (tx: Banco) => Promise<T>,
): Promise<T> {
  if (!UUID.test(usuarioId)) {
    throw new Error('comoUsuario: id de usuário inválido');
  }
  const claims = JSON.stringify({ sub: usuarioId, role: 'authenticated' });
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local role authenticated`);
    await tx.execute(sql`select set_config('request.jwt.claims', ${claims}, true)`);
    return operacao(tx as unknown as Banco);
  });
}

export async function comoSistema<T>(
  db: Banco,
  operacao: (tx: Banco) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local role service_role`);
    return operacao(tx as unknown as Banco);
  });
}
