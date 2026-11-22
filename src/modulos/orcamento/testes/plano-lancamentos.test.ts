/**
 * Plano de contas nos lançamentos (entrega 2 da #221), com dados FICTÍCIOS: Item contábil e Área do plano na
 * despesa e no realizado, avisos que só orientam, erro de dado, quem altera e CSV.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { inserirRegistros, lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { baixarItensCsv } from '../aplicacao/baixar-planilha';
import { listarCadastrosDoPlano, salvarAreaPlano, salvarItemContabil, salvarPlano, excluirItemContabil } from '../aplicacao/plano-contas';
import { opcoesDoPlano } from '../aplicacao/plano-lancamento';
import { abrirExercicio, lerPrevisao, salvarDespesa, type DadosDespesa } from '../aplicacao/previsao';
import { lerGradeDoMes, salvarRealizadoDoMes, type EntradaLinha } from '../aplicacao/realizado';
import { Despesas, Fontes, GruposGasto, ItensContabeis, PLANILHA_EXECUCAO, Realizado, TABELAS_ORCAMENTO } from '../dados/tabelas';
import { avisoDoPlano, itensParaEscolher, versaoParaLancar, type LinhaGravada } from '../dominio/plano-contas';
import { mesAnterior, mesAtualBrasilia } from '../dominio/tesouraria';
import { manifesto } from '../manifesto';

let p: Planilhas;
const MES = mesAnterior(mesAtualBrasilia());
const ANO = Number(MES.slice(0, 4));

async function como(email: string) {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
}
const fin = () => como('financeiro@exemplo.local');

let ids: { g1: string; g2: string; f: string; a1: string; a2: string; i1: string; i2: string; i3: string };

beforeEach(async () => {
  p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha', PLANILHA_EXECUCAO]), idDe: (c) => c };
  await prepararEstrutura(p, {
    tabelas: [...TABELAS_ORCAMENTO] as never,
    perfis: manifesto.perfis,
    permissoes: Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao }))),
  });
  await popularDadosFicticios(p);
  const q = await fin();
  const [grupos, fontes] = await lerTabelas(p, [GruposGasto, Fontes] as const);
  const [g1, g2] = await inserirRegistros(p, grupos, [{ nome: 'Material (teste)', rh: false }, { nome: 'Serviços (teste)', rh: false }], { email: 'teste' });
  const [f] = await inserirRegistros(p, fontes, [{ nome: 'Doações (teste)', natureza: 'propria', uso: 'livre' }], { email: 'teste' });
  await abrirExercicio(p, q, ANO);
  await salvarAreaPlano(p, q, { nome: 'Área A' });
  await salvarAreaPlano(p, q, { nome: 'Área B' });
  await salvarItemContabil(p, q, { grupo_id: g1.id, nome: 'Item 1' });
  await salvarItemContabil(p, q, { grupo_id: g1.id, nome: 'Item 2' });
  await salvarItemContabil(p, q, { grupo_id: g2.id, nome: 'Item 3' });
  const c = await listarCadastrosDoPlano(p, q);
  const [a1, a2] = c.areas.ativos.map((a) => a.id);
  const [i1, i2] = c.itens.ativos.filter((i) => i.grupo_id === g1.id).map((i) => i.id);
  const i3 = c.itens.ativos.find((i) => i.grupo_id === g2.id)!.id;
  ids = { g1: g1.id, g2: g2.id, f: f.id, a1, a2, i1, i2, i3 };
});

/** Plano do ano: Área A só tem o Item 1 do Material; Área B só o Grupo de serviços (sem itens). */
async function montarPlano() {
  await salvarPlano(p, await fin(), { ano: ANO, vigencia: `${ANO}-01-01`, loteLido: null, linhas: [
    { area_id: ids.a1, grupo_id: ids.g1, item_id: ids.i1 },
    { area_id: ids.a2, grupo_id: ids.g2, item_id: null },
  ] });
}

const despesa = (extra: Partial<DadosDespesa> = {}): DadosDespesa => ({
  ano: ANO, servico: 'escola', grupo_id: ids.g1, fonte_id: ids.f, descricao: 'Papel (teste)', quantidade: 1, ocorrencias: 1, valor_unitario: 100, distribuicao: 'igual', ...extra,
});
const linha = (extra: Partial<EntradaLinha> = {}): EntradaLinha => ({ tipo: 'despesa', servico: 'escola', grupoId: ids.g1, fonteId: ids.f, natureza: 'custeio', valor: 1000, ...extra });

describe('regras puras', () => {
  const linhas = [
    { area_id: 'A', grupo_id: 'G', item_id: 'I1' },
    { area_id: 'B', grupo_id: 'G', item_id: 'I2' },
    { area_id: 'B', grupo_id: 'H', item_id: null },
  ];
  const itens = [{ id: 'I1', nome: 'Um', codigo: null, grupo_id: 'G' }, { id: 'I2', nome: 'Dois', codigo: null, grupo_id: 'G' }, { id: 'I3', nome: 'Três', codigo: null, grupo_id: 'G' }];

  it('itens habilitados na área vêm primeiro; os demais ficam em "outros"; sem plano, todos', () => {
    expect(itensParaEscolher(itens, 'G', 'A', linhas).habilitados.map((i) => i.id)).toEqual(['I1']);
    expect(itensParaEscolher(itens, 'G', 'A', linhas).outros.map((i) => i.id)).toEqual(['I2', 'I3']);
    expect(itensParaEscolher(itens, 'G', null, linhas).habilitados.map((i) => i.id)).toEqual(['I1', 'I2']);
    expect(itensParaEscolher(itens, 'G', 'A', null)).toEqual({ habilitados: itens, outros: [] });
  });

  it('avisa quando está fora do plano; sem plano ou sem escolha, não avisa', () => {
    expect(avisoDoPlano({ grupo_id: 'G', item_id: 'I1', area_id: 'A' }, linhas, 2027)).toBeNull();
    expect(avisoDoPlano({ grupo_id: 'G', item_id: 'I2', area_id: 'A' }, linhas, 2027)).toBe('Este item não está habilitado para esta área em 2027.');
    expect(avisoDoPlano({ grupo_id: 'G', item_id: null, area_id: 'C' }, linhas, 2027)).toBe('Esta área não está no plano de 2027.');
    expect(avisoDoPlano({ grupo_id: 'H', item_id: null, area_id: 'A' }, linhas, 2027)).toBe('Este grupo não está habilitado para esta área em 2027.');
    expect(avisoDoPlano({ grupo_id: 'G', item_id: 'I3', area_id: null }, linhas, 2027)).toBe('Este item não está no plano de 2027.');
    expect(avisoDoPlano({ grupo_id: 'G', item_id: 'I3', area_id: 'A' }, null, 2027)).toBeNull();
    expect(avisoDoPlano({ grupo_id: 'G', item_id: null, area_id: null }, linhas, 2027)).toBeNull();
  });

  it('plano para lançar: o vigente na data; antes da vigência, o mais recente do ano', () => {
    const g: LinhaGravada[] = [
      { exercicio: 2027, lote: 'a', vigencia: '2027-03-01', area_id: 'A', grupo_id: 'G', item_id: null },
      { exercicio: 2027, lote: 'b', vigencia: '2027-09-01', area_id: 'A', grupo_id: 'G', item_id: 'I1' },
    ];
    expect(versaoParaLancar(g, 2027, '2027-05-01')?.lote).toBe('a');
    expect(versaoParaLancar(g, 2027, '2027-10-01')?.lote).toBe('b');
    expect(versaoParaLancar(g, 2027, '2027-01-10')?.lote).toBe('b');
    expect(versaoParaLancar(g, 2026, '2026-05-01')).toBeUndefined();
    expect(versaoParaLancar(g, 2027, '2030-01-01')?.lote).toBe('b');
  });
});

describe('despesa com item e área do plano', () => {
  it('grava item e área, audita só a coluna e lê de volta', async () => {
    const q = await fin();
    const id = await salvarDespesa(p, q, despesa({ item_id: ids.i1, area_plano_id: ids.a1 }));
    const d = (await lerTabela(p, Despesas)).porId(id)!;
    expect([d.item_id, d.area_plano_id]).toEqual([ids.i1, ids.a1]);
    const prev = await lerPrevisao(p, q, ANO);
    expect(prev.despesas[0].item_id).toBe(ids.i1);
    // alterar: sem informar item/área mantém; null limpa; auditoria registra colunas, nunca valores
    await salvarDespesa(p, q, despesa({ valor_unitario: 150 }), { id, versao: d.versao });
    expect((await lerTabela(p, Despesas)).porId(id)!.item_id).toBe(ids.i1);
    const v2 = (await lerTabela(p, Despesas)).porId(id)!.versao;
    await salvarDespesa(p, q, despesa({ item_id: null }), { id, versao: v2 });
    expect((await lerTabela(p, Despesas)).porId(id)!.item_id).toBeNull();
    const aud = (await lerTabela(p, RegistrosAuditoria)).todos().filter((r) => r.entidade === 'Despesas' && r.acao === 'alteracao');
    expect(aud.length).toBeGreaterThan(0);
    expect(JSON.stringify(aud)).not.toContain(ids.i1);
  });

  it('o plano só orienta: item e área fora do plano gravam normalmente', async () => {
    await montarPlano();
    const q = await fin();
    const id = await salvarDespesa(p, q, despesa({ item_id: ids.i2, area_plano_id: ids.a1 }));
    expect((await lerTabela(p, Despesas)).porId(id)!.item_id).toBe(ids.i2);
    const op = await opcoesDoPlano(p, ANO);
    expect(avisoDoPlano({ grupo_id: ids.g1, item_id: ids.i2, area_id: ids.a1 }, op.linhas, ANO)).toMatch(/não está habilitado/);
  });

  it('item de outro grupo é erro de dado e não grava', async () => {
    const q = await fin();
    await expect(salvarDespesa(p, q, despesa({ item_id: ids.i3 }))).rejects.toThrow(/outro grupo de contas/);
    await expect(salvarDespesa(p, q, despesa({ item_id: 'nao-existe' }))).rejects.toThrow(/não existe/);
    await expect(salvarDespesa(p, q, despesa({ area_plano_id: 'nao-existe' }))).rejects.toThrow(/área do plano/);
    expect((await lerTabela(p, Despesas)).ativos()).toHaveLength(0);
  });

  it('item excluído não entra em lançamento novo, mas a despesa que já o usava continua salvando', async () => {
    const q = await fin();
    const id = await salvarDespesa(p, q, despesa({ item_id: ids.i1 }));
    const item = (await lerTabela(p, ItensContabeis)).porId(ids.i1)!;
    await excluirItemContabil(p, q, ids.i1, item.versao);
    await expect(salvarDespesa(p, q, despesa({ item_id: ids.i1 }))).rejects.toThrow(/excluído/);
    const v = (await lerTabela(p, Despesas)).porId(id)!.versao;
    await salvarDespesa(p, q, despesa({ valor_unitario: 120, item_id: ids.i1 }), { id, versao: v });
  });

  it('sem plano no exercício, as opções vêm sem plano (mostra todos os itens)', async () => {
    expect((await opcoesDoPlano(p, ANO)).linhas).toBeNull();
    await montarPlano();
    expect((await opcoesDoPlano(p, ANO)).linhas).toHaveLength(2);
  });

  it('só o Financeiro altera; o total do orçamento não muda por causa do plano', async () => {
    const q = await fin();
    const a = await salvarDespesa(p, q, despesa());
    const totalSem = (await lerPrevisao(p, q, ANO)).totais.despesa.anual;
    await salvarDespesa(p, q, despesa({ item_id: ids.i1, area_plano_id: ids.a1 }), { id: a, versao: (await lerTabela(p, Despesas)).porId(a)!.versao });
    expect((await lerPrevisao(p, q, ANO)).totais.despesa.anual).toBe(totalSem);
    await expect(salvarDespesa(p, await como('diretoria@exemplo.local'), despesa({ item_id: ids.i1 }))).rejects.toBeInstanceOf(ErroPermissao);
  });
});

describe('realizado com item e área do plano', () => {
  it('grava, mostra na grade e audita só colunas; plano do mês vem nas opções', async () => {
    await montarPlano();
    const q = await fin();
    await salvarRealizadoDoMes(p, q, MES, [linha({ itemId: ids.i1, areaPlanoId: ids.a1 })]);
    const r = (await lerTabela(p, Realizado)).ativos()[0];
    expect([r.item_id, r.area_plano_id]).toEqual([ids.i1, ids.a1]);
    const g = await lerGradeDoMes(p, q, MES);
    expect([g.despesas[0].itemId, g.despesas[0].areaPlanoId]).toEqual([ids.i1, ids.a1]);
    expect(g.opcoes.plano.areas.map((a) => a.nome)).toContain('Área A');
    // regravar sem informar mantém; trocar item muda e audita a coluna
    await salvarRealizadoDoMes(p, q, MES, [linha({ versao: g.despesas[0].versao! })]);
    expect((await lerTabela(p, Realizado)).ativos()[0].item_id).toBe(ids.i1);
    const g2 = await lerGradeDoMes(p, q, MES);
    await salvarRealizadoDoMes(p, q, MES, [linha({ itemId: ids.i2, areaPlanoId: '', versao: g2.despesas[0].versao! })]);
    const r2 = (await lerTabela(p, Realizado)).ativos()[0];
    expect([r2.item_id, r2.area_plano_id]).toEqual([ids.i2, null]);
    const aud = (await lerTabela(p, RegistrosAuditoria)).todos().filter((x) => x.entidade === 'Realizado' && x.acao === 'alteracao');
    expect(JSON.stringify(aud)).toContain('item_id');
    expect(JSON.stringify(aud)).not.toContain(ids.i2);
  });

  it('item de outro grupo recusa; receita ignora item e área', async () => {
    const q = await fin();
    await expect(salvarRealizadoDoMes(p, q, MES, [linha({ itemId: ids.i3 })])).rejects.toThrow(/outro grupo de contas/);
    await salvarRealizadoDoMes(p, q, MES, [{ tipo: 'receita', servico: null, grupoId: null, fonteId: ids.f, natureza: 'receita_comum', valor: 50, itemId: ids.i1, areaPlanoId: ids.a1 }]);
    const r = (await lerTabela(p, Realizado)).ativos()[0];
    expect([r.item_id, r.area_plano_id]).toEqual([null, null]);
  });

  it('só o Financeiro altera', async () => {
    await expect(salvarRealizadoDoMes(p, await como('diretoria@exemplo.local'), MES, [linha({ itemId: ids.i1 })])).rejects.toBeInstanceOf(ErroPermissao);
  });
});

describe('Baixar planilha de despesas', () => {
  it('ganha as colunas Item contábil e Área do plano', async () => {
    const q = await fin();
    await salvarDespesa(p, q, despesa({ item_id: ids.i1, area_plano_id: ids.a1 }));
    await salvarDespesa(p, q, despesa({ descricao: 'Sem plano (teste)' }));
    const csv = (await baixarItensCsv(p, q, 'despesa', ANO)).conteudo;
    expect(csv).toContain('Item contábil;Área do plano');
    expect(csv).toContain('Item 1;Área A');
    const sem = csv.split('\n').find((l) => l.includes('Sem plano (teste)'))!;
    expect(sem).not.toContain('Item 1');
  });
});

