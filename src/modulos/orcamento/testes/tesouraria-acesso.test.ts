/**
 * Tesouraria (Entrega 1D.1): planilha de execução, abas, permissões e dados
 * fictícios. Só dados FICTÍCIOS.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { popularPrevisaoFicticia, popularTesourariaFicticia } from '../dados/ficticios';
import { AjustesConciliacao, Contas, PLANILHA_EXECUCAO, Saldos, TABELAS_ORCAMENTO } from '../dados/tabelas';
import { mesAnterior, mesAtualBrasilia } from '../dominio/tesouraria';
import { manifesto } from '../manifesto';

let p: Planilhas;

async function como(email: string) {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
}

beforeEach(async () => {
  p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha', PLANILHA_EXECUCAO]), idDe: (c) => c };
  await prepararEstrutura(p, {
    tabelas: [...TABELAS_ORCAMENTO] as never,
    perfis: manifesto.perfis,
    permissoes: Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao }))),
  });
  await popularDadosFicticios(p);
});

describe('permissões da tesouraria', () => {
  it('Diretoria só vê; Financeiro vê e edita', async () => {
    const dir = await como('diretoria@exemplo.local');
    expect(dir.temPermissao('orcamento.tesouraria.ver')).toBe(true);
    expect(dir.temPermissao('orcamento.tesouraria.editar')).toBe(false);
    const fin = await como('financeiro@exemplo.local');
    expect(fin.temPermissao('orcamento.tesouraria.ver')).toBe(true);
    expect(fin.temPermissao('orcamento.tesouraria.editar')).toBe(true);
  });

  it.each(['coord.ur@exemplo.local', 'leitura@exemplo.local', 'compras@exemplo.local', 'dp@exemplo.local'])('%s não vê nem edita', async (email) => {
    const a = await como(email);
    expect(a.temPermissao('orcamento.tesouraria.ver')).toBe(false);
    expect(a.temPermissao('orcamento.tesouraria.editar')).toBe(false);
  });

  it('o menu da tesouraria exige a permissão de ver', () => {
    const itens = manifesto.menu.filter((m) => m.secao === 'Tesouraria');
    expect(itens.map((m) => [m.rotulo, m.caminho, m.permissao])).toEqual([
      ['Saldos do mês', '/tesouraria', 'orcamento.tesouraria.ver'],
      ['Contas', '/tesouraria/contas', 'orcamento.tesouraria.ver'],
      ['Conferência', '/tesouraria/conferencia', 'orcamento.tesouraria.ver'],
      ['Fim do ano', '/tesouraria/fim-do-ano', 'orcamento.tesouraria.ver'],
      ['Reserva', '/tesouraria/reserva', 'orcamento.tesouraria.ver'],
    ]);
  });
});

describe('abas e dados fictícios', () => {
  it('prepararEstrutura cria as três abas na planilha orcamento_execucao', async () => {
    const abas = await p.armazenamento.listarAbas(PLANILHA_EXECUCAO);
    expect(abas).toEqual(expect.arrayContaining(['Contas', 'Saldos', 'AjustesConciliacao']));
    expect([Contas, Saldos, AjustesConciliacao].every((t) => t.planilha === PLANILHA_EXECUCAO)).toBe(true);
  });

  it('grava 6 contas e deixa exatamente uma conta ativa sem saldo no último mês', async () => {
    await popularPrevisaoFicticia(p);
    await popularTesourariaFicticia(p);
    const [contas, saldos] = await lerTabelas(p, [Contas, Saldos] as const);
    const ativas = contas.ativos();
    expect(contas.todos()).toHaveLength(6);
    expect(ativas.filter((c) => c.classe === 'livre_disponivel')).toHaveLength(3);
    expect(ativas.filter((c) => c.tipo === 'caixa')).toHaveLength(1);
    expect(ativas.filter((c) => c.classe === 'reserva')).toHaveLength(1);
    expect(ativas.filter((c) => c.classe === 'vinculada' && c.fonte_id)).toHaveLength(2);
    const ultimo = mesAnterior(mesAtualBrasilia());
    const meses = [...new Set(saldos.todos().map((s) => s.mes))].sort();
    expect(meses).toEqual([mesAnterior(mesAnterior(ultimo)), mesAnterior(ultimo), ultimo]);
    const comSaldo = new Set(saldos.todos().filter((s) => s.mes === ultimo).map((s) => s.conta_id));
    expect(ativas.filter((c) => !comSaldo.has(c.id))).toHaveLength(1);
  });
});
