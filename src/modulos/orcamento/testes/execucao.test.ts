/** Painel de execução e Recursos livres (1C.2): regras, escopo e bordas. Só dados FICTÍCIOS, anos fixos no passado. */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { inserirRegistros, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { lerPainelExecucao, lerRecursosLivres } from '../aplicacao/execucao';
import { ErroRealizado, salvarRealizadoDoMes } from '../aplicacao/realizado';
import { Despesas, Exercicios, Fontes, GruposGasto, PLANILHA_EXECUCAO, Realizado, TABELAS_ORCAMENTO } from '../dados/tabelas';
import { manifesto } from '../manifesto';

let p: Planilhas;
const HOJE = '2025-12-31';
let ids: { g: string; termo: string; livre: string };

async function como(email: string) {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
}

type L = { ano: number; mes: number; tipo: 'despesa' | 'receita'; servico?: string | null; fonte: string; natureza: string; valor: number; nr?: boolean; termo?: string | null };
async function gravar(linhas: L[]) {
  const [t] = await lerTabelas(p, [Realizado] as const);
  await inserirRegistros(
    p,
    t,
    linhas.map((l) => ({
      ano: l.ano,
      mes: `${l.ano}-${String(l.mes).padStart(2, '0')}`,
      tipo: l.tipo,
      servico: l.tipo === 'despesa' ? ('servico' in l ? l.servico : 'escola') : null,
      grupo_id: l.tipo === 'despesa' ? ids.g : null,
      fonte_id: l.fonte,
      natureza: l.natureza,
      valor: l.valor,
      nao_recorrente: !!l.nr,
      motivo_nao_recorrente: l.nr ? 'motivo (teste)' : null,
      observacao: null,
      fonte_termo_id: l.termo ?? null,
    })) as never,
    { email: 'teste' },
  );
}
const desp = (mes: number, valor: number, extra: Partial<L> = {}): L => ({ ano: 2025, mes, tipo: 'despesa', fonte: ids.livre, natureza: 'custeio', valor, ...extra });
const rec = (mes: number, valor: number, extra: Partial<L> = {}): L => ({ ano: 2025, mes, tipo: 'receita', fonte: ids.livre, natureza: 'receita_comum', valor, ...extra });

async function aprovarPrevisao(valorMes = 1000) {
  const [ex, d] = await lerTabelas(p, [Exercicios, Despesas] as const);
  await inserirRegistros(p, ex, [{ ano: 2025, situacao: 'aprovado', aprovado_em: '2025-01-01', aprovado_por: 'x' }], { email: 'teste' });
  const meses = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`m${i + 1}`, valorMes]));
  const base = { ano: 2025, grupo_id: ids.g, fonte_id: ids.livre, quantidade: 1, ocorrencias: 12, valor_unitario: valorMes, distribuicao: 'igual' as const, situacao: 'aceito' as const, observacao: null };
  await inserirRegistros(p, d, [{ ...base, servico: 'escola', descricao: 'Item escola', ...meses }, { ...base, servico: 'ur', descricao: 'Item UR', ...meses }] as never, { email: 'teste' });
}

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
  const [termo, livre] = await inserirRegistros(p, fontes, [{ nome: 'Termo (teste)', natureza: 'publica', uso: 'restrita' }, { nome: 'Doações (teste)', natureza: 'propria', uso: 'livre' }], { email: 'teste' });
  ids = { g: g.id, termo: termo.id, livre: livre.id };
});

describe('Painel de execução', () => {
  it('R1 e R2: orçado × realizado por serviço, com previsto cortado no último mês informado (R3)', async () => {
    await aprovarPrevisao(1000);
    await gravar([desp(1, 800), desp(2, 1200), desp(2, 300, { servico: 'ur' }), rec(1, 5000), rec(2, 5000)]);
    const f = await como('financeiro@exemplo.local');
    const r = await lerPainelExecucao(p, f, { ano: 2025 }, HOJE);
    expect(r.nivel).toBe('completo');
    expect(r.periodo.contam).toEqual(['2025-01', '2025-02']);
    expect(r.despesa).toEqual({ realizado: 2300, previsto: 4000, execucao: 57.5 });
    expect(r.receita).toEqual({ realizado: 10000, previsto: 0, execucao: null });
    expect(r.resultado?.realizado).toBe(7700);
    expect(r.porServico.map((s) => [s.previsto, s.realizado])).toEqual([[2000, 2000], [2000, 300]]);
  });

  it('mês do meio sem dado fica fora das somas dos dois lados e vira pendência', async () => {
    await aprovarPrevisao(1000);
    await gravar([desp(1, 500), desp(3, 700)]);
    const r = await lerPainelExecucao(p, await como('financeiro@exemplo.local'), { ano: 2025 }, HOJE);
    expect(r.periodo.semDado).toEqual(['2025-02']);
    expect(r.pendencias.mesesSemDado).toEqual(['2025-02']);
    expect(r.despesa.previsto).toBe(4000);
    expect(r.despesa.realizado).toBe(1200);
    expect(r.porMes?.[1]).toMatchObject({ informado: false, despesa: null });
  });

  it('realizado sem linha na Previsão entra marcado "fora da previsão"', async () => {
    await aprovarPrevisao(1000);
    await gravar([desp(1, 100, { servico: 'cer_reabilitacao' })]);
    const r = await lerPainelExecucao(p, await como('financeiro@exemplo.local'), { ano: 2025 }, HOJE);
    expect(r.linhas.find((l) => l.realizado === 100)?.foraDaPrevisao).toBe(true);
    expect(r.linhas.filter((l) => l.previsto > 0).every((l) => !l.foraDaPrevisao)).toBe(true);
  });

  it('sem Previsão aprovada: só o realizado, previsto nulo', async () => {
    await gravar([desp(1, 100)]);
    const r = await lerPainelExecucao(p, await como('financeiro@exemplo.local'), { ano: 2025 }, HOJE);
    expect(r.previsaoAprovada).toBe(false);
    expect(r.despesa).toEqual({ realizado: 100, previsto: null, execucao: null });
    expect(r.linhas.every((l) => !l.foraDaPrevisao)).toBe(true);
  });

  it('sem nenhum mês informado: vazio, sem erro', async () => {
    const r = await lerPainelExecucao(p, await como('financeiro@exemplo.local'), { ano: 2025 }, HOJE);
    expect(r.temRealizado).toBe(false);
    expect(r.periodo.meses).toEqual([]);
    expect(r.despesa.realizado).toBe(0);
  });

  it('R8: Coordenação soma só o seu escopo, sem receita nem totais que deixem subtrair o resto', async () => {
    await aprovarPrevisao(1000);
    await gravar([desp(1, 100, { servico: 'escola' }), desp(1, 40, { servico: 'ur' }), rec(1, 900)]);
    const r = await lerPainelExecucao(p, await como('coord.ur@exemplo.local'), { ano: 2025 }, HOJE);
    const nomeUr = (await lerTabelas(p, [Servicos] as const))[0].todos().find((x) => x.codigo === 'ur')!.nome;
    expect(r.nivel).toBe('escopo');
    expect(r.despesa).toEqual({ realizado: 40, previsto: 1000, execucao: 4 });
    expect(r.receita).toBeNull();
    expect(r.resultado).toBeNull();
    expect(r.porMes).toBeNull();
    expect(r.linhas.every((l) => l.tipo === 'despesa' && l.servico === nomeUr)).toBe(true);
    expect(r.porServico).toHaveLength(1);
    expect(r.pendencias.adiantamentosAcimaDoLimite).toBe(0);
  });

  it('R8: Leitura vê só os totais, sem serviço, grupo nem fonte', async () => {
    await aprovarPrevisao(1000);
    await gravar([desp(1, 100), rec(1, 900)]);
    const r = await lerPainelExecucao(p, await como('leitura@exemplo.local'), { ano: 2025 }, HOJE);
    expect(r.nivel).toBe('totais');
    expect(r.despesa.realizado).toBe(100);
    expect(r.receita?.realizado).toBe(900);
    expect(r.linhas).toEqual([]);
    expect(r.porServico).toEqual([]);
    expect(r.porMes).toBeNull();
  });

  it('quem não tem permissão não acessa', async () => {
    for (const email of ['dp@exemplo.local', 'compras@exemplo.local', 'funcionario@exemplo.local']) {
      await expect(lerPainelExecucao(p, await como(email), { ano: 2025 })).rejects.toBeInstanceOf(ErroPermissao);
    }
  });

  it('ano inválido vale o ano atual (sem erro)', async () => {
    await expect(lerPainelExecucao(p, await como('financeiro@exemplo.local'), { ano: Number.NaN })).resolves.toBeTruthy();
  });
});

describe('Recursos livres', () => {
  it('R4: despesa livre por serviço e natureza; sem serviço vai para Comum; resultado = receita livre − despesa livre', async () => {
    await gravar([
      desp(1, 300, { servico: 'escola', natureza: 'rh' }),
      desp(1, 100, { servico: 'escola', natureza: 'custeio' }),
      desp(1, 50, { servico: null as never }),
      desp(1, 999, { fonte: ids.termo }), // restrita: não é recurso livre
      rec(1, 1000),
      rec(1, 777, { fonte: ids.termo }), // restrita
    ]);
    const r = await lerRecursosLivres(p, await como('financeiro@exemplo.local'), { ano: 2025 }, HOJE);
    expect(r.despesaLivre).toBe(450);
    expect(r.receitaLivre).toBe(1000);
    expect(r.resultado).toBe(550);
    expect(r.porServico.map((s) => s.servico)).toContain('Comum');
    const escola = r.porServico.find((s) => s.servico !== 'Comum' && s.total === 400);
    expect(escola?.naturezas).toEqual({ rh: 300, custeio: 100 });
    expect(escola?.naturezaDominante).toBe('Recursos humanos');
    expect(escola?.peso).toBe(88.9);
  });

  it('R4: despesa sem serviço (linha antiga) cai em "Comum"', async () => {
    const [t] = await lerTabelas(p, [Realizado] as const);
    await inserirRegistros(p, t, [{ ano: 2025, mes: '2025-01', tipo: 'despesa', servico: null, grupo_id: ids.g, fonte_id: ids.livre, natureza: 'custeio', valor: 70, nao_recorrente: false, motivo_nao_recorrente: null, observacao: null }] as never, { email: 'teste' });
    const r = await lerRecursosLivres(p, await como('financeiro@exemplo.local'), { ano: 2025 }, HOJE);
    expect(r.porServico).toMatchObject([{ servico: 'Comum', total: 70 }]);
  });

  it('R5: adiantamento baixado do mais antigo; etiqueta de atenção acima de 60 dias; ressarcido a mais aparece', async () => {
    await gravar([
      desp(1, 1000, { fonte: ids.livre, natureza: 'adiantamento_termo', termo: ids.termo }),
      desp(3, 500, { fonte: ids.livre, natureza: 'adiantamento_termo', termo: ids.termo }),
      rec(4, 1200, { fonte: ids.termo, natureza: 'ressarcimento' }),
    ]);
    const r = await lerRecursosLivres(p, await como('financeiro@exemplo.local'), { ano: 2025 }, HOJE);
    const t = r.adiantamentos!.termos[0];
    expect(t).toMatchObject({ nome: 'Termo (teste)', adiantado: 1500, ressarcido: 1200, emAberto: 300, maisAntigoMes: '2025-03', atencao: true });
    expect(t.dias).toBe(275);
    expect(r.adiantamentos).toMatchObject({ totalEmAberto: 300, termosEmAberto: 1, maisAntigoDias: 275 });
    await gravar([rec(5, 400, { fonte: ids.termo, natureza: 'ressarcimento' })]);
    const depois = (await lerRecursosLivres(p, await como('financeiro@exemplo.local'), { ano: 2025 }, HOJE)).adiantamentos!.termos[0];
    expect(depois).toMatchObject({ emAberto: -100, ressarcidoAMais: true, dias: null, atencao: false });
  });

  it('R5: acumula de todos os anos (adiantou em dezembro, ressarciu em março) e marca "termo não informado"', async () => {
    await gravar([
      desp(12, 800, { ano: 2024, natureza: 'adiantamento_termo', termo: ids.termo } as never),
      rec(3, 800, { fonte: ids.termo, natureza: 'ressarcimento' }),
      desp(2, 60, { natureza: 'adiantamento_termo' }),
    ]);
    const t = (await lerRecursosLivres(p, await como('financeiro@exemplo.local'), { ano: 2025 }, HOJE)).adiantamentos!.termos;
    expect(t.find((x) => x.termoId === ids.termo)).toMatchObject({ emAberto: 0, maisAntigoMes: null });
    expect(t.at(-1)).toMatchObject({ termoId: null, emAberto: 60 });
    expect(t.at(-1)?.nome).toContain('Termo não informado');
  });

  it('R6: compara só os meses informados nos dois anos; os não recorrentes saem da versão "sem"', async () => {
    await gravar([
      desp(1, 100, { ano: 2024 } as never), desp(2, 100, { ano: 2024 } as never), desp(2, 900, { ano: 2024, nr: true } as never),
      rec(1, 1000, { ano: 2024 } as never), rec(2, 1000, { ano: 2024 } as never),
      desp(2, 150), desp(3, 9999),
      rec(2, 2000),
    ]);
    // 2024 informou jan e fev; 2025 informou só fev e mar: o único comum é fevereiro.
    const c = (await lerRecursosLivres(p, await como('financeiro@exemplo.local'), { ano: 2025 }, HOJE)).comparacao!;
    expect(c.mesesComparados).toEqual([2]);
    expect(c.mesesFora).toEqual([1, 3]);
    expect(c.todos).toEqual({ receitaAtual: 2000, receitaAnterior: 1000, despesaAtual: 150, despesaAnterior: 1000 });
    expect(c.semNaoRecorrentes.despesaAnterior).toBe(100);
    expect(c.variacaoDespesa).toEqual({ todos: -85, sem: 50 });
    expect(c.parcial).toBe(true);
    expect(c.semAnoAnterior).toBe(false);
    expect(c.naoRecorrentes).toHaveLength(1);
  });

  it('R6: ano anterior sem nenhum mês informado', async () => {
    await gravar([desp(1, 100)]);
    const c = (await lerRecursosLivres(p, await como('financeiro@exemplo.local'), { ano: 2025 }, HOJE)).comparacao!;
    expect(c.semAnoAnterior).toBe(true);
    expect(c.mesesComparados).toEqual([]);
  });

  it('R8: Coordenação vê só a despesa livre do seu serviço, sem receita nem adiantamentos; Leitura não acessa', async () => {
    await gravar([desp(1, 100, { servico: 'escola' }), desp(1, 40, { servico: 'ur' }), rec(1, 900), desp(1, 5, { servico: 'ur', natureza: 'adiantamento_termo', termo: ids.termo })]);
    const r = await lerRecursosLivres(p, await como('coord.ur@exemplo.local'), { ano: 2025 }, HOJE);
    expect(r.despesaLivre).toBe(45);
    expect(r.receitaLivre).toBeNull();
    expect(r.resultado).toBeNull();
    expect(r.adiantamentos).toBeNull();
    expect(r.porServico).toHaveLength(1);
    expect(r.comparacao?.todos.receitaAtual).toBeNull();
    expect(r.comparacao?.variacaoReceita).toBeNull();
    await expect(lerRecursosLivres(p, await como('leitura@exemplo.local'), { ano: 2025 })).rejects.toBeInstanceOf(ErroPermissao);
  });
});

describe('termo adiantado na grade (coluna fonte_termo_id)', () => {
  const mesRecente = () => {
    const d = new Date(Date.now() - 3 * 3600_000);
    d.setUTCMonth(d.getUTCMonth() - 1);
    return d.toISOString().slice(0, 7);
  };
  const adiant = (extra = {}) => ({ tipo: 'despesa' as const, servico: 'escola', grupoId: ids.g, fonteId: ids.livre, natureza: 'adiantamento_termo' as const, valor: 100, ...extra });

  it('adiantamento novo exige o termo; grava e altera o termo com auditoria', async () => {
    const f = await como('financeiro@exemplo.local');
    await expect(salvarRealizadoDoMes(p, f, mesRecente(), [adiant()])).rejects.toBeInstanceOf(ErroRealizado);
    await expect(salvarRealizadoDoMes(p, f, mesRecente(), [adiant({ termoId: 'nao-existe' })])).rejects.toBeInstanceOf(ErroRealizado);
    await salvarRealizadoDoMes(p, f, mesRecente(), [adiant({ termoId: ids.termo })]);
    const [t] = await lerTabelas(p, [Realizado] as const);
    expect(t.ativos()[0].fonte_termo_id).toBe(ids.termo);
  });

  it('dado antigo sem termo continua salvando (aparece como "termo não informado")', async () => {
    const mes = mesRecente();
    const [t] = await lerTabelas(p, [Realizado] as const);
    const [antigo] = await inserirRegistros(p, t, [{ ano: Number(mes.slice(0, 4)), mes, tipo: 'despesa', servico: 'escola', grupo_id: ids.g, fonte_id: ids.livre, natureza: 'adiantamento_termo', valor: 100, nao_recorrente: false, motivo_nao_recorrente: null, observacao: null }] as never, { email: 'teste' });
    const f = await como('financeiro@exemplo.local');
    await expect(salvarRealizadoDoMes(p, f, mes, [adiant({ valor: 120, versao: antigo.versao })])).resolves.toMatchObject({ gravados: 1 });
  });

  it('natureza que não é adiantamento ignora o termo', async () => {
    const f = await como('financeiro@exemplo.local');
    await salvarRealizadoDoMes(p, f, mesRecente(), [adiant({ natureza: 'custeio', termoId: ids.termo })]);
    const [t] = await lerTabelas(p, [Realizado] as const);
    expect(t.ativos()[0].fonte_termo_id ?? null).toBeNull();
  });
});

describe('demonstração', () => {
  it('o realizado fictício alimenta o painel, a comparação e um adiantamento em aberto; a Coordenação vê só o seu serviço', async () => {
    const { popularPrevisaoFicticia, popularRealizadoFicticio } = await import('../dados/ficticios');
    await popularPrevisaoFicticia(p);
    await popularRealizadoFicticio(p);
    const f = await como('financeiro@exemplo.local');
    const painel = await lerPainelExecucao(p, f, { ano: 2025 }, HOJE);
    expect(painel.despesa.previsto).toBeGreaterThan(0);
    expect(painel.despesa.execucao).not.toBeNull();
    expect(painel.porServico.length).toBeGreaterThan(3);
    const livres = await lerRecursosLivres(p, f, { ano: 2026 }, '2026-12-31');
    expect(livres.comparacao?.semAnoAnterior).toBe(false);
    expect(livres.adiantamentos?.termosEmAberto).toBe(1);
    const ur = await lerPainelExecucao(p, await como('coord.ur@exemplo.local'), { ano: 2025 }, HOJE);
    expect(ur.linhas.length).toBeGreaterThan(0);
    expect(new Set(ur.linhas.map((l) => l.servico)).size).toBe(1);
  });
});
