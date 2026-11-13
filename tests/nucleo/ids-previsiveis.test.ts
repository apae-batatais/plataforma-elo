import { describe, expect, it } from 'vitest';
import { idsPrevisiveis } from '@/nucleo/armazenamento/ids-previsiveis';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { lerTabela, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { ESTRUTURA_DOS_MODULOS, popularDemonstracaoDosModulos, TABELAS_DOS_MODULOS } from '@/plataforma/registro-modulos';

const FORMATO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('idsPrevisiveis', () => {
  it('dá o mesmo identificador para a mesma instituição, aba e posição', () => {
    const a = idsPrevisiveis('exemplo');
    const b = idsPrevisiveis('exemplo');
    const ids = [a('Projetos'), a('Projetos'), a('Servicos')];
    expect([b('Projetos'), b('Projetos'), b('Servicos')]).toEqual(ids);
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) expect(id).toMatch(FORMATO);
  });

  it('muda entre instituições e não depende da ordem entre abas diferentes', () => {
    const a = idsPrevisiveis('exemplo');
    const b = idsPrevisiveis('modelo');
    expect(a('Projetos')).not.toBe(b('Projetos'));
    const c = idsPrevisiveis('exemplo');
    const d = idsPrevisiveis('exemplo');
    c('Servicos');
    expect(c('Projetos')).toBe(d('Projetos'));
  });
});

describe('demonstração com identificadores fixos', () => {
  async function montar(): Promise<Planilhas> {
    const chaves = ['nucleo', 'auditoria', ...new Set(TABELAS_DOS_MODULOS.map((t) => t.planilha))];
    const p: Planilhas = { armazenamento: new ArmazenamentoMemoria(chaves), idDe: (c) => c, novoId: idsPrevisiveis('exemplo') };
    await prepararEstrutura(p, ESTRUTURA_DOS_MODULOS, 'sistema');
    await popularDadosFicticios(p);
    await popularDemonstracaoDosModulos(p);
    return p;
  }

  it('duas cópias do servidor montam os mesmos registros com os mesmos identificadores (link não dá 404)', async () => {
    const [a, b] = [await montar(), await montar()];
    for (const def of [Usuarios, Servicos, ...TABELAS_DOS_MODULOS]) {
      if (def.modo === 'somente_inclusao') continue;
      const ids = async (p: Planilhas) => (await lerTabela(p, def)).todos().map((r) => (r as { id: string }).id);
      expect(await ids(b), def.aba).toEqual(await ids(a));
    }
  }, 60_000);
});
