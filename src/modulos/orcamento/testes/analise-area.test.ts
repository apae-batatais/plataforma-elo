/**
 * Análise por área: custo direto, indireto rateado, despesa administrativa
 * rateada, bases de rateio, per capita. Dados FICTÍCIOS.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { GRUPO_FOLHA, listarCentros, painelPorArea, salvarCentro } from '../aplicacao/analise-area';
import { lerPrevisao } from '../aplicacao/previsao';
import { popularFolhaFicticia, popularPrevisaoFicticia } from '../dados/ficticios';
import { TABELAS_ORCAMENTO } from '../dados/tabelas';
import { analisarArea, pesosDeRateio, type CentroAnalise } from '../dominio/analise-area';
import { manifesto } from '../manifesto';

const centro = (codigo: string, area: string, tipo: CentroAnalise['tipo'], extra: Partial<CentroAnalise> = {}): CentroAnalise => ({
  codigo, nome: codigo, area, tipo, atendidos: null, sessoes: null, m2: null, profissionais: 0, ...extra,
});

describe('rateio (regras puras)', () => {
  const centros = [
    centro('horta', 'rural', 'direto', { profissionais: 2, atendidos: 10 }),
    centro('viveiro', 'rural', 'direto', { profissionais: 2, atendidos: 30, sessoes: 120 }),
    centro('manutencao', 'rural', 'indireto'),
    centro('escola', 'educacao', 'direto'),
    centro('financeiro', 'adm', 'despesa'),
  ];
  const custos = [
    { servico: 'horta', grupo: 'Material', valor: 1000 },
    { servico: 'viveiro', grupo: 'Material', valor: 2000 },
    { servico: 'viveiro', grupo: 'RH', valor: 1000 },
    { servico: 'manutencao', grupo: 'Serviços', valor: 1000 },
    { servico: 'escola', grupo: 'RH', valor: 5000 },
    { servico: 'financeiro', grupo: 'RH', valor: 1000 },
  ];

  it('A, B, C, D e total por centro, com base no custo direto', () => {
    const a = analisarArea({ area: 'rural', base: 'custo', centros, custos, receitas: [{ area: 'rural', restrita: true, valor: 6000 }, { area: 'rural', restrita: false, valor: 999 }] });
    // Custo da área = 4000 diretos + 1000 indireto = 5000; custo geral = 10000; despesa geral = 1000 → D da área = 500.
    expect(a.cards).toEqual({ receitaRestrita: 6000, custos: 5000, despesas: 500, gastos: 5500, resultado: 500 });
    expect(a.rateio.map((r) => [r.codigo, r.A, r.B, r.C, r.D, r.total])).toEqual([
      ['horta', 1000, 250, 1250, 125, 1375],
      ['viveiro', 3000, 750, 3750, 375, 4125],
    ]);
    expect(a.direta.linhas.map((l) => [l.grupo, l.valores, l.total])).toEqual([
      ['Material', [1000, 2000], 3000],
      ['RH', [0, 1000], 1000],
    ]);
    expect(a.indireta.total).toBe(1000);
    expect(a.totais.percentualCustoArea).toBe(0.5);
    expect(a.rateio[1].perCapitaMensal).toBe(11.46); // 4125 ÷ 30 ÷ 12
    expect(a.rateio[1].porSessao).toBe(34.38);
    expect(a.despesasAdministrativas.total).toBe(1000);
  });

  it('outras bases: profissionais e atendidos; base vazia cai no custo direto', () => {
    const p = analisarArea({ area: 'rural', base: 'profissionais', centros, custos, receitas: [] });
    expect(p.rateio.map((r) => r.B)).toEqual([500, 500]); // 2 e 2 profissionais
    expect(analisarArea({ area: 'rural', base: 'atendidos', centros, custos, receitas: [] }).rateio.map((r) => r.B)).toEqual([250, 750]);
    expect(pesosDeRateio(centros.slice(0, 2), [1000, 3000], 'm2')).toEqual({ pesos: [0.25, 0.75], usada: 'custo' });
    expect(pesosDeRateio(centros.slice(0, 2), [0, 0], 'm2').usada).toBe('igual');
  });

  it('o rateio fecha no centavo', () => {
    const tres = [centro('a', 'x', 'direto'), centro('b', 'x', 'direto'), centro('c', 'x', 'direto'), centro('i', 'x', 'indireto')];
    const a = analisarArea({
      area: 'x', base: 'custo', centros: tres, receitas: [],
      custos: [{ servico: 'a', grupo: 'G', valor: 1 }, { servico: 'b', grupo: 'G', valor: 1 }, { servico: 'c', grupo: 'G', valor: 1 }, { servico: 'i', grupo: 'G', valor: 100 }],
    });
    expect(Math.round(a.rateio.reduce((s, r) => s + r.B, 0) * 100)).toBe(10000);
  });
});

describe('centros de custo e painel por área (aplicação)', () => {
  let p: Planilhas;
  const como = async (email: string) => {
    const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
    return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
  };

  beforeEach(async () => {
    p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha']), idDe: (c) => c };
    await prepararEstrutura(p, {
      tabelas: [...TABELAS_ORCAMENTO] as never,
      perfis: manifesto.perfis,
      permissoes: Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao }))),
    });
    await popularDadosFicticios(p);
    await popularFolhaFicticia(p);
    await popularPrevisaoFicticia(p);
  });

  it('profissionais vêm da lotação; classificar um centro grava e audita', async () => {
    const fin = await como('financeiro@exemplo.local');
    const lista = await listarCentros(p, fin);
    const escola = lista.find((c) => c.codigo === 'escola')!;
    expect(escola.profissionais).toBeGreaterThan(0);
    expect(escola.tipo).toBe('direto');
    await salvarCentro(p, fin, { servico: 'escola', tipo: 'direto', atendidos: 120, sessoes: null, area_m2: 950 });
    expect((await listarCentros(p, fin)).find((c) => c.codigo === 'escola')).toMatchObject({ atendidos: 120, m2: 950 });
    await expect(salvarCentro(p, await como('leitura@exemplo.local'), { servico: 'escola', tipo: 'despesa', atendidos: null, sessoes: null, area_m2: null })).rejects.toBeInstanceOf(ErroPermissao);
  });

  it('o painel da área soma itens + folha; custos + despesas de todas as áreas = orçamento', async () => {
    const fin = await como('financeiro@exemplo.local');
    const painel = await painelPorArea(p, fin, { area: 'educacao' });
    const a = painel.analise!;
    expect(painel.area?.codigo).toBe('educacao');
    expect(a.direta.linhas.some((l) => l.grupo === GRUPO_FOLHA)).toBe(true);
    // Transporte é indireto da Educação: rateado entre os diretos.
    expect(a.indireta.colunas.map((c) => c.codigo)).toEqual(['transporte']);
    expect(a.rateio.reduce((s, r) => s + r.B, 0)).toBeCloseTo(a.indireta.total, 2);
    // Somando todas as áreas, os gastos fecham com o orçamento (exceto custo sem lotação).
    const prev = await lerPrevisao(p, fin);
    expect(a.totais.orcamento).toBeCloseTo(prev.totais.despesa.anual, 1);
    // Filtrando só projetos/capital, a folha sai.
    const proj = (await painelPorArea(p, fin, { area: 'educacao', categorias: ['projetos'] })).analise!;
    expect(proj.direta.linhas.some((l) => l.grupo === GRUPO_FOLHA)).toBe(false);
    await expect(painelPorArea(p, await como('dp@exemplo.local'), {})).rejects.toBeInstanceOf(ErroPermissao);
  });
});
