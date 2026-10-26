/**
 * Prepara o banco de DEMONSTRAÇÃO (Supabase): aplica as migrações pendentes e,
 * se o banco estiver vazio, grava os dados fictícios e o marca como "demonstracao".
 *
 *   DATABASE_URL=<conexão do Supabase de demonstração> npm run demonstracao:preparar
 *
 * Roda no GitHub Actions (workflow "Preparar demonstração"), com a conexão
 * guardada nos Secrets. Travas de segurança:
 * - recusa banco marcado como "producao";
 * - recusa banco com pessoas cadastradas que não esteja marcado como "demonstracao";
 * - é seguro rodar várias vezes: só aplica o que falta.
 */
import postgres from 'postgres';
import type { ExecutorSql } from '../../src/nucleo/db/executor';
import { lerAmbiente } from '../../src/nucleo/db/executor';
import { prepararBancoLocal } from '../../src/nucleo/db/migracoes-locais';
import { popularDadosFicticios } from '../../src/nucleo/db/dados-ficticios';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Defina DATABASE_URL com a conexão do Supabase de demonstração.');
    process.exit(1);
  }

  // Uma única conexão: migrações e dados fictícios usam transações explícitas.
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => undefined });
  const db: ExecutorSql = {
    exec: (texto) => sql.unsafe(texto),
    query: async <T>(texto: string, params: unknown[] = []) => ({
      rows: (await sql.unsafe(texto, params as never[])) as unknown as T[],
    }),
  };

  try {
    // Antes de qualquer migração: se já houver marcação de produção, para aqui.
    const existeTabela = await db.query(`select to_regclass('core.ambiente') is not null as existe`);
    if ((existeTabela.rows[0] as { existe: boolean }).existe && (await lerAmbiente(db)) === 'producao') {
      throw new Error('Recusado: este banco é de PRODUÇÃO. Este script é só para a demonstração.');
    }

    const aplicadas = await prepararBancoLocal(db);
    console.log(aplicadas.length ? `Migrações aplicadas: ${aplicadas.join(', ')}` : 'Nenhuma migração pendente.');

    const r = await popularDadosFicticios(db);
    console.log(
      r.gravado
        ? `Dados fictícios gravados: ${r.servicos} serviços, ${r.atendidos} atendidos com familiares, ${r.usuarios} usuários.`
        : 'Dados fictícios já existiam; nada foi gravado.',
    );
  } finally {
    await sql.end();
  }
}

main().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
