/**
 * Realizado com projeto (ligações onda 2, L18 e L21): campo opcional Projeto nas linhas, resultado do projeto
 * e quem vê. Só dados FICTÍCIOS.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { inserirRegistros, lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { resultadoDoProjeto } from '../aplicacao/projeto-resultado';
import { ErroRealizado, lerGradeDoMes, salvarRealizadoDoMes, type EntradaLinha } from '../aplicacao/realizado';
import { Fontes, GruposGasto, PLANILHA_EXECUCAO, Realizado, TABELAS_ORCAMENTO } from '../dados/tabelas';
import { mesAnterior, mesAtualBrasilia } from '../dominio/tesouraria';
import { manifesto } from '../manifesto';

let p: Planilhas;
const MES = mesAnterior(mesAtualBrasilia());
const PROJETOS = [
  { id: 'prj-1', codigo: 'PRJ-0001', titulo: 'Evento de teste' },
  { id: 'prj-2', codigo: 'PRJ-0002', titulo: 'Outro projeto de teste' },
];
let ids: { g: string; f: string; flivre: string };

async function como(email: string) {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
}
const fin = () => como('financeiro@exemplo.local');

beforeEach(async () => {
  p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha', PLANILHA_EXECUCAO]), idDe: (c) => c };
  await prepararEstrutura(p, {
    tabelas: [...TABELAS_ORCAMENTO] as never,
    perfis: manifesto.perfis,
    permissoes: Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao }))),
  });
  await popularDadosFicticios(p);
  const [grupos, fontes] = await lerTabelas(p, [GruposGasto, Fontes] as const);
  const [g] = await inserirRegistros(p, grupos, [{ nome: 'Material (teste)', rh: false }], { email: 'teste' });
  const [f, flivre] = await inserirRegistros(p, fontes, [{ nome: 'Termo (teste)', natureza: 'publica', uso: 'restrita' }, { nome: 'Receitas do evento (teste)', natureza: 'propria', uso: 'livre' }], { email: 'teste' });
  ids = { g: g.id, f: f.id, flivre: flivre.id };
});

const despesa = (extra: Partial<EntradaLinha> = {}): EntradaLinha => ({ tipo: 'despesa', servico: 'escola', grupoId: ids.g, fonteId: ids.flivre, natureza: 'custeio', valor: 300, ...extra });
const receita = (extra: Partial<EntradaLinha> = {}): EntradaLinha => ({ tipo: 'receita', servico: null, grupoId: null, fonteId: ids.flivre, natureza: 'receita_comum', valor: 1000, ...extra });
const com = { projetos: PROJETOS };

describe('L18: linha do realizado com projeto', () => {
  it('guarda o projeto e o código, mostra na grade e soma nos totais uma vez só', async () => {
    const f = await fin();
    await salvarRealizadoDoMes(p, f, MES, [despesa({ projetoId: 'prj-1' }), receita({ projetoId: 'prj-1' }), despesa({ valor: 50 })], com);
    const grade = await lerGradeDoMes(p, f, MES, com);
    expect(grade.despesas.map((l) => [l.projetoCodigo, l.realizado]).sort()).toEqual([[null, 50], ['PRJ-0001', 300]]);
    expect(grade.totais).toEqual({ despesa: 350, receita: 1000, resultado: 650 });
    expect(grade.opcoes.projetos).toEqual(PROJETOS);
  });

  it('a mesma combinação pode ter uma linha do projeto e outra sem; duas do mesmo projeto não', async () => {
    const f = await fin();
    await salvarRealizadoDoMes(p, f, MES, [despesa({ projetoId: 'prj-1' }), despesa({ valor: 50 })], com);
    expect((await lerTabela(p, Realizado)).ativos()).toHaveLength(2);
    await expect(salvarRealizadoDoMes(p, f, MES, [despesa({ projetoId: 'prj-2' }), despesa({ projetoId: 'prj-2' })], com)).rejects.toThrow(/duas vezes/);
  });

  it('o projeto precisa estar na lista que o Projetos oferece; sem Projetos o campo não grava', async () => {
    const f = await fin();
    await expect(salvarRealizadoDoMes(p, f, MES, [despesa({ projetoId: 'inventado' })], com)).rejects.toBeInstanceOf(ErroRealizado);
    await expect(salvarRealizadoDoMes(p, f, MES, [despesa({ projetoId: 'prj-1' })], { projetos: null })).rejects.toBeInstanceOf(ErroRealizado);
    await expect(salvarRealizadoDoMes(p, f, MES, [despesa({ projetoId: 'prj-1' })])).rejects.toBeInstanceOf(ErroRealizado);
    expect((await lerGradeDoMes(p, f, MES)).opcoes.projetos).toBeNull();
    expect((await lerTabela(p, Realizado)).ativos()).toHaveLength(0);
  });

  it('linha já gravada com projeto continua salvando se o projeto saiu da lista (ou o Projetos foi desligado)', async () => {
    const f = await fin();
    await salvarRealizadoDoMes(p, f, MES, [despesa({ projetoId: 'prj-1' })], com);
    const gravada = (await lerGradeDoMes(p, f, MES)).despesas[0];
    await salvarRealizadoDoMes(p, f, MES, [despesa({ projetoId: 'prj-1', valor: 400, versao: gravada.versao ?? undefined })], { projetos: null });
    const depois = (await lerGradeDoMes(p, f, MES)).despesas[0];
    expect([depois.realizado, depois.projetoCodigo]).toEqual([400, 'PRJ-0001']);
  });

  it('a auditoria guarda as colunas, nunca os valores', async () => {
    await salvarRealizadoDoMes(p, await fin(), MES, [despesa({ projetoId: 'prj-1', valor: 777.77 })], com);
    const texto = JSON.stringify((await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.entidade === 'Realizado'));
    expect(texto).not.toContain('777');
    expect(texto).not.toContain('PRJ-0001');
  });
});

describe('resultadoDoProjeto (L18, L19 e L21)', () => {
  it('soma receita e custo do projeto; resultado é receita menos custo; outro projeto e linhas sem projeto ficam de fora', async () => {
    const f = await fin();
    await salvarRealizadoDoMes(p, f, MES, [
      despesa({ projetoId: 'prj-1', valor: 300.1 }),
      despesa({ projetoId: 'prj-1', natureza: 'investimento', valor: 99.9 }),
      receita({ projetoId: 'prj-1', valor: 1000 }),
      receita({ projetoId: 'prj-2', valor: 5000 }),
      despesa({ valor: 70 }),
    ], com);
    const r = await resultadoDoProjeto(p, f, 'prj-1');
    expect(r).toMatchObject({ estado: 'ok', dados: { semLancamentos: false, lancamentos: 3, receita: 1000, custo: 400, resultado: 600 } });
  });

  it('projeto sem linhas devolve "sem lançamentos", nunca zero', async () => {
    const r = await resultadoDoProjeto(p, await fin(), 'prj-1');
    expect(r).toMatchObject({ estado: 'ok', dados: { semLancamentos: true, lancamentos: 0 } });
  });

  it('resultado negativo é prejuízo', async () => {
    const f = await fin();
    await salvarRealizadoDoMes(p, f, MES, [despesa({ projetoId: 'prj-1', valor: 900 }), receita({ projetoId: 'prj-1', valor: 400 })], com);
    expect(await resultadoDoProjeto(p, f, 'prj-1')).toMatchObject({ dados: { resultado: -500 } });
  });

  it('quem vê: Financeiro, Diretoria e Leitura (painel); Compras e o Departamento Pessoal não', async () => {
    await salvarRealizadoDoMes(p, await fin(), MES, [receita({ projetoId: 'prj-1' })], com);
    for (const email of ['financeiro@exemplo.local', 'diretoria@exemplo.local', 'leitura@exemplo.local']) {
      expect((await resultadoDoProjeto(p, await como(email), 'prj-1')).estado).toBe('ok');
    }
    for (const email of ['compras@exemplo.local', 'dp@exemplo.local']) {
      expect((await resultadoDoProjeto(p, await como(email), 'prj-1')).estado).toBe('sem_permissao');
    }
  });
});
