/**
 * Conexão com o banco, usada somente no servidor.
 *
 * - Produção: DATABASE_URL aponta para o Postgres do Supabase.
 * - Demonstração (sem DATABASE_URL, na Netlify ou com MODO_DEMONSTRACAO=1):
 *   banco em memória com dados fictícios, montado ao iniciar. Serve para as
 *   prévias de cada Pull Request e para a publicação antes do Supabase existir.
 * - Local (sem DATABASE_URL, no computador do desenvolvedor): banco embutido
 *   gravado em `.dados-locais/`, recriado com `npm run dados:ficticios`.
 */
import 'server-only';
import type { Banco } from './contexto';

let promessa: Promise<Banco> | undefined;

/** Sem banco real: só dados fictícios (local ou demonstração). */
export function modoLocal(): boolean {
  return !process.env.DATABASE_URL;
}

export function modoDemonstracao(): boolean {
  return modoLocal() && (process.env.MODO_DEMONSTRACAO === '1' || Boolean(process.env.NETLIFY));
}

export function obterBanco(): Promise<Banco> {
  promessa ??= conectar().catch((erro) => {
    promessa = undefined; // permite nova tentativa na próxima requisição
    throw erro;
  });
  return promessa;
}

async function conectar(): Promise<Banco> {
  if (!modoLocal()) {
    const { default: postgres } = await import('postgres');
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const cliente = postgres(process.env.DATABASE_URL!, { prepare: false, max: 5 });
    return drizzle(cliente) as unknown as Banco;
  }
  const { abrirBancoDemonstracao, abrirBancoLocal } = await import('./banco-local');
  return (modoDemonstracao() ? await abrirBancoDemonstracao() : await abrirBancoLocal()).db;
}
