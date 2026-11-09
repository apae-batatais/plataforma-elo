/**
 * Histórico (Entrega 1E): leitura da planilha, conferência do total, indicadores,
 * importação e quem vê e quem altera. Só dados FICTÍCIOS.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { inserirRegistros, lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import {
  analisarHistorico, desfazerImportacaoHistorico, descreverArquivoHistorico, ErroHistorico, importarHistorico, lerHistorico, type ImportacaoHistorico,
} from '../aplicacao/historico';
import { Fontes, Historico, PLANILHA_EXECUCAO, TABELAS_ORCAMENTO } from '../dados/tabelas';
import {
  anoAtualBrasilia, calcularIndicadores, conferirTotal, fontesPorAno, lerReceitasHistorico, mapeamentoSugeridoHistorico, type AnoHistorico,
} from '../dominio/historico';
import type { AbaImportada } from '../dominio/importacao';
import { manifesto } from '../manifesto';

let p: Planilhas;
const autor = { email: 'teste' };

async function como(email: string) {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
}
const fin = () => como('financeiro@exemplo.local');
const ANO = anoAtualBrasilia() - 1;

const aba: AbaImportada = {
  nome: 'Previsão 2024',
  linhas: [
    ['Previsão Fictícia — orçado × realizado'],
    ['Receita', 'Orçado', 'Realizado'],
    ['Convênio Fictício A', 1000, 1200.5],
    ['Emenda Fictícia / Venda de bens', 500, '300,25'],
    ['Subtotal públicas', 1500, 1500.75],
    [null, null, null],
    ['Doações Fictícias', 100, 99.25],
    ['Total das receitas', 1600, 1600],
  ],
};

beforeEach(async () => {
  p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha', PLANILHA_EXECUCAO]), idDe: (c) => c };
  await prepararEstrutura(p, {
    tabelas: [...TABELAS_ORCAMENTO] as never,
    perfis: manifesto.perfis,
    permissoes: Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao }))),
  });
  await popularDadosFicticios(p);
  const [fontes] = await lerTabelas(p, [Fontes] as const);
  await inserirRegistros(
    p,
    fontes,
    [
      { nome: 'Convênio Fictício A', natureza: 'publica', uso: 'restrita' },
      { nome: 'Emendas e outras', natureza: 'publica', uso: 'livre' },
      { nome: 'Doações Fictícias', natureza: 'propria', uso: 'livre' },
    ],
    autor,
  );
});

const fonteId = async (nome: string) => (await lerTabela(p, Fontes)).ativos().find((f) => f.nome === nome)!.id;

async function proposta(extra: Partial<ImportacaoHistorico> = {}): Promise<ImportacaoHistorico> {
  const a = await fonteId('Convênio Fictício A');
  const e = await fonteId('Emendas e outras');
  const d = await fonteId('Doações Fictícias');
  return {
    ano: ANO,
    totalPlanilha: 1600,
    despesaTotal: 1400,
    folha: 800,
    saldoLivreInicial: 200,
    linhas: [
      { linha: 3, descricao: 'Convênio Fictício A', valor: 1200.5, fonteId: a, observacao: null },
      { linha: 4, descricao: 'Emenda Fictícia / Venda de bens', valor: 300.25, fonteId: e, observacao: 'Mistura emenda e venda de bens' },
      { linha: 7, descricao: 'Doações Fictícias', valor: 99.25, fonteId: d, observacao: null },
    ],
    ...extra,
  };
}

describe('leitura da planilha', () => {
  it('sugere aba, cabeçalho e colunas pelos títulos', () => {
    const m = mapeamentoSugeridoHistorico([aba])!;
    expect(m).toEqual({ aba: 'Previsão 2024', cabecalho: 2, colunas: { descricao: 0, valor: 2 } });
  });

  it('lê as receitas, pula subtotal e acha o total da planilha', () => {
    const l = lerReceitasHistorico([aba], mapeamentoSugeridoHistorico([aba])!);
    expect(l.linhas.map((x) => [x.linha, x.valor])).toEqual([[3, 1200.5], [4, 300.25], [7, 99.25]]);
    expect(l.totalPlanilha).toBe(1600);
    expect(l.problemas).toEqual([]);
  });

  it('aponta valor negativo e valor que não é número', () => {
    const l = lerReceitasHistorico(
      [{ nome: 'x', linhas: [['Receita', 'Realizado'], ['A', -5], ['B', 'abc'], ['C', 10]] }],
      { aba: 'x', cabecalho: 1, colunas: { descricao: 0, valor: 1 } },
    );
    expect(l.linhas).toHaveLength(1);
    expect(l.problemas.map((x) => x.problema)).toEqual(['Valor negativo.', 'Valor não reconhecido.']);
  });
});

describe('conferência do total (regra 24)', () => {
  it('bate em centavos', () => expect(conferirTotal([{ valor: 0.1 }, { valor: 0.2 }], 0.3)).toBe(''));
  it('mostra a diferença', () => expect(conferirTotal([{ valor: 10 }], 10.01)).toMatch(/diferença de R\$\s0,01/));
  it('exige o total', () => expect(conferirTotal([{ valor: 10 }], null)).toMatch(/Informe/));
});

describe('indicadores', () => {
  const ano = (a: number, receita: number, despesa: number, folha: number, saldo: number | null, propria = 0): AnoHistorico => ({
    ano: a, receita, despesa, folha, saldoLivreInicial: saldo,
    porFonte: [
      { fonteId: 'p', nome: 'Pública', natureza: 'publica', valor: receita - propria },
      ...(propria ? [{ fonteId: 'q', nome: 'Própria', natureza: 'propria' as const, valor: propria }] : []),
    ],
  });

  it('calcula resultado, margem, folha, crescimento, saldo e cobertura', () => {
    const i = calcularIndicadores([ano(2023, 1000, 900, 500, 100, 200), ano(2024, 1100, 1000, 600, 150, 330), ano(2025, 1200, 1100, 660, 120)], 2026);
    const a24 = i[1];
    expect(a24).toMatchObject({ resultado: 100, margem: 9.1, folhaSobreReceita: 54.5, crescimentoReceita: 10, crescimentoFolha: 20, saldoLivreFim: 120, variacaoSaldoLivre: -30, pesoRecursosProprios: 30 });
    expect(a24.coberturaSaldoLivre).toBe(1.4);
    expect(i[0].crescimentoReceita).toBeNull();
    expect(i[2].saldoLivreFim).toBeNull();
  });

  it('ano em andamento é parcial e não entra no crescimento (regra 26)', () => {
    const i = calcularIndicadores([ano(2025, 1000, 900, 500, null), ano(2026, 400, 300, 200, null)], 2026);
    expect(i[1].parcial).toBe(true);
    expect(i[1].crescimentoReceita).toBeNull();
    expect(i[0].parcial).toBe(false);
  });

  it('sem ano anterior ou sem base, não calcula crescimento', () => {
    const i = calcularIndicadores([ano(2020, 1000, 900, 500, null), ano(2022, 1100, 900, 500, null)], 2026);
    expect(i[1].crescimentoReceita).toBeNull();
  });

  it('fontes: peso e variação no último ano completo', () => {
    const f = fontesPorAno([ano(2024, 1000, 0, 0, null, 200), ano(2025, 1000, 0, 0, null, 400), ano(2026, 100, 0, 0, null)], 2026);
    expect(f.ultimoCompleto).toBe(2025);
    const propria = f.linhas.find((l) => l.fonteId === 'q')!;
    expect(propria).toMatchObject({ peso: 40, variacao: 100 });
    expect(f.publicaPropria[1]).toEqual({ ano: 2025, publica: 600, propria: 400 });
  });
});

describe('importar ano fechado', () => {
  it('Financeiro analisa, importa e o histórico aparece com os indicadores', async () => {
    const q = await fin();
    const m = descreverArquivoHistorico(q, [aba]).sugestao!;
    const analise = await analisarHistorico(p, q, [aba], m);
    expect(analise.totalPlanilha).toBe(1600);
    expect(analise.linhas.find((l) => l.descricao === 'Doações Fictícias')!.fonteId).toBeTruthy();
    expect(analise.linhas.find((l) => l.linha === 4)!.fonteId).toBeNull();

    expect(await importarHistorico(p, q, await proposta())).toEqual({ linhas: 3, substituido: false });
    const h = await lerHistorico(p, q);
    expect(h.anos).toHaveLength(1);
    expect(h.anos[0]).toMatchObject({ ano: ANO, receita: 1600, despesa: 1400, folha: 800 });
    expect(h.indicadores[0]).toMatchObject({ resultado: 200, pesoRecursosProprios: 6.2 });
  });

  it('não grava quando o total não bate, e diz a diferença', async () => {
    const q = await fin();
    await expect(importarHistorico(p, q, await proposta({ totalPlanilha: 1600.01 }))).rejects.toThrow(/diferença de R\$\s0,01/);
    expect((await lerTabela(p, Historico)).ativos()).toHaveLength(0);
  });

  it('exige fonte em todas as linhas, ano fechado e folha dentro da despesa', async () => {
    const q = await fin();
    const base = await proposta();
    await expect(importarHistorico(p, q, { ...base, linhas: base.linhas.map((l, i) => (i === 1 ? { ...l, fonteId: null } : l)) })).rejects.toThrow(/Escolha a fonte/);
    await expect(importarHistorico(p, q, { ...base, ano: anoAtualBrasilia() })).rejects.toThrow(/ano fechado/);
    await expect(importarHistorico(p, q, { ...base, ano: 2016 })).rejects.toThrow(/ano fechado/);
    await expect(importarHistorico(p, q, { ...base, folha: 1500 })).rejects.toThrow(/folha/);
    await expect(importarHistorico(p, q, { ...base, linhas: base.linhas.map((l) => ({ ...l, fonteId: 'inexistente' })) })).rejects.toThrow(/não existe mais/);
    await expect(importarHistorico(p, q, { lixo: true })).rejects.toBeInstanceOf(ErroHistorico);
  });

  it('reimportar substitui: as linhas antigas ficam no histórico com ativo = FALSE', async () => {
    const q = await fin();
    await importarHistorico(p, q, await proposta());
    const base = await proposta();
    const r = await importarHistorico(p, q, { ...base, totalPlanilha: 1200.5, linhas: [base.linhas[0]] });
    expect(r.substituido).toBe(true);
    const t = await lerTabela(p, Historico);
    expect(t.ativos()).toHaveLength(1);
    expect(t.todos()).toHaveLength(4);
    expect((await lerHistorico(p, q)).anos[0].receita).toBe(1200.5);
  });

  it('desfazer cancela o ano sem apagar', async () => {
    const q = await fin();
    await importarHistorico(p, q, await proposta());
    expect(await desfazerImportacaoHistorico(p, q, ANO)).toEqual({ linhas: 3 });
    expect((await lerHistorico(p, q)).anos).toHaveLength(0);
    expect((await lerTabela(p, Historico)).todos()).toHaveLength(3);
    await expect(desfazerImportacaoHistorico(p, q, ANO)).rejects.toThrow(/não tem importação/);
  });

  it('audita sem valores: só colunas e contagens', async () => {
    const q = await fin();
    await importarHistorico(p, q, await proposta());
    const log = (await lerTabela(p, RegistrosAuditoria)).todos().filter((r) => r.entidade === 'ImportacaoHistorico');
    expect(log.length).toBeGreaterThan(0);
    expect(JSON.stringify(log)).not.toMatch(/1200|Convênio/);
  });
});

describe('quem vê e quem altera', () => {
  it('Diretoria e Leitura veem, mas não importam', async () => {
    for (const email of ['diretoria@exemplo.local', 'leitura@exemplo.local']) {
      const q = await como(email);
      expect(q.temPermissao('orcamento.historico.ver')).toBe(true);
      expect((await lerHistorico(p, q)).anos).toEqual([]);
      expect(() => descreverArquivoHistorico(q, [aba])).toThrow(ErroPermissao);
      await expect(importarHistorico(p, q, await proposta())).rejects.toBeInstanceOf(ErroPermissao);
      await expect(desfazerImportacaoHistorico(p, q, ANO)).rejects.toBeInstanceOf(ErroPermissao);
    }
  });

  it.each(['coord.ur@exemplo.local', 'compras@exemplo.local', 'dp@exemplo.local'])('%s não vê nem importa', async (email) => {
    const q = await como(email);
    expect(q.temPermissao('orcamento.historico.ver')).toBe(false);
    await expect(lerHistorico(p, q)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(analisarHistorico(p, q, [aba], { aba: aba.nome, cabecalho: 2, colunas: { descricao: 0, valor: 2 } })).rejects.toBeInstanceOf(ErroPermissao);
    await expect(importarHistorico(p, q, await proposta())).rejects.toBeInstanceOf(ErroPermissao);
  });

  it('só o Financeiro edita', async () => {
    expect((await fin()).temPermissao('orcamento.historico.editar')).toBe(true);
  });

  it('o menu do histórico exige a permissão certa', () => {
    const itens = manifesto.menu.filter((i) => i.secao === 'Histórico');
    expect(itens.map((i) => i.permissao)).toEqual(['orcamento.historico.ver', 'orcamento.historico.ver', 'orcamento.historico.editar']);
  });
});

describe('demonstração', () => {
  it('os dados fictícios geram indicadores sem erro', async () => {
    const { popularHistoricoFicticia, popularPrevisaoFicticia } = await import('../dados/ficticios');
    await popularPrevisaoFicticia(p);
    await popularHistoricoFicticia(p);
    const h = await lerHistorico(p, await fin());
    expect(h.anos).toHaveLength(4);
    expect(h.indicadores.at(-1)!.crescimentoReceita).toBeGreaterThan(0);
    expect(h.indicadores[0].saldoLivreFim).not.toBeNull();
  });
});
