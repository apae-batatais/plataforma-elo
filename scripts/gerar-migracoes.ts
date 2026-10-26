/**
 * Copia as migrações SQL para dentro do código (src/nucleo/db/migracoes.gerado.ts).
 *
 *   npm run migracoes:gerar
 *
 * Por quê: na hospedagem (Netlify) o servidor roda como função, sem acesso
 * garantido à pasta `supabase/`. Com as migrações dentro do código, o modo
 * demonstração consegue montar o banco em memória em qualquer lugar.
 * O teste `migracoes-geradas` falha se este arquivo ficar desatualizado.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { conteudoGerado } from './migracoes-fonte';

const destino = path.join(process.cwd(), 'src', 'nucleo', 'db', 'migracoes.gerado.ts');
writeFileSync(destino, conteudoGerado());
console.log(`Migrações copiadas para ${path.relative(process.cwd(), destino)}`);
