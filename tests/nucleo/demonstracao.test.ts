/**
 * Migrações embutidas e banco de demonstração.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { conteudoGerado } from '../../scripts/migracoes-fonte';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { abrirBancoDemonstracao } from '@/nucleo/db/banco-local';
import { USUARIOS_FICTICIOS } from '@/nucleo/db/dados-ficticios';
import { envolverBanco, type BancoTeste } from '../apoio/banco-teste';

describe('migrações embutidas no código', () => {
  it('estão iguais às da pasta supabase/ (rode `npm run migracoes:gerar` se falhar)', () => {
    const noCodigo = readFileSync(path.join(process.cwd(), 'src/nucleo/db/migracoes.gerado.ts'), 'utf8');
    expect(noCodigo).toBe(conteudoGerado());
  });
});

describe('banco de demonstração', () => {
  let b: BancoTeste;
  beforeAll(async () => {
    b = envolverBanco((await abrirBancoDemonstracao()).pg);
  });
  afterAll(async () => b.fechar());

  it('sobe com os usuários fictícios nos identificadores fixos', async () => {
    const ids = (await b.admin(`select id from core.usuario order by id`)).map((l) => l.id);
    expect(ids).toEqual(USUARIOS_FICTICIOS.map((u) => u.id));
  });

  it('é sempre igual: dois servidores mostram as mesmas pessoas', async () => {
    const outro = envolverBanco((await abrirBancoDemonstracao()).pg);
    const nomes = async (x: BancoTeste) => (await x.admin(`select nome from core.pessoa order by nome`)).map((l) => l.nome);
    expect(await nomes(outro)).toEqual(await nomes(b));
    await outro.fechar();
  });

  it('respeita os perfis: coordenação da UR não vê atendidos do CER', async () => {
    const coordUR = USUARIOS_FICTICIOS.find((u) => u.escopo === 'ur')!.id;
    const servicos = (await b.como(
      coordUR,
      `select distinct s.codigo from core.vinculo_servico vs join core.servico s on s.id = vs.servico_id`,
    )).map((l) => l.codigo);
    expect(servicos).toEqual(['ur']);
  });
});
