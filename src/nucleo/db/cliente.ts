/**
 * Conexão com o banco, usada somente no servidor.
 *
 * - Produção e prévias: DATABASE_URL aponta para o Postgres do Supabase.
 * - Modo local (sem DATABASE_URL): um Postgres embutido (PGlite) gravado
 *   na pasta `.dados-locais/`, com as migrações aplicadas automaticamente.
 *   Serve para desenvolver e testar sem nenhuma conta, só com dados fictícios.
 */
import 'server-only';
import type { Banco } from './contexto';

let promessa: Promise<Banco> | undefined;

export function modoLocal(): boolean {
  return !process.env.DATABASE_URL;
}

export function obterBanco(): Promise<Banco> {
  promessa ??= conectar();
  return promessa;
}

async function conectar(): Promise<Banco> {
  if (!modoLocal()) {
    const { default: postgres } = await import('postgres');
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const cliente = postgres(process.env.DATABASE_URL!, { prepare: false, max: 5 });
    return drizzle(cliente) as unknown as Banco;
  }
  const { abrirBancoLocal } = await import('./banco-local');
  return (await abrirBancoLocal()).db;
}
