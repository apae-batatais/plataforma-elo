/**
 * Copia as migrações SQL para dentro do código (src/nucleo/db/migracoes.gerado.ts).
 *
 *   npm run migracoes:gerar
 *
 * Por quê: o script do banco de demonstração e o banco em memória precisam
 * das migrações mesmo onde a pasta `supabase/` não acompanha o código.
 * O teste `migracoes-geradas` falha se este arquivo ficar desatualizado.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { conteudoGerado } from './migracoes-fonte';

const destino = path.join(process.cwd(), 'src', 'nucleo', 'db', 'migracoes.gerado.ts');
writeFileSync(destino, conteudoGerado());
console.log(`Migrações copiadas para ${path.relative(process.cwd(), destino)}`);
