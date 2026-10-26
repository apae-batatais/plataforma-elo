/**
 * Gera dados FICTÍCIOS no banco local (.dados-locais/).
 *
 *   npm run dados:ficticios
 *
 * Recria o banco local do zero. Nunca roda contra um banco real:
 * se DATABASE_URL estiver definida, o script se recusa a executar.
 */
import { rmSync } from 'node:fs';
import { abrirBancoLocal, PASTA_DADOS_LOCAIS } from '../../src/nucleo/db/banco-local';
import { popularDadosFicticios } from '../../src/nucleo/db/dados-ficticios';

if (process.env.DATABASE_URL) {
  console.error('Recusado: DATABASE_URL está definida. Dados fictícios só vão para o banco local.');
  process.exit(1);
}

async function main() {
  rmSync(PASTA_DADOS_LOCAIS, { recursive: true, force: true });
  const { pg } = await abrirBancoLocal();
  const r = await popularDadosFicticios(pg);
  await pg.close();
  console.log(`Banco local recriado: ${r.servicos} serviços, ${r.atendidos} atendidos com familiares, ${r.usuarios} usuários.`);
  console.log('Todos os dados são fictícios.');
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
