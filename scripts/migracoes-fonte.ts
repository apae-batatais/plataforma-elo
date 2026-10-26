/** Lê as migrações da pasta supabase/ e monta o conteúdo do arquivo gerado. */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const PASTA = path.join(process.cwd(), 'supabase');

export function conteudoGerado(): string {
  const bootstrap = readFileSync(path.join(PASTA, 'test-bootstrap.sql'), 'utf8');
  const migracoes = readdirSync(path.join(PASTA, 'migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((arquivo) => ({ arquivo, sql: readFileSync(path.join(PASTA, 'migrations', arquivo), 'utf8') }));

  return [
    '// ARQUIVO GERADO por `npm run migracoes:gerar`. Não edite à mão.',
    '// Fonte: supabase/test-bootstrap.sql e supabase/migrations/*.sql',
    '',
    `export const AMBIENTE_SUPABASE_SIMULADO: string = ${JSON.stringify(bootstrap)};`,
    '',
    'export const MIGRACOES: readonly { arquivo: string; sql: string }[] = [',
    ...migracoes.map((m) => `  { arquivo: ${JSON.stringify(m.arquivo)}, sql: ${JSON.stringify(m.sql)} },`),
    '];',
    '',
  ].join('\n');
}
