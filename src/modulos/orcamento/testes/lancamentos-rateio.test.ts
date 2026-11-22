/**
 * Lançamento de despesas por rateio (#225, ADR-038). Dados FICTÍCIOS.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { atualizar, lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { salvarCentro } from '../aplicacao/analise-area';
import { gradeDeRateio, salvarRateios } from '../aplicacao/folha';
import {
  excluirLancamentoRateio, listarLancamentos, previaDoLancamento, salvarLancamentoRateio, type DadosLancamento,
} from '../aplicacao/lancamentos-rateio';
import { cancelarItem, lerPrevisao, salvarDespesa } from '../aplicacao/previsao';
import { salvarBase, salvarRegra, salvarValoresDaBase } from '../aplicacao/regras-rateio';
import { popularFolhaFicticia, popularPrevisaoFicticia } from '../dados/ficticios';
import { Despesas, Exercicios, GruposGasto, LancamentosRateio, TABELAS_ORCAMENTO } from '../dados/tabelas';
import { ratearMeses } from '../dominio/lancamento-rateio';
import { manifesto } from '../manifesto';

let p: Planilhas;
async function como(email: string) {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
}
const fin = () => como('financeiro@exemplo.local');
const centroDe = (servico: string, atendidos: number) => ({ servico, tipo: 'direto' as const, atendidos, sessoes: null, area_m2: null });

async function geradas(lancId?: string) {
  const [d] = await lerTabelas(p, [Despesas] as const);
  return d.ativos().filter((x) => (lancId ? x.lancamento_rateio_id === lancId : x.lancamento_rateio_id));
}
const total = (l: { m1: number | null }[] & object[]) => Math.round((l as unknown as Record<string, number>[]).reduce((s, d) => s + Array.from({ length: 12 }, (_, i) => d[`m${i + 1}`] ?? 0).reduce((a, b) => a + b, 0), 0) * 100) / 100;

let grupoId: string;
let regraId: string;
const dados = (extra: Partial<DadosLancamento> = {}): DadosLancamento => ({
  ano: 2027, grupo_id: grupoId, fonte_id: null, descricao: 'Alimentação (exemplo)', regra_rateio_id: regraId,
  quantidade: 1, ocorrencias: 12, valor_unitario: 1000, distribuicao: 'igual', ...extra,
});

beforeEach(async () => {
  p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha', 'orcamento_execucao']), idDe: (c) => c };
  await prepararEstrutura(p, {
    tabelas: [...TABELAS_ORCAMENTO] as never,
    perfis: manifesto.perfis,
    permissoes: Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao }))),
  });
  await popularDadosFicticios(p);
  await popularFolhaFicticia(p);
  await popularPrevisaoFicticia(p);
  const f = await fin();
  await salvarCentro(p, f, centroDe('ur', 10));
  await salvarCentro(p, f, centroDe('centro_dia_intergeracional', 30));
  await salvarCentro(p, f, centroDe('escola', 60));
  grupoId = (await lerTabelas(p, [GruposGasto] as const))[0].ativos()[0].id;
  // Dois níveis: entre as áreas e, dentro de cada uma, entre os serviços, sempre por atendidos.
  regraId = await salvarRegra(p, f, { nome: 'Por atendidos', tipo: 'area', base1: 'atendidos', base2: 'atendidos', participantes: ['assistencia_social', 'educacao'] });
});

describe('cálculo mês a mês', () => {
  it('mesmos pesos em todos os meses e cada mês fecha em centavos', () => {
    const m = ratearMeses([100, 0, 50.01, ...Array(9).fill(0)], (v) => new Map([['a', v / 3], ['b', v - Math.round((v / 3) * 100) / 100]]));
    expect(m.get('a')![1]).toBe(0);
    expect(Math.round((m.get('a')![0] + m.get('b')![0]) * 100)).toBe(10000);
    expect(ratearMeses([10, ...Array(11).fill(0)], () => new Map([['a', 10], ['z', 0]])).has('z')).toBe(false);
  });
});

describe('lançamento por rateio', () => {
  it('gera uma despesa por serviço, travada, somando o valor, e a prévia mostra o mesmo', async () => {
    const f = await fin();
    const previa = await previaDoLancamento(p, f, dados());
    const r = await salvarLancamentoRateio(p, f, dados());
    expect(r.semDespesa).toBe(false);
    const g = await geradas(r.id);
    expect(g.length).toBe(previa.linhas.length);
    expect(total(g)).toBe(12000);
    // Quem tem mais atendidos recebe mais; serviço sem atendidos (peso zero) não recebe.
    const porServ = new Map(g.map((d) => [d.servico, d.valor_unitario]));
    expect(porServ.get('escola')!).toBeGreaterThan(porServ.get('ur') ?? 0);
    expect(porServ.has('transporte')).toBe(false);
    for (const l of previa.linhas) expect(porServ.get(l.codigo)).toBe(l.valor);
    const d = g[0];
    expect(d).toMatchObject({ quantidade: 1, ocorrencias: 1, distribuicao: 'manual', situacao: 'aceito', regra_rateio_id: null, grupo_id: grupoId, descricao: 'Alimentação (exemplo)' });
    // Aparece na lista comum de Despesas, marcada.
    const prev = await lerPrevisao(p, f, 2027);
    expect(prev.despesas.filter((x) => x.lancamento_rateio_id === r.id)).toHaveLength(g.length);
    const lista = await listarLancamentos(p, f, 2027);
    expect(lista.lancamentos).toMatchObject([{ id: r.id, valor: 12000, servicos: g.length }]);
  });

  it('despesa gerada fica travada no cadastro comum (alterar e excluir)', async () => {
    const f = await fin();
    await salvarLancamentoRateio(p, f, dados());
    const d = (await geradas())[0];
    await expect(cancelarItem(p, f, 'despesa', d.id, d.versao)).rejects.toThrow(/Lançamento de origem/);
    await expect(
      salvarDespesa(p, f, { ano: 2027, servico: d.servico, grupo_id: grupoId, fonte_id: null, descricao: 'x', quantidade: 1, ocorrencias: 1, valor_unitario: 1, distribuicao: 'igual' }, { id: d.id, versao: d.versao }),
    ).rejects.toThrow(/Lançamento de origem/);
  });

  it('alterar o lançamento troca as despesas (as antigas ficam encerradas, nada é apagado)', async () => {
    const f = await fin();
    const { id } = await salvarLancamentoRateio(p, f, dados());
    const antes = await geradas(id);
    const l = (await listarLancamentos(p, f, 2027)).lancamentos[0];
    await salvarLancamentoRateio(p, f, dados({ valor_unitario: 2000 }), { id, versao: l.versao });
    expect(total(await geradas(id))).toBe(24000);
    const [todas] = await lerTabelas(p, [Despesas] as const);
    expect(todas.todos().filter((d) => antes.some((a) => a.id === d.id) && !d.ativo)).toHaveLength(antes.length);
    // Salvar sem mudar nada não regrava.
    const l2 = (await listarLancamentos(p, f, 2027)).lancamentos[0];
    const ids = (await geradas(id)).map((d) => d.id).sort();
    await salvarLancamentoRateio(p, f, dados({ valor_unitario: 2000 }), { id, versao: l2.versao });
    expect((await geradas(id)).map((d) => d.id).sort()).toEqual(ids);
  });

  it('exige regra ativa e valida os campos', async () => {
    const f = await fin();
    await expect(salvarLancamentoRateio(p, f, dados({ regra_rateio_id: 'nao-existe' }))).rejects.toThrow(/Regra de rateio/);
    await expect(salvarLancamentoRateio(p, f, dados({ descricao: ' ' }))).rejects.toThrow(/Descreva/);
    await expect(salvarLancamentoRateio(p, f, dados({ quantidade: 0 }))).rejects.toThrow(/Quantidade/);
    await expect(salvarLancamentoRateio(p, f, dados({ ano: 2031 }))).rejects.toThrow(/exercício/);
  });
});

describe('recálculo automático (os cinco pontos)', () => {
  const porServico = async (id: string) => new Map((await geradas(id)).map((d) => [d.servico, d.valor_unitario]));

  it('1 e 3: salvar o lançamento; mudar números do serviço (atendidos) recalcula', async () => {
    const f = await fin();
    const { id } = await salvarLancamentoRateio(p, f, dados());
    const antes = await porServico(id);
    await salvarCentro(p, f, centroDe('ur', 100));
    const depois = await porServico(id);
    expect(depois.get('ur')!).toBeGreaterThan(antes.get('ur')!);
    expect(total(await geradas(id))).toBe(12000);
  });

  it('2: salvar a Regra de rateio usada (participantes) recalcula', async () => {
    const f = await fin();
    const { id } = await salvarLancamentoRateio(p, f, dados());
    expect((await porServico(id)).has('escola')).toBe(true);
    const regra = { nome: 'Por atendidos', tipo: 'area' as const, base1: 'atendidos' as const, base2: 'atendidos' as const, participantes: ['assistencia_social'] };
    await salvarRegra(p, f, { ...regra, id: regraId });
    const depois = await porServico(id);
    expect(depois.has('escola')).toBe(false);
    expect(total(await geradas(id))).toBe(12000);
  });

  it('3: salvar os valores de uma Base própria usada pela regra recalcula', async () => {
    const f = await fin();
    const baseId = await salvarBase(p, f, { nome: 'Refeições' });
    const regra = await salvarRegra(p, f, { nome: 'Por refeições', tipo: 'servico', base1: `propria:${baseId}`, base2: null, participantes: ['ur', 'escola'] });
    await salvarValoresDaBase(p, f, baseId, 2027, [{ servico: 'ur', valor: 1 }, { servico: 'escola', valor: 1 }]);
    const { id } = await salvarLancamentoRateio(p, f, dados({ regra_rateio_id: regra }));
    expect((await porServico(id)).get('ur')).toBe(6000);
    await salvarValoresDaBase(p, f, baseId, 2027, [{ servico: 'ur', valor: 3 }, { servico: 'escola', valor: 1 }]);
    const depois = await porServico(id);
    expect(depois.get('ur')).toBe(9000);
    expect(depois.get('escola')).toBe(3000);
  });

  it('5: mudar a lotação (profissionais) de um serviço participante recalcula', async () => {
    const f = await fin();
    const regra = await salvarRegra(p, f, { nome: 'Por profissionais', tipo: 'servico', base1: 'profissionais', base2: null, participantes: ['administracao', 'escola'] });
    const dp = await como('dp@exemplo.local');
    const grade = await gradeDeRateio(p, dp);
    await salvarRateios(p, dp, grade.postos.map((x) => ({ postoId: x.id, rateio: [{ centro: 'escola', percentual: 100 }] })), '2027-01-01');
    const { id } = await salvarLancamentoRateio(p, f, dados({ regra_rateio_id: regra }));
    expect([...(await porServico(id)).keys()]).toEqual(['escola']);
    await salvarRateios(p, dp, grade.postos.map((x) => ({ postoId: x.id, rateio: [{ centro: 'administracao', percentual: 100 }] })), '2027-02-01');
    expect([...(await porServico(id)).keys()]).toEqual(['administracao']);
  });

  it('exercício aprovado: nada muda mais, e não dá para excluir', async () => {
    const f = await fin();
    const { id } = await salvarLancamentoRateio(p, f, dados());
    const antes = await porServico(id);
    const [ex] = await lerTabelas(p, [Exercicios] as const);
    const e = ex.ativos().find((x) => x.ano === 2027)!;
    await atualizar(p, Exercicios, e.id, e.versao, { situacao: 'aprovado' }, { email: 'teste' });
    await salvarCentro(p, f, centroDe('ur', 500));
    await salvarRegra(p, f, { id: regraId, nome: 'Por atendidos', tipo: 'area', base1: 'atendidos', base2: 'atendidos', participantes: ['educacao'] });
    expect(await porServico(id)).toEqual(antes);
    const l = (await listarLancamentos(p, f, 2027)).lancamentos[0];
    await expect(excluirLancamentoRateio(p, f, id, l.versao)).rejects.toThrow(/aprovado/);
    await expect(salvarLancamentoRateio(p, f, dados({ valor_unitario: 1 }), { id, versao: l.versao })).rejects.toThrow(/aprovado/);
  });
});

describe('excluir, aviso e auditoria', () => {
  it('excluir encerra o lançamento e todas as despesas geradas', async () => {
    const f = await fin();
    const { id } = await salvarLancamentoRateio(p, f, dados());
    const n = (await geradas(id)).length;
    const l = (await listarLancamentos(p, f, 2027)).lancamentos[0];
    expect(await excluirLancamentoRateio(p, f, id, l.versao)).toBe(n);
    expect(await geradas(id)).toHaveLength(0);
    expect((await listarLancamentos(p, f, 2027)).lancamentos).toHaveLength(0);
    expect((await lerTabela(p, LancamentosRateio)).todos()).toHaveLength(1); // fica guardado
  });

  it('regra sem serviço para receber: grava e avisa (não bloqueia)', async () => {
    const f = await fin();
    const regra = await salvarRegra(p, f, { nome: 'Só saúde', tipo: 'area', base1: 'igual', base2: null, participantes: ['saude'] });
    await salvarCentro(p, f, { ...centroDe('cer_reabilitacao', 1), tipo: 'indireto' });
    const r = await salvarLancamentoRateio(p, f, dados({ regra_rateio_id: regra }));
    expect(r).toMatchObject({ semDespesa: true, geradas: 0 });
    expect(await geradas(r.id)).toHaveLength(0);
  });

  it('auditoria registra colunas, nunca valores', async () => {
    const f = await fin();
    const { id } = await salvarLancamentoRateio(p, f, dados({ descricao: 'Segredo do item' }));
    const l = (await listarLancamentos(p, f, 2027)).lancamentos[0];
    await salvarLancamentoRateio(p, f, dados({ descricao: 'Segredo do item', valor_unitario: 777 }), { id, versao: l.versao });
    const auditoria = (await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => ['LancamentosRateio', 'Despesas'].includes(a.entidade));
    expect(auditoria.some((a) => a.entidade === 'LancamentosRateio' && a.acao === 'alteracao')).toBe(true);
    expect(auditoria.some((a) => a.entidade === 'Despesas' && JSON.stringify(a).includes(id))).toBe(true);
    // Só o detalhe, sem os identificadores: um id aleatório ou a hora (milissegundos) podem conter "777".
    const detalhes = auditoria.map((a) => a.detalhes ?? '').join(' ').replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '');
    expect(detalhes).not.toContain('Segredo');
    expect(detalhes).not.toContain('777');
  });
});

describe('quem vê e quem altera', () => {
  it('só o Financeiro lança; quem vê o painel só lê; sem permissão não vê', async () => {
    const f = await fin();
    const { id } = await salvarLancamentoRateio(p, f, dados());
    for (const email of ['leitura@exemplo.local', 'diretoria@exemplo.local']) {
      const q = await como(email);
      await expect(salvarLancamentoRateio(p, q, dados())).rejects.toBeInstanceOf(ErroPermissao);
      await expect(previaDoLancamento(p, q, dados())).rejects.toBeInstanceOf(ErroPermissao);
      const l = await listarLancamentos(p, q, 2027);
      expect(l.podeEditar).toBe(false);
      expect(l.lancamentos).toHaveLength(1);
      await expect(excluirLancamentoRateio(p, q, id, 1)).rejects.toBeInstanceOf(ErroPermissao);
    }
    await expect(listarLancamentos(p, await como('compras@exemplo.local'), 2027)).rejects.toBeInstanceOf(ErroPermissao);
  });
});
