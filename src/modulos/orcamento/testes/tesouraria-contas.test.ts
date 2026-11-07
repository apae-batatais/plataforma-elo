/**
 * Tesouraria (Entrega 1D.1): cadastro de contas. Só dados FICTÍCIOS.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { ErroConflito, lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { excluirFonte, listarCadastros, salvarFonte } from '../aplicacao/previsao';
import { ErroTesouraria, excluirConta, listarContas, reativarConta, salvarConta } from '../aplicacao/tesouraria';
import { Contas, PLANILHA_EXECUCAO, TABELAS_ORCAMENTO } from '../dados/tabelas';
import type { DadosConta } from '../dominio/tesouraria';
import { manifesto } from '../manifesto';

let p: Planilhas;

async function como(email: string) {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
}
const fin = () => como('financeiro@exemplo.local');

const conta = (extra: Partial<DadosConta> = {}): DadosConta => ({
  banco: 'Banco Fictício A', agencia: '0001', conta: '10001-0', tipo: 'movimento', classe: 'livre_disponivel', fonteId: null, unidade: 'sede', ...extra,
});

beforeEach(async () => {
  p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha', PLANILHA_EXECUCAO]), idDe: (c) => c };
  await prepararEstrutura(p, {
    tabelas: [...TABELAS_ORCAMENTO] as never,
    perfis: manifesto.perfis,
    permissoes: Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao }))),
  });
  await popularDadosFicticios(p);
});

async function fonte(nome: string, uso: 'livre' | 'restrita') {
  const f = await fin();
  await salvarFonte(p, f, { nome, natureza: 'publica', uso });
  return (await listarCadastros(p, f)).fontes.ativos.find((x) => x.nome === nome)!;
}

describe('cadastro de contas', () => {
  it('financeiro cadastra, altera, exclui e reativa, com auditoria só de nomes de colunas', async () => {
    const f = await fin();
    const id = await salvarConta(p, f, conta());
    let { ativas } = await listarContas(p, f);
    expect(ativas.map((c) => c.id)).toEqual([id]);
    expect(ativas[0].fonte_id).toBeNull();

    await salvarConta(p, f, conta({ banco: 'Banco Fictício Z' }), { id, versao: ativas[0].versao });
    ({ ativas } = await listarContas(p, f));
    expect(ativas[0].banco).toBe('Banco Fictício Z');

    await excluirConta(p, f, id, ativas[0].versao);
    let l = await listarContas(p, f);
    expect(l.ativas).toHaveLength(0);
    expect(l.excluidas.map((c) => c.id)).toEqual([id]);

    await reativarConta(p, f, id, l.excluidas[0].versao);
    l = await listarContas(p, f);
    expect(l.ativas.map((c) => c.id)).toEqual([id]);
    expect(l.excluidas).toHaveLength(0);

    const aud = (await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.entidade === 'Contas');
    expect(aud.map((a) => a.acao)).toEqual(['inclusao', 'alteracao', 'alteracao', 'alteracao']);
    const texto = JSON.stringify(aud);
    expect(texto).toContain('banco');
    expect(texto).toContain('ativo');
    expect(texto).not.toContain('Fictício');
    expect(texto).not.toContain('10001');
  });

  it('excluir não mexe em nada além da própria conta (ativo = FALSE, nada apagado)', async () => {
    const f = await fin();
    const id = await salvarConta(p, f, conta());
    const [{ versao }] = (await listarContas(p, f)).ativas;
    await excluirConta(p, f, id, versao);
    expect((await lerTabela(p, Contas)).todos()).toHaveLength(1);
  });

  it('Diretoria lista mas não grava; Coordenação e Leitura não listam', async () => {
    const f = await fin();
    const id = await salvarConta(p, f, conta());
    const dir = await como('diretoria@exemplo.local');
    expect((await listarContas(p, dir)).ativas).toHaveLength(1);
    await expect(salvarConta(p, dir, conta({ banco: 'Outro' }))).rejects.toThrow(ErroPermissao);
    await expect(excluirConta(p, dir, id, 1)).rejects.toThrow(ErroPermissao);
    await expect(reativarConta(p, dir, id, 1)).rejects.toThrow(ErroPermissao);
    for (const email of ['coord.ur@exemplo.local', 'leitura@exemplo.local']) {
      await expect(listarContas(p, await como(email))).rejects.toThrow(ErroPermissao);
    }
  });

  it('conta repetida (sem acento, maiúsculas e espaços) é recusada, ativa ou excluída', async () => {
    const f = await fin();
    const id = await salvarConta(p, f, conta({ banco: 'Banco Fictício A' }));
    const repetida = conta({ banco: ' BANCO  FICTICIO a ', agencia: '0001 ', conta: '10001-0' });
    await expect(salvarConta(p, f, repetida)).rejects.toThrow('Já existe esta conta cadastrada.');
    const [{ versao }] = (await listarContas(p, f)).ativas;
    await excluirConta(p, f, id, versao);
    await expect(salvarConta(p, f, repetida)).rejects.toThrow('Já existe esta conta entre as excluídas. Reative em vez de cadastrar de novo.');
    await expect(salvarConta(p, f, repetida)).rejects.toBeInstanceOf(ErroTesouraria);
  });

  it('alterar uma conta sem mudar banco, agência e conta não conta como repetida', async () => {
    const f = await fin();
    const id = await salvarConta(p, f, conta());
    const [{ versao }] = (await listarContas(p, f)).ativas;
    await expect(salvarConta(p, f, conta({ unidade: 'rural' }), { id, versao })).resolves.toBe(id);
  });

  it('recusa dados inválidos com as mensagens juntas numa linha', async () => {
    const f = await fin();
    const erro = await salvarConta(p, f, conta({ banco: '', agencia: '' })).catch((e) => e);
    expect(erro).toBeInstanceOf(ErroTesouraria);
    expect(erro.message).toBe('Informe o banco. Informe a agência.');
  });

  it('vinculada: fonte livre é recusada, restrita é aceita e a fonte inexistente é recusada', async () => {
    const f = await fin();
    const livre = await fonte('Fonte Livre Fictícia', 'livre');
    const restrita = await fonte('Termo Fictício', 'restrita');
    await expect(salvarConta(p, f, conta({ classe: 'vinculada', fonteId: livre.id }))).rejects.toThrow(/uso restrito/);
    await expect(salvarConta(p, f, conta({ classe: 'vinculada', fonteId: 'nao-existe' }))).rejects.toThrow('A fonte escolhida não existe.');
    const id = await salvarConta(p, f, conta({ classe: 'vinculada', fonteId: restrita.id }));
    const l = await listarContas(p, f);
    expect(l.ativas.find((c) => c.id === id)!.fonte_id).toBe(restrita.id);
    expect(l.fontesRestritas.map((x) => x.id)).toEqual([restrita.id]);
  });

  it('fonte excluída depois: a conta continua mostrando o nome dela e não aceita a fonte em novas contas', async () => {
    const f = await fin();
    const restrita = await fonte('Termo Fictício', 'restrita');
    await salvarConta(p, f, conta({ classe: 'vinculada', fonteId: restrita.id }));
    await excluirFonte(p, f, restrita.id, restrita.versao);
    const l = await listarContas(p, f);
    expect(l.fontes[restrita.id]).toBe('Termo Fictício');
    expect(l.fontesRestritas).toHaveLength(0);
    await expect(salvarConta(p, f, conta({ banco: 'Outro', classe: 'vinculada', fonteId: restrita.id }))).rejects.toThrow(/excluída/);
  });

  it('lista as unidades do Núcleo', async () => {
    const l = await listarContas(p, await fin());
    expect(l.unidades.map((u) => u.codigo)).toEqual(expect.arrayContaining(['sede']));
  });

  it('alterar com versão antiga lança ErroConflito', async () => {
    const f = await fin();
    const id = await salvarConta(p, f, conta());
    const [{ versao }] = (await listarContas(p, f)).ativas;
    await salvarConta(p, f, conta({ banco: 'Banco Fictício Y' }), { id, versao });
    await expect(salvarConta(p, f, conta({ banco: 'Banco Fictício W' }), { id, versao })).rejects.toBeInstanceOf(ErroConflito);
    await expect(excluirConta(p, f, id, versao)).rejects.toBeInstanceOf(ErroConflito);
  });
});
