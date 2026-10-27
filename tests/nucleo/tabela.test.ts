import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import {
  atualizar,
  cabecalhoDe,
  definirTabela,
  ErroConflito,
  inserir,
  lerTabela,
  lerTabelas,
  numeroOpcional,
  texto,
  textoOpcional,
  type Planilhas,
} from '@/nucleo/armazenamento/tabela';

const Itens = definirTabela({
  planilha: 'teste',
  aba: 'Itens',
  esquema: z.object({ nome: texto(), quantidade: numeroOpcional(), obs: textoOpcional() }),
});

const Log = definirTabela({
  planilha: 'teste',
  aba: 'Log',
  modo: 'somente_inclusao',
  esquema: z.object({ mensagem: texto() }),
});

async function novas(): Promise<Planilhas> {
  const armazenamento = new ArmazenamentoMemoria(['teste']);
  await armazenamento.garantirAba('teste', 'Itens', cabecalhoDe(Itens));
  await armazenamento.garantirAba('teste', 'Log', cabecalhoDe(Log));
  return { armazenamento, idDe: (c) => c };
}

const ana = { email: 'ana@exemplo.local' };
const bia = { email: 'bia@exemplo.local' };

describe('tabelas sobre planilhas', () => {
  it('cria a aba com as colunas de controle antes dos campos', () => {
    expect(cabecalhoDe(Itens)).toEqual([
      'id', 'versao', 'ativo', 'criado_em', 'criado_por', 'atualizado_em', 'atualizado_por', 'nome', 'quantidade', 'obs',
    ]);
    expect(cabecalhoDe(Log)).toEqual(['mensagem']);
  });

  it('inclui com id, versão 1 e autoria, e lê de volta convertendo os tipos', async () => {
    const p = await novas();
    const r = await inserir(p, Itens, { nome: 'Cadeira', quantidade: 3 }, ana);
    expect(r).toMatchObject({ nome: 'Cadeira', quantidade: 3, obs: null, versao: 1, ativo: true, criado_por: ana.email });
    const lido = (await lerTabela(p, Itens)).porId(r.id);
    expect(lido).toMatchObject({ nome: 'Cadeira', quantidade: 3, obs: null, versao: 1, ativo: true });
  });

  it('encontra as colunas pelo nome, em qualquer ordem, e ignora colunas extras', async () => {
    const armazenamento = new ArmazenamentoMemoria(['teste']);
    const cab = ['obs', 'coluna_da_equipe', ...cabecalhoDe(Itens).filter((c) => c !== 'obs').reverse()];
    await armazenamento.garantirAba('teste', 'Itens', cab);
    const p = { armazenamento, idDe: (c: string) => c };
    const r = await inserir(p, Itens, { nome: 'Mesa', obs: 'sala 2' }, ana);
    expect((await lerTabela(p, Itens)).porId(r.id)).toMatchObject({ nome: 'Mesa', obs: 'sala 2' });
  });

  it('recusa aba sem coluna obrigatória, dizendo qual', async () => {
    const armazenamento = new ArmazenamentoMemoria(['teste']);
    await armazenamento.garantirAba('teste', 'Itens', cabecalhoDe(Itens).filter((c) => c !== 'quantidade'));
    await expect(lerTabela({ armazenamento, idDe: (c) => c }, Itens)).rejects.toThrow(/sem as colunas: quantidade/);
  });

  it('aponta linha e coluna de um valor inválido digitado na planilha', async () => {
    const p = await novas();
    await inserir(p, Itens, { nome: 'Cadeira', quantidade: 1 }, ana);
    const lidas = await p.armazenamento.lerAbas('teste', ['Itens']);
    const linha = [...lidas.Itens[1]];
    linha[cabecalhoDe(Itens).indexOf('quantidade')] = 'muitas';
    await p.armazenamento.gravarLinha('teste', 'Itens', 2, linha);
    await expect(lerTabela(p, Itens)).rejects.toThrow(/linha 2, coluna "quantidade"/);
  });

  it('altera só com a versão lida e informa as colunas alteradas', async () => {
    const p = await novas();
    const r = await inserir(p, Itens, { nome: 'Cadeira', quantidade: 3 }, ana);
    const { registro, colunasAlteradas } = await atualizar(p, Itens, r.id, 1, { quantidade: 5 }, bia);
    expect(registro).toMatchObject({ quantidade: 5, versao: 2, atualizado_por: bia.email, criado_por: ana.email });
    expect(colunasAlteradas).toEqual(['quantidade']);
  });

  it('edição simultânea: a segunda gravação com versão antiga é recusada e nada é perdido', async () => {
    const p = await novas();
    const r = await inserir(p, Itens, { nome: 'Cadeira', quantidade: 3 }, ana);
    await atualizar(p, Itens, r.id, 1, { quantidade: 5 }, ana);
    await expect(atualizar(p, Itens, r.id, 1, { quantidade: 9 }, bia)).rejects.toBeInstanceOf(ErroConflito);
    expect((await lerTabela(p, Itens)).porId(r.id)).toMatchObject({ quantidade: 5, versao: 2 });
  });

  it('encerrar não apaga: o registro some dos ativos mas continua na planilha', async () => {
    const p = await novas();
    const r = await inserir(p, Itens, { nome: 'Cadeira' }, ana);
    await atualizar(p, Itens, r.id, 1, { ativo: false }, ana);
    const t = await lerTabela(p, Itens);
    expect(t.ativos()).toHaveLength(0);
    expect(t.todos()).toHaveLength(1);
  });

  it('tabela somente inclusão não aceita alteração', async () => {
    const p = await novas();
    await inserir(p, Log, { mensagem: 'oi' }, ana);
    expect((await lerTabela(p, Log)).todos()).toEqual([{ mensagem: 'oi' }]);
    await expect(atualizar(p, Log as never, 'x', 1, {}, ana)).rejects.toThrow(/somente inclusão/);
  });

  it('lê várias abas da mesma planilha numa chamada só', async () => {
    const p = await novas();
    let chamadas = 0;
    const original = p.armazenamento.lerAbas.bind(p.armazenamento);
    p.armazenamento.lerAbas = async (pl, abas) => {
      chamadas++;
      return original(pl, abas);
    };
    const [itens, log] = await lerTabelas(p, [Itens, Log] as const);
    expect(itens.todos()).toEqual([]);
    expect(log.todos()).toEqual([]);
    expect(chamadas).toBe(1);
  });
});
