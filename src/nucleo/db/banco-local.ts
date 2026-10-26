/**
 * Bancos embutidos (PGlite), sempre com dados fictícios.
 *
 * - Local: gravado em `.dados-locais/` (fora do Git), para desenvolvimento.
 * - Demonstração: em memória, montado e populado ao iniciar o servidor.
 *   Usado nas prévias e na publicação enquanto o Supabase não existe.
 *   Alterações feitas na demonstração são perdidas quando o servidor reinicia.
 */
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import type { Banco } from './contexto';
import { popularDadosFicticios } from './dados-ficticios';
import { prepararBancoLocal } from './migracoes-locais';

export const PASTA_DADOS_LOCAIS = path.join(process.cwd(), '.dados-locais');

export async function abrirBancoLocal(): Promise<{ pg: PGlite; db: Banco }> {
  const pg = new PGlite(PASTA_DADOS_LOCAIS);
  await prepararBancoLocal(pg);
  return { pg, db: drizzle(pg) as unknown as Banco };
}

export async function abrirBancoDemonstracao(): Promise<{ pg: PGlite; db: Banco }> {
  const pg = new PGlite();
  await prepararBancoLocal(pg);
  await popularDadosFicticios(pg);
  return { pg, db: drizzle(pg) as unknown as Banco };
}
