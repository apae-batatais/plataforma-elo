/**
 * Regras de rateio dos custos comuns (R1, proposta #91). Dados FICTÍCIOS.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { painelPorArea, salvarCentro } from '../aplicacao/analise-area';
import { lerPrevisao, salvarDespesa, salvarGrupo } from '../aplicacao/previsao';
import { encerrarBase, encerrarRegra, listarRegras, previaDaRegra, salvarBase, salvarRegra, salvarValoresDaBase } from '../aplicacao/regras-rateio';
import { popularFolhaFicticia, popularPrevisaoFicticia } from '../dados/ficticios';
import { GruposGasto, TABELAS_ORCAMENTO } from '../dados/tabelas';
import { aplicarRegras, conferirRegra, distribuirPorPeso, ratearPelaRegra, type CentroRateio, type RegraRateio } from '../dominio/rateio-custos';
import { manifesto } from '../manifesto';

const c = (codigo: string, area: string | null, tipo: CentroRateio['tipo'], x: Partial<CentroRateio> = {}): CentroRateio => ({
  codigo, area, tipo, atendidos: null, vagas: null, m2: null, profissionais: 0, regraId: null, ...x,
});
const centros = [
  c('horta', 'rural', 'direto', { m2: 100, atendidos: 10, profissionais: 1 }),
  c('viveiro', 'rural', 'direto', { m2: 300, atendidos: 30, profissionais: 3 }),
  c('escola', 'educ', 'direto', { m2: 600, atendidos: 60, profissionais: 2 }),
  c('cozinha', 'rural', 'indireto', { regraId: 'r-coz' }),
  c('adm', 'adm', 'despesa', { regraId: 'r-adm' }),
];
const ctx = { centros, custoDireto: new Map<string, number>(), basesProprias: new Map<string, Map<string, number>>() };
const soma = (m: Map<string, number>) => Math.round([...m.values()].reduce((s, v) => s + v, 0) * 100) / 100;

describe('regras de rateio (puras)', () => {
  it('serviços: valor × base ÷ soma das bases, fechando no centavo', () => {
    const r: RegraRateio = { id: 'x', nome: 'Energia', base1: 'm2', base2: null, tipo: 'servico', participantes: ['horta', 'viveiro', 'escola'] };
    const m = ratearPelaRegra(1000, r, ctx, () => true);
    expect([...m]).toEqual([['horta', 100], ['viveiro', 300], ['escola', 600]]);
    const tres = ratearPelaRegra(100, { ...r, base1: 'igual' }, ctx, () => true);
    expect(soma(tres)).toBe(100);
  });

  it('dois níveis: entre áreas pela base 1 e entre serviços da área pela base 2', () => {
    const r: RegraRateio = { id: 'x', nome: 'Água', base1: 'igual', base2: 'atendidos', tipo: 'area', participantes: ['rural', 'educ'] };
    const m = ratearPelaRegra(1000, r, ctx, () => true);
    expect([...m]).toEqual([['horta', 125], ['viveiro', 375], ['escola', 500]]);
    // Sem base 2, repete a base 1.
    const m1 = ratearPelaRegra(1000, { ...r, base1: 'm2', base2: null }, ctx, () => true);
    expect(m1.get('escola')).toBe(600);
    expect(m1.get('horta')).toBe(100);
  });

  it('base zero cai no custo direto e depois em partes iguais', () => {
    const r: RegraRateio = { id: 'x', nome: 'Vagas', base1: 'vagas', base2: null, tipo: 'servico', participantes: ['horta', 'viveiro'] };
    expect([...ratearPelaRegra(100, r, ctx, () => true)]).toEqual([['horta', 50], ['viveiro', 50]]);
    const comCusto = { ...ctx, custoDireto: new Map([['horta', 100], ['viveiro', 300]]) };
    expect([...ratearPelaRegra(100, r, comCusto, () => true)]).toEqual([['horta', 25], ['viveiro', 75]]);
  });

  it('base própria usa o valor de cada serviço', () => {
    const r: RegraRateio = { id: 'x', nome: 'Refeições', base1: 'propria:b1', base2: null, tipo: 'servico', participantes: ['horta', 'escola'] };
    const c2 = { ...ctx, basesProprias: new Map([['b1', new Map([['horta', 1], ['escola', 3]])]]) };
    expect([...ratearPelaRegra(400, r, c2, () => true)]).toEqual([['horta', 100], ['escola', 300]]);
  });

  it('centavos ajustados no maior participante', () => {
    expect(distribuirPorPeso(0.1, [1 / 3, 1 / 3, 1 / 3]).reduce((s, v) => Math.round((s + v) * 100) / 100, 0)).toBe(0.1);
  });

  it('valida participantes (ao menos um, sem repetir, apoio só com diretos)', () => {
    expect(() => conferirRegra({ tipo: 'servico', participantes: [] }, centros)).toThrow(/ao menos um/);
    expect(() => conferirRegra({ tipo: 'servico', participantes: ['horta', 'horta'] }, centros)).toThrow(/mais de uma vez/);
    expect(() => conferirRegra({ tipo: 'servico', participantes: ['cozinha'] }, centros, { apoio: true })).toThrow(/custo direto/);
    expect(() => conferirRegra({ tipo: 'servico', participantes: ['cozinha'] }, centros)).not.toThrow();
  });
});

describe('ordem de cálculo: comuns → apoio → administrativo', () => {
  const regras: RegraRateio[] = [
    { id: 'r-energia', nome: 'Energia', base1: 'm2', base2: null, tipo: 'servico', participantes: ['horta', 'viveiro', 'escola', 'cozinha'] },
    { id: 'r-coz', nome: 'Cozinha por atendidos', base1: 'atendidos', base2: null, tipo: 'servico', participantes: ['horta', 'escola'] },
    { id: 'r-adm', nome: 'Adm por profissionais', base1: 'profissionais', base2: null, tipo: 'servico', participantes: ['horta', 'viveiro', 'escola'] },
  ];

  it('apoio que recebeu custo comum repassa o que recebeu; a soma não muda; precedência item > grupo', () => {
    const custos = [
      { servico: 'adm', grupo: 'Energia', valor: 1000, regraGrupo: 'r-energia' },
      { servico: 'cozinha', grupo: 'Gás', valor: 200 },
      { servico: 'adm', grupo: 'Papel', valor: 600 },
      { servico: 'horta', grupo: 'Sementes', valor: 50 },
      { servico: 'horta', grupo: 'Energia', valor: 100, regraGrupo: 'r-energia', regraItem: 'r-coz' },
    ];
    const r = aplicarRegras({ centros, regras, custos });
    const total = Math.round([...r.mantidos, ...r.rateados].reduce((s, x) => s + x.valor, 0) * 100) / 100;
    expect(total).toBe(1950);
    // Energia: cozinha tem m2 nulo → 0, então os 1000 vão 100/300/600 entre os 3 serviços.
    expect(r.mantidos).toEqual([{ servico: 'horta', grupo: 'Sementes', valor: 50 }]);
    const porServico = (s: string) => Math.round(r.rateados.filter((x) => x.servico === s).reduce((t, x) => t + x.valor, 0) * 100) / 100;
    // O item de R$ 100 usa a regra da cozinha (10 e 60 atendidos): 14,29 e 85,71. Cozinha 200 também.
    expect(r.rateados.find((x) => x.grupo === 'Energia' && x.de === 'horta' && x.servico === 'escola')?.valor).toBeCloseTo(85.71, 2);
    expect(r.rateados.every((x) => ['horta', 'viveiro', 'escola'].includes(x.servico))).toBe(true);
    expect(porServico('horta') + porServico('viveiro') + porServico('escola')).toBe(1900);
    expect(r.rateados.find((x) => x.grupo === 'Papel')?.origem).toBe('administrativo');
    expect(r.rateados.find((x) => x.grupo === 'Gás')?.origem).toBe('apoio');
  });

  it('sem regra nada muda; regra que não existe mais gera aviso', () => {
    const custos = [{ servico: 'horta', grupo: 'A', valor: 10, regraGrupo: 'apagada' }];
    const r = aplicarRegras({ centros, regras: [], custos });
    expect(r.mantidos).toEqual([{ servico: 'horta', grupo: 'A', valor: 10 }]);
    expect(r.rateados).toEqual([]);
    expect(r.avisos.length).toBe(1);
  });
});

describe('regras de rateio (aplicação)', () => {
  let p: Planilhas;
  const como = async (email: string) => {
    const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
    return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
  };
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
  });

  it('só o Financeiro altera; quem vê o painel vê; nome único; exclusão bloqueada em uso', async () => {
    const fin = await como('financeiro@exemplo.local');
    const dados = { nome: 'Energia', tipo: 'servico' as const, base1: 'igual' as const, base2: null, participantes: ['escola'] };
    await expect(salvarRegra(p, await como('leitura@exemplo.local'), dados)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(salvarRegra(p, await como('diretoria@exemplo.local'), dados)).rejects.toBeInstanceOf(ErroPermissao);
    const id = await salvarRegra(p, fin, dados);
    await expect(salvarRegra(p, fin, { ...dados, nome: 'ENERGIA ' })).rejects.toThrow(/não pode se repetir/);
    await expect(salvarRegra(p, fin, { ...dados, nome: 'Vazia', participantes: [] })).rejects.toThrow(/ao menos um/);
    expect((await listarRegras(p, await como('leitura@exemplo.local'))).regras.ativas).toHaveLength(1);
    await expect(listarRegras(p, await como('compras@exemplo.local'))).rejects.toBeInstanceOf(ErroPermissao);

    const [grupos] = await lerTabelas(p, [GruposGasto] as const);
    const g = grupos.ativos()[0];
    await salvarGrupo(p, fin, { id: g.id, versao: g.versao, nome: g.nome, rh: g.rh, regra_rateio_id: id });
    const lida = (await listarRegras(p, fin)).regras.ativas[0];
    expect(lida.uso.grupos).toBe(1);
    await expect(encerrarRegra(p, fin, id, lida.versao, false)).rejects.toThrow(/1 grupo/);
    const [g2] = (await lerTabelas(p, [GruposGasto] as const))[0].ativos().filter((x) => x.id === g.id);
    await salvarGrupo(p, fin, { id: g.id, versao: g2.versao, nome: g.nome, rh: g.rh, regra_rateio_id: null });
    await encerrarRegra(p, fin, id, lida.versao, false);
    expect((await listarRegras(p, fin)).regras.excluidas).toHaveLength(1);
    const v = (await listarRegras(p, fin)).regras.excluidas[0].versao;
    await encerrarRegra(p, fin, id, v, true);
    expect((await listarRegras(p, fin)).regras.ativas).toHaveLength(1);
  });

  it('regra do grupo muda a distribuição entre serviços, mas não o total do orçamento', async () => {
    const fin = await como('financeiro@exemplo.local');
    const antes = await painelPorArea(p, fin, { area: 'educacao' });
    const prev = await lerPrevisao(p, fin);
    const [grupos] = await lerTabelas(p, [GruposGasto] as const);
    const grupo = grupos.ativos().find((x) => prev.despesas.some((d) => d.grupo_id === x.id && d.categoria === 'operacional'))!;
    const regraId = await salvarRegra(p, fin, { nome: 'Só escola', tipo: 'servico', base1: 'igual', base2: null, participantes: ['escola'] });
    await salvarGrupo(p, fin, { id: grupo.id, versao: grupo.versao, nome: grupo.nome, rh: grupo.rh, regra_rateio_id: regraId });
    const depois = await painelPorArea(p, fin, { area: 'educacao' });
    expect(depois.analise!.totais.orcamento).toBeCloseTo(antes.analise!.totais.orcamento, 2);
    expect(depois.analise!.rateadoPorRegra).toBeGreaterThan(0);
    const escola = depois.analise!.rateio.find((r) => r.codigo === 'escola')!;
    expect(escola.regras[0]).toMatchObject({ nome: 'Só escola', origem: 'comum' });
    expect(escola.R).toBeGreaterThan(0);
    // O leitor também vê o resultado.
    expect((await painelPorArea(p, await como('leitura@exemplo.local'), { area: 'educacao' })).analise!.rateadoPorRegra).toBeGreaterThan(0);
  });

  it('regra no centro de apoio vale só para apoio/administrativo, e participantes têm de ser diretos', async () => {
    const fin = await como('financeiro@exemplo.local');
    const regraId = await salvarRegra(p, fin, { nome: 'Transporte', tipo: 'servico', base1: 'atendidos', base2: null, participantes: ['escola'] });
    await expect(salvarCentro(p, fin, { servico: 'escola', tipo: 'direto', atendidos: null, sessoes: null, area_m2: null, regra_rateio_id: regraId })).rejects.toThrow(/apoio ou administrativo/);
    await salvarCentro(p, fin, { servico: 'transporte', tipo: 'indireto', atendidos: null, sessoes: null, area_m2: null, vagas: 12, regra_rateio_id: regraId });
    const painel = await painelPorArea(p, fin, { area: 'educacao' });
    expect(painel.analise!.rateio.find((r) => r.codigo === 'escola')!.regras.some((r) => r.origem === 'apoio')).toBe(true);
    await expect(salvarCentro(p, await como('leitura@exemplo.local'), { servico: 'transporte', tipo: 'indireto', atendidos: null, sessoes: null, area_m2: null, regra_rateio_id: null })).rejects.toBeInstanceOf(ErroPermissao);
  });

  it('item pode trocar a regra do grupo; regra inexistente é recusada', async () => {
    const fin = await como('financeiro@exemplo.local');
    const prev = await lerPrevisao(p, fin);
    const d = prev.despesas[0];
    const dados = { ano: prev.ano, servico: d.servico, grupo_id: d.grupo_id, fonte_id: d.fonte_id, descricao: d.descricao, quantidade: d.quantidade, ocorrencias: d.ocorrencias, valor_unitario: d.valor_unitario, distribuicao: d.distribuicao, meses: d.meses.map((v, i) => (v ? i + 1 : 0)).filter(Boolean) };
    await expect(salvarDespesa(p, fin, { ...dados, regra_rateio_id: 'nao-existe' }, { id: d.id, versao: d.versao })).rejects.toThrow(/Regra de rateio/);
    const id = await salvarRegra(p, fin, { nome: 'Do item', tipo: 'servico', base1: 'igual', base2: null, participantes: ['escola'] });
    await salvarDespesa(p, fin, { ...dados, regra_rateio_id: id }, { id: d.id, versao: d.versao });
    expect((await listarRegras(p, fin)).regras.ativas[0].uso.itens).toBe(1);
  });

  it('bases próprias: nome único, valores por serviço, prévia em reais e exclusão em uso', async () => {
    const fin = await como('financeiro@exemplo.local');
    const baseId = await salvarBase(p, fin, { nome: 'Refeições' });
    await expect(salvarBase(p, fin, { nome: 'refeições' })).rejects.toThrow(/não pode se repetir/);
    await expect(salvarBase(p, await como('leitura@exemplo.local'), { nome: 'Outra' })).rejects.toBeInstanceOf(ErroPermissao);
    await salvarValoresDaBase(p, fin, baseId, 2026, [{ servico: 'escola', valor: 3 }, { servico: 'transporte', valor: 1 }]);
    const dados = { nome: 'Por refeição', tipo: 'servico' as const, base1: `propria:${baseId}` as const, base2: null, participantes: ['escola', 'transporte'] };
    const previa = await previaDaRegra(p, fin, dados, 2026, 1000);
    expect(previa.linhas.map((l) => [l.codigo, l.valor])).toEqual([['escola', 750], ['transporte', 250]]);
    await salvarRegra(p, fin, dados);
    const base = (await listarRegras(p, fin)).bases.ativas[0];
    await expect(encerrarBase(p, fin, baseId, base.versao, false)).rejects.toThrow(/1 regra usa/);
  });
});
