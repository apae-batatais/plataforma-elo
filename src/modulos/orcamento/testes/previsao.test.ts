/**
 * Previsão (Entrega 1B.1) com dados FICTÍCIOS: cadastros de grupos e fontes,
 * exercício, despesas e receitas, RH da folha, painel e permissões.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { atualizar, lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { resumoFolha } from '../aplicacao/folha';
import {
  abrirExercicio, arvoreMensal, cancelarItem, definirFonteDaFolha, excluirFonte, excluirGrupo, lerPrevisao, listarCadastros,
  reativarGrupo, salvarDespesa, salvarFonte, salvarGrupo, salvarReceita, type DadosDespesa,
} from '../aplicacao/previsao';
import { popularFolhaFicticia, popularPrevisaoFicticia } from '../dados/ficticios';
import { Despesas, Exercicios, GruposGasto, TABELAS_ORCAMENTO } from '../dados/tabelas';
import { calcularIndicadores, distribuir, valorDoItem } from '../dominio/previsao';
import { manifesto } from '../manifesto';

let p: Planilhas;

async function como(email: string) {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
}
const fin = () => como('financeiro@exemplo.local');

beforeEach(async () => {
  p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'orcamento', 'orcamento_folha']), idDe: (c) => c };
  await prepararEstrutura(p, {
    tabelas: [...TABELAS_ORCAMENTO] as never,
    perfis: manifesto.perfis,
    permissoes: Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao }))),
  });
  await popularDadosFicticios(p);
});

describe('regras puras', () => {
  it('valor do item e distribuição que sempre fecha', () => {
    expect(valorDoItem(60, 200, 7.5)).toBe(90000);
    const igual = distribuir(1000, 'igual');
    expect(igual.slice(0, 11).every((v) => v === 83.33)).toBe(true);
    expect(igual[11]).toBe(83.37);
    expect(Math.round(igual.reduce((s, v) => s + v, 0) * 100)).toBe(100000);
    expect(distribuir(100, 'meses', { meses: [8, 2, 8] })).toEqual([0, 50, 0, 0, 0, 0, 0, 50, 0, 0, 0, 0]);
    expect(() => distribuir(100, 'meses', { meses: [] })).toThrow(/pelo menos um mês/);
    expect(distribuir(30, 'manual', { manual: [10, 20] })).toEqual([10, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(() => distribuir(30, 'manual', { manual: [10, 10] })).toThrow(/somam R\$\s?20,00/);
  });

  it('indicadores sobre a receita', () => {
    const i = calcularIndicadores({ despesa: 900, receita: 1000, rh: 700, receitaPublica: 800, receitaLivre: 150, receitaGarantida: 600 });
    expect(i).toEqual({ resultado: 100, folhaSobreReceita: 70, dependenciaPublica: 80, recursosLivres: 15, receitaGarantida: 60 });
    expect(calcularIndicadores({ despesa: 10, receita: 0, rh: 0, receitaPublica: 0, receitaLivre: 0, receitaGarantida: 0 }).folhaSobreReceita).toBeNull();
  });
});

describe('cadastros de grupos e fontes', () => {
  it('adicionar, alterar e nome único sem diferença de acento ou maiúscula', async () => {
    const f = await fin();
    await salvarGrupo(p, f, { nome: '  Alimentação ', rh: false });
    await expect(salvarGrupo(p, f, { nome: 'ALIMENTACAO', rh: false })).rejects.toThrow(/Já existe "Alimentação"/);
    const g = (await listarCadastros(p, f)).grupos.ativos[0];
    await salvarGrupo(p, f, { id: g.id, versao: g.versao, nome: 'Alimentação e copa', rh: false });
    expect((await listarCadastros(p, f)).grupos.ativos.map((x) => x.nome)).toEqual(['Alimentação e copa']);
    await salvarFonte(p, f, { nome: 'Projeto Incentivado', natureza: 'publica', uso: 'restrita' });
    await expect(salvarFonte(p, f, { nome: 'projeto  incentivado', natureza: 'propria', uso: 'livre' })).rejects.toThrow(/Já existe/);
    const auditoria = (await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.entidade === 'GruposGasto');
    expect(auditoria.map((a) => a.acao)).toEqual(['inclusao', 'alteracao']);
    expect(JSON.stringify(auditoria)).not.toContain('copa');
  });

  it('excluir pede que não esteja em uso; excluído fica guardado e pode ser reativado', async () => {
    const f = await fin();
    await popularFolhaFicticia(p);
    await popularPrevisaoFicticia(p);
    const c = await listarCadastros(p, f);
    const usado = c.grupos.ativos.find((g) => g.nome.startsWith('Alimentação'))!;
    expect(c.grupos.uso[usado.id]).toBe(2);
    await expect(excluirGrupo(p, f, usado.id, usado.versao)).rejects.toThrow(/2 itens do orçamento usam este grupo/);
    const fonteFolha = c.fontes.ativos.find((x) => x.nome.startsWith('Doações'))!;
    await expect(excluirFonte(p, f, fonteFolha.id, fonteFolha.versao)).rejects.toThrow(/usam esta fonte/);

    await salvarGrupo(p, f, { nome: 'Eventos', rh: false });
    const livre = (await listarCadastros(p, f)).grupos.ativos.find((g) => g.nome === 'Eventos')!;
    await excluirGrupo(p, f, livre.id, livre.versao);
    const depois = await listarCadastros(p, f);
    expect(depois.grupos.ativos.some((g) => g.nome === 'Eventos')).toBe(false);
    expect(depois.grupos.excluidos.map((g) => g.nome)).toEqual(['Eventos']);
    await expect(salvarGrupo(p, f, { nome: 'eventos', rh: false })).rejects.toThrow(/excluídos. Reative/);
    await reativarGrupo(p, f, livre.id, depois.grupos.excluidos[0].versao);
    expect((await lerTabela(p, GruposGasto)).todos().find((g) => g.id === livre.id)?.ativo).toBe(true);
  });
});

describe('despesas e receitas', () => {
  async function prepararBasico() {
    const f = await fin();
    await salvarGrupo(p, f, { nome: 'Material', rh: false });
    await salvarFonte(p, f, { nome: 'Subvenção', natureza: 'publica', uso: 'restrita' });
    const c = await listarCadastros(p, f);
    return { f, grupo: c.grupos.ativos[0].id, fonte: c.fontes.ativos[0].id };
  }
  const despesa = (grupo: string, fonte: string | null): DadosDespesa => ({
    ano: 2027, servico: 'escola', grupo_id: grupo, fonte_id: fonte, descricao: 'Papel sulfite',
    quantidade: 10, ocorrencias: 3, valor_unitario: 33.33, distribuicao: 'meses', meses: [2, 6, 9],
  });

  it('só lança com o exercício aberto; o app calcula o valor e os meses', async () => {
    const { f, grupo, fonte } = await prepararBasico();
    await expect(salvarDespesa(p, f, despesa(grupo, fonte))).rejects.toThrow(/Abra o exercício 2027/);
    await abrirExercicio(p, f, 2027);
    await expect(abrirExercicio(p, f, 2027)).rejects.toThrow(/já está aberto/);
    const id = await salvarDespesa(p, f, despesa(grupo, null));
    const d = (await lerTabela(p, Despesas)).porId(id)!;
    expect([d.m2, d.m6, d.m9, d.m1]).toEqual([333.3, 333.3, 333.3, 0]);
    const prev = await lerPrevisao(p, f, 2027);
    expect(prev.despesas[0]).toMatchObject({ valor: 999.9, fonteNome: 'A definir', areaNome: 'Educação' });
    expect(prev.totais.aDefinir.itens).toBeGreaterThanOrEqual(1);

    await salvarDespesa(p, f, { ...despesa(grupo, fonte), quantidade: 20 }, { id, versao: d.versao });
    expect((await lerPrevisao(p, f, 2027)).despesas[0]).toMatchObject({ valor: 1999.8, fonte_id: fonte });
    const v = (await lerTabela(p, Despesas)).porId(id)!.versao;
    await cancelarItem(p, f, 'despesa', id, v);
    expect((await lerPrevisao(p, f, 2027)).despesas).toHaveLength(0);
    expect((await lerTabela(p, Despesas)).todos()).toHaveLength(1); // nada é apagado
  });

  it('recusa distribuição que não fecha, serviço inexistente e exercício aprovado', async () => {
    const { f, grupo, fonte } = await prepararBasico();
    await abrirExercicio(p, f, 2027);
    await expect(salvarDespesa(p, f, { ...despesa(grupo, fonte), distribuicao: 'manual', manual: [100] })).rejects.toThrow(/somam/);
    await expect(salvarDespesa(p, f, { ...despesa(grupo, fonte), servico: 'nao_existe' })).rejects.toThrow(/serviço/);
    await expect(salvarReceita(p, f, { ano: 2027, fonte_id: fonte, descricao: 'Termo', valor: 1200, captacao: 'garantida', distribuicao: 'igual' })).resolves.toBeTruthy();
    const e = (await lerTabela(p, Exercicios)).ativos()[0];
    await atualizar(p, Exercicios, e.id, e.versao, { situacao: 'aprovado' }, { email: 'teste' });
    await expect(salvarDespesa(p, f, despesa(grupo, fonte))).rejects.toThrow(/já foi aprovado/);
  });
});

describe('painel da previsão', () => {
  beforeEach(async () => {
    await popularFolhaFicticia(p);
    await popularPrevisaoFicticia(p);
  });

  it('despesa = itens + folha automática (o mesmo total do Resumo da folha), com RH e indicadores', async () => {
    const f = await fin();
    const prev = await lerPrevisao(p, f);
    const folha = await resumoFolha(p, f);
    expect(prev.ano).toBe(2027);
    expect(prev.folha?.anual).toBe(folha.total.anual);
    const itens = prev.despesas.reduce((s, d) => s + d.valor, 0);
    expect(prev.totais.despesa.anual).toBeCloseTo(itens + folha.total.anual, 1);
    const rhItens = prev.despesas.filter((d) => d.rh).reduce((s, d) => s + d.valor, 0);
    expect(prev.totais.rh).toBeCloseTo(folha.total.anual + rhItens, 1);
    expect(prev.totais.receita.anual).toBe(4248000);
    expect(prev.indicadores.dependenciaPublica).toBeCloseTo(((980000 + 420000 + 1350000 + 610000 + 300000) / 4248000) * 100, 1);
    expect(prev.indicadores.resultado).toBeCloseTo(prev.totais.receita.anual - prev.totais.despesa.anual, 1);
    expect(prev.totais.porCaptacao.garantida).toBe(980000 + 1350000 + 610000 + 96000);
    // Cada área aparece uma vez (itens e folha somados).
    const nomesAreas = prev.totais.porArea.map((a) => a.nome);
    expect(new Set(nomesAreas).size).toBe(nomesAreas.length);
    // Serviços sem fonte da folha escolhida e itens sem fonte ficam "a definir".
    expect(prev.totais.despesaPorFonte.some((g) => g.nome === 'A definir')).toBe(true);
  });

  it('a fonte da folha de um serviço muda com uma linha nova', async () => {
    const f = await fin();
    const antes = await lerPrevisao(p, f);
    const linha = antes.folha!.linhas.find((l) => l.servico === 'rural_viveiro')!;
    expect(linha.fonteNome).toBe('A definir');
    const vendas = antes.opcoes.fontes.find((x) => x.nome.startsWith('Vendas'))!;
    await definirFonteDaFolha(p, f, 2027, 'rural_viveiro', vendas.id);
    expect((await lerPrevisao(p, f)).folha!.linhas.find((l) => l.servico === 'rural_viveiro')!.fonteNome).toBe(vendas.nome);
  });

  it('quem vê e quem altera', async () => {
    const leitura = await como('leitura@exemplo.local');
    const prev = await lerPrevisao(p, leitura);
    expect(prev.podeEditar).toBe(false);
    expect(prev.despesas.length).toBeGreaterThan(0);
    const diretoria = await como('diretoria@exemplo.local');
    expect((await lerPrevisao(p, diretoria)).podeEditar).toBe(false);
    await expect(salvarGrupo(p, leitura, { nome: 'X', rh: false })).rejects.toBeInstanceOf(ErroPermissao);
    await expect(salvarGrupo(p, diretoria, { nome: 'X', rh: false })).rejects.toBeInstanceOf(ErroPermissao);
    await expect(lerPrevisao(p, await como('dp@exemplo.local'))).rejects.toBeInstanceOf(ErroPermissao);
    await expect(lerPrevisao(p, await como('coord.ur@exemplo.local'))).rejects.toBeInstanceOf(ErroPermissao);
    expect((await lerPrevisao(p, await fin())).podeEditar).toBe(true);
  });
});

describe('árvore mês a mês', () => {
  beforeEach(async () => {
    await popularFolhaFicticia(p);
    await popularPrevisaoFicticia(p);
  });

  it('Receita › fonte › item e Despesa › grupo › item, com os mesmos totais do painel', async () => {
    const prev = await lerPrevisao(p, await fin());
    const { receita, despesa } = arvoreMensal(prev);
    expect(receita.anual).toBeCloseTo(prev.totais.receita.anual, 1);
    expect(despesa.anual).toBeCloseTo(prev.totais.despesa.anual, 1);
    receita.mensal.forEach((v, i) => expect(v).toBeCloseTo(prev.totais.receita.mensal[i], 1));
    // Cada nível soma os filhos
    for (const raiz of [receita, despesa]) {
      for (const g of raiz.filhos!) expect(g.anual).toBeCloseTo(g.filhos!.reduce((s, f) => s + f.anual, 0), 1);
    }
    const folha = despesa.filhos!.find((g) => g.id === 'd:__folha__')!;
    expect(folha.anual).toBe(prev.folha!.anual);
    expect(folha.filhos!.length).toBe(prev.folha!.linhas.length);
    const leilao = receita.filhos!.find((f) => f.nome.startsWith('Leilão'))!;
    expect(leilao.filhos![0]).toMatchObject({ nome: 'Leilão 2027 (exemplo)', detalhe: 'Em negociação' });
    expect(leilao.mensal[7]).toBe(420000);
  });
});
