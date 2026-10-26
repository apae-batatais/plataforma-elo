/**
 * Conexão com o banco, usada somente no servidor.
 *
 * Três situações:
 * - Produção: DATABASE_URL aponta para o Supabase de produção; login real.
 * - Demonstração: MODO_DEMONSTRACAO=1. Com DATABASE_URL, usa o Supabase de
 *   demonstração (prévias no Render); sem DATABASE_URL, um banco em memória.
 *   O login é a escolha de um usuário fictício, e por isso o banco PRECISA
 *   estar marcado como "demonstracao": caso contrário a plataforma se recusa a abrir.
 * - Local: sem DATABASE_URL e sem MODO_DEMONSTRACAO; banco embutido gravado em
 *   `.dados-locais/`, recriado com `npm run dados:ficticios`.
 */
import 'server-only';
import type { Banco } from './contexto';
import { lerAmbiente, type ExecutorSql } from './executor';

let promessa: Promise<Banco> | undefined;

function temBancoExterno(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** Login com usuários fictícios e aviso de dados fictícios na tela. */
export function modoDemonstracao(): boolean {
  return !temBancoExterno() || process.env.MODO_DEMONSTRACAO === '1';
}

export function obterBanco(): Promise<Banco> {
  promessa ??= conectar().catch((erro) => {
    promessa = undefined; // permite nova tentativa na próxima requisição
    throw erro;
  });
  return promessa;
}

async function conectar(): Promise<Banco> {
  if (temBancoExterno()) {
    const { default: postgres } = await import('postgres');
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const cliente = postgres(process.env.DATABASE_URL!, { prepare: false, max: 5 });

    if (modoDemonstracao()) {
      const executor: ExecutorSql = {
        exec: (sql) => cliente.unsafe(sql),
        query: async <T>(sql: string, params: unknown[] = []) => ({
          rows: (await cliente.unsafe(sql, params as never[])) as unknown as T[],
        }),
      };
      const tipo = await lerAmbiente(executor);
      if (tipo !== 'demonstracao') {
        await cliente.end();
        throw new Error(
          'Recusado: MODO_DEMONSTRACAO está ligado, mas o banco não está marcado como demonstração. ' +
            'O login fictício nunca é aberto sobre um banco de produção.',
        );
      }
    }
    return drizzle(cliente) as unknown as Banco;
  }

  const { abrirBancoDemonstracao, abrirBancoLocal } = await import('./banco-local');
  const emMemoria = process.env.MODO_DEMONSTRACAO === '1';
  return (emMemoria ? await abrirBancoDemonstracao() : await abrirBancoLocal()).db;
}
