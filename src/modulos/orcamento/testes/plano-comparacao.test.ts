/**
 * Plano de contas, entrega 3 da #221, com dados FICTÍCIOS: comparar exercícios e divergência de área
 * (escopo antes de somar, sem área do plano, quem vê o quê).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { compararExercicios, lerDivergencias } from '../aplicacao/plano-comparacao';
import { popularPlanoContasFicticio, popularPrevisaoFicticia } from '../dados/ficticios';
import { Despesas, TABELAS_ORCAMENTO } from '../dados/tabelas';
import { compararPlanos, divergenciasDeArea } from '../dominio/plano-contas';
import { manifesto } from '../manifesto';

let p: Planilhas;

async function como(email: string) {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
}

beforeEach(async () => {
  p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha', 'orcamento_execucao']), idDe: (c) => c };
  await prepararEstrutura(p, {
    tabelas: [...TABELAS_ORCAMENTO] as never,
    perfis: manifesto.perfis,
    permissoes: Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao }))),
  });
  await popularDadosFicticios(p);
  await popularPrevisaoFicticia(p);
  await popularPlanoContasFicticio(p);
});

const L = (area_id: string, grupo_id: string, item_id: string | null = null) => ({ area_id, grupo_id, item_id });

describe('comparar planos (regras puras)', () => {
  it('lista o que entrou, o que saiu e o que mudou de grupo', () => {
    const antes = [L('A', 'G1', 'I1'), L('A', 'G1', 'I2'), L('B', 'G2'), L('C', 'G1', 'I3')];
    const depois = [L('A', 'G1', 'I1'), L('A', 'G3', 'I2'), L('B', 'G2'), L('B', 'G4', 'I9'), L('D', 'G1')];
    const r = compararPlanos(antes, depois);
    expect(r.iguais).toBe(false);
    expect(r.areasEntraram).toEqual(['D']);
    expect(r.areasSairam).toEqual(['C']);
    expect(r.mudaramDeGrupo).toEqual([{ area_id: 'A', item_id: 'I2', de_grupo_id: 'G1', para_grupo_id: 'G3' }]);
    expect(r.itensEntraram.map((i) => i.item_id)).toEqual(['I9']);
    expect(r.itensSairam.map((i) => i.item_id)).toEqual(['I3']);
    expect(r.gruposEntraram).toContainEqual({ area_id: 'B', grupo_id: 'G4' });
  });

  it('planos iguais, em qualquer ordem', () => {
    expect(compararPlanos([L('A', 'G', 'I'), L('B', 'G')], [L('B', 'G'), L('A', 'G', 'I')]).iguais).toBe(true);
  });
});

describe('divergência de área (regras puras)', () => {
  const areaDe = (s: string | null) => ({ a: 'x', b: 'y' } as Record<string, string>)[s ?? ''] ?? null;
  const coincide = (ap: string, as: string) => ap === as;
  it('soma em centavos por par; sem área do plano nunca é divergência nem zero; serviço sem área é ignorado', () => {
    const r = divergenciasDeArea(
      [
        { origem: 'despesa', id: '1', servico: 'a', area_plano_id: 'y', centavos: 10 },
        { origem: 'realizado', id: '2', servico: 'a', area_plano_id: 'y', centavos: 20 },
        { origem: 'despesa', id: '3', servico: 'a', area_plano_id: 'x', centavos: 99 },
        { origem: 'despesa', id: '4', servico: 'b', area_plano_id: null, centavos: 50 },
        { origem: 'despesa', id: '5', servico: 'sem', area_plano_id: 'x', centavos: 70 },
      ],
      areaDe,
      coincide,
    );
    expect(r.pares).toHaveLength(1);
    expect(r.pares[0]).toMatchObject({ area_plano_id: 'y', area_servico: 'x', centavos: 30 });
    expect(r.totalCentavos).toBe(30);
    expect(r.semAreaDoPlano).toBe(1);
  });
});

describe('comparar exercícios (casos de uso)', () => {
  it('a demonstração: 2027 tem entradas e saídas em relação a 2026', async () => {
    const c = await compararExercicios(p, await como('financeiro@exemplo.local'), 2026, 2027);
    expect(c.semPlano).toEqual({ antes: false, depois: false });
    expect(c.comparacao?.iguais).toBe(false);
    expect(c.comparacao?.itensEntraram.length).toBeGreaterThan(0);
    expect(c.comparacao?.itensSairam.length).toBeGreaterThan(0);
  });

  it('sem plano em um dos lados, não compara', async () => {
    const c = await compararExercicios(p, await como('financeiro@exemplo.local'), 2020, 2027);
    expect(c.semPlano).toEqual({ antes: true, depois: false });
    expect(c.comparacao).toBeNull();
  });

  it('Diretoria e Leitura leem; coordenação e quem não tem permissão não', async () => {
    for (const email of ['diretoria@exemplo.local', 'leitura@exemplo.local']) {
      expect((await compararExercicios(p, await como(email), 2026, 2027)).comparacao).not.toBeNull();
    }
    await expect(compararExercicios(p, await como('coord.ur@exemplo.local'), 2026, 2027)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(compararExercicios(p, await como('funcionario@exemplo.local'), 2026, 2027)).rejects.toBeInstanceOf(ErroPermissao);
  });
});

describe('divergências (casos de uso)', () => {
  it('Financeiro vê tudo, com as linhas; a demonstração tem divergência', async () => {
    const d = await lerDivergencias(p, await como('financeiro@exemplo.local'), 2027);
    expect(d.comLinhas).toBe(true);
    expect(d.pares.length).toBeGreaterThan(0);
    expect(d.totalCentavos).toBe(d.pares.reduce((s, x) => s + x.centavos, 0));
    expect(d.pares.every((x) => x.lancamentos.length === x.quantidade && x.areaPlanoId)).toBe(true);
  });

  it('o escopo vem antes de somar: a Coordenação soma só os seus serviços', async () => {
    const todos = await lerDivergencias(p, await como('financeiro@exemplo.local'), 2027);
    const coord = await lerDivergencias(p, await como('coord.ur@exemplo.local'), 2027);
    expect(coord.escopoParcial).toBe(true);
    const lancs = coord.pares.flatMap((x) => x.lancamentos);
    expect(lancs.every((l) => l.servico === 'ur')).toBe(true);
    expect(coord.totalCentavos).toBeLessThanOrEqual(todos.totalCentavos);
    expect(coord.totalCentavos).toBe(lancs.reduce((s, l) => s + l.centavos, 0));
  });

  it('Leitura vê só os totais, sem as linhas, iguais aos do Financeiro', async () => {
    const todos = await lerDivergencias(p, await como('financeiro@exemplo.local'), 2027);
    const l = await lerDivergencias(p, await como('leitura@exemplo.local'), 2027);
    expect(l.comLinhas).toBe(false);
    expect(l.totalCentavos).toBe(todos.totalCentavos);
    expect(l.pares.every((x) => x.lancamentos.length === 0 && x.quantidade > 0)).toBe(true);
  });

  it('sem permissão, nada; lançamento sem área do plano não é divergência', async () => {
    await expect(lerDivergencias(p, await como('funcionario@exemplo.local'), 2027)).rejects.toBeInstanceOf(ErroPermissao);
    const [desp] = await lerTabelas(p, [Despesas] as const);
    const comArea = desp.ativos().filter((x) => x.ano === 2027 && x.area_plano_id).length;
    expect(comArea).toBeGreaterThan(0);
    const vazio = await lerDivergencias(p, await como('financeiro@exemplo.local'), 2031);
    expect(vazio.pares).toEqual([]);
    expect(vazio.totalCentavos).toBe(0);
  });
});
