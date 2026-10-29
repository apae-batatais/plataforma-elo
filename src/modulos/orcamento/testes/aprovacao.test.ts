/**
 * Entrega 1B.2 com dados FICTÍCIOS: propostas das coordenações, aprovação do
 * exercício, remanejamentos e suplementações — e quem pode fazer cada coisa.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { atualizar, lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import {
  aprovarExercicio, decidirAjuste, decidirProposta, encerrarExercicio, listarAjustes, listarPropostas, pendenciasDoExercicio,
  proporDespesa, retirarProposta, solicitarAjuste,
} from '../aplicacao/aprovacao';
import { definirFonteDaFolha, lerPrevisao, salvarDespesa, type DadosDespesa } from '../aplicacao/previsao';
import { popularFolhaFicticia, popularPrevisaoFicticia } from '../dados/ficticios';
import { Despesas, TABELAS_ORCAMENTO } from '../dados/tabelas';
import { manifesto } from '../manifesto';

let p: Planilhas;
const como = async (email: string) => {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
};
const fin = () => como('financeiro@exemplo.local');
const dir = () => como('diretoria@exemplo.local');
const coordUr = () => como('coord.ur@exemplo.local');

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

async function proposta(servico = 'ur'): Promise<DadosDespesa> {
  const prev = await lerPrevisao(p, await fin());
  return {
    ano: 2027, servico, grupo_id: prev.opcoes.grupos[0].id, fonte_id: null, descricao: 'Jogos pedagógicos (proposta)',
    quantidade: 4, ocorrencias: 1, valor_unitario: 250, distribuicao: 'meses', meses: [3],
  };
}

/** Recusa as propostas fictícias pendentes da demonstração. */
async function decidirPendentes() {
  for (const d of (await lerTabela(p, Despesas)).ativos().filter((x) => x.situacao === 'proposta')) {
    await decidirProposta(p, await fin(), d.id, d.versao, 'recusar', 'teste');
  }
}

/** Deixa o exercício 2027 sem pendências de fonte (itens e folha). */
async function escolherTodasAsFontes() {
  const f = await fin();
  const prev = await lerPrevisao(p, f);
  const fonte = prev.opcoes.fontes[0].id;
  const despesas = await lerTabela(p, Despesas);
  for (const d of despesas.ativos().filter((x) => x.ano === 2027 && !x.fonte_id)) await atualizar(p, Despesas, d.id, d.versao, { fonte_id: fonte }, { email: 'teste' });
  for (const l of prev.folha!.linhas.filter((x) => !x.fonte_id)) await definirFonteDaFolha(p, f, 2027, l.servico, fonte);
}

describe('propostas das coordenações', () => {
  it('a coordenação propõe só no seu escopo; a proposta não entra no orçamento até o Financeiro aceitar', async () => {
    await decidirPendentes();
    const coord = await coordUr();
    await expect(proporDespesa(p, coord, await proposta('escola'))).rejects.toBeInstanceOf(ErroPermissao);
    const id = await proporDespesa(p, coord, await proposta());
    const antes = await lerPrevisao(p, await fin());
    expect(antes.despesas.some((d) => d.id === id)).toBe(false);
    expect(antes.propostasPendentes).toBe(1);

    const vistaCoord = await listarPropostas(p, coord);
    expect(vistaCoord.opcoes.servicos.map((s) => s.codigo)).toEqual(['ur']);
    expect(vistaCoord.lista.find((x) => x.id === id)).toMatchObject({ situacao: 'proposta', podeAlterar: true });
    expect(vistaCoord.lista.every((x) => x.servico === 'ur')).toBe(true);
    expect(vistaCoord.decide).toBe(false);

    const v = (await lerTabela(p, Despesas)).porId(id)!.versao;
    await expect(decidirProposta(p, coord, id, v, 'aceitar')).rejects.toBeInstanceOf(ErroPermissao);
    await decidirProposta(p, await fin(), id, v, 'aceitar');
    const depois = await lerPrevisao(p, await fin());
    expect(depois.despesas.find((d) => d.id === id)?.valor).toBe(1000);
    expect(depois.propostasPendentes).toBe(0);
  });

  it('recusa exige motivo; a coordenação vê o motivo; retirar só proposta pendente', async () => {
    const coord = await coordUr();
    const id = await proporDespesa(p, coord, await proposta());
    const v = (await lerTabela(p, Despesas)).porId(id)!.versao;
    await expect(decidirProposta(p, await fin(), id, v, 'recusar', '  ')).rejects.toThrow(/motivo/);
    await decidirProposta(p, await fin(), id, v, 'recusar', 'Já previsto na Educação');
    const lista = (await listarPropostas(p, coord)).lista;
    expect(lista.find((x) => x.id === id)).toMatchObject({ situacao: 'recusada', motivoDecisao: 'Já previsto na Educação', podeAlterar: false });
    const id2 = await proporDespesa(p, coord, await proposta());
    await retirarProposta(p, coord, id2, (await lerTabela(p, Despesas)).porId(id2)!.versao);
    expect((await listarPropostas(p, coord)).lista.some((x) => x.id === id2)).toBe(false);
  });
});

describe('aprovação do exercício', () => {
  it('só a Diretoria aprova, e só sem fontes a definir nem propostas pendentes', async () => {
    const pend = await pendenciasDoExercicio(p, await dir(), 2027);
    expect(pend.fontesADefinir).toBeGreaterThan(0);
    await expect(aprovarExercicio(p, await dir(), 2027)).rejects.toThrow(/fonte “a definir”/);
    await escolherTodasAsFontes();
    await expect(aprovarExercicio(p, await dir(), 2027)).rejects.toThrow(/proposta pendente/);
    await decidirPendentes();
    await expect(aprovarExercicio(p, await fin(), 2027)).rejects.toBeInstanceOf(ErroPermissao);
    await aprovarExercicio(p, await dir(), 2027);
    const prev = await lerPrevisao(p, await fin());
    expect(prev.exercicio?.situacao).toBe('aprovado');
    expect(prev.podeEditar).toBe(false);
    await expect(salvarDespesa(p, await fin(), await proposta())).rejects.toThrow(/já foi aprovado/);
    await expect(proporDespesa(p, await coordUr(), await proposta())).rejects.toThrow(/não está recebendo propostas/);
  });
});

describe('remanejamentos e suplementações', () => {
  beforeEach(async () => {
    await escolherTodasAsFontes();
    await decidirPendentes();
    await aprovarExercicio(p, await dir(), 2027);
  });

  it('remanejamento: tira da origem e põe no destino no mês, sem mudar o total; só com aprovação da Diretoria', async () => {
    const f = await fin();
    const prev = await lerPrevisao(p, f);
    const merenda = prev.despesas.find((d) => d.descricao.startsWith('Merenda'))!;
    const material = prev.despesas.find((d) => d.descricao.startsWith('Material pedagógico'))!;
    await expect(
      solicitarAjuste(p, f, { ano: 2027, tipo: 'remanejamento', origem_id: merenda.id, destino_tipo: 'despesa', destino_id: material.id, mes: 3, valor: 999999, justificativa: 'x' }),
    ).rejects.toThrow(/só tem/);
    const id = await solicitarAjuste(p, f, {
      ano: 2027, tipo: 'remanejamento', origem_id: merenda.id, destino_tipo: 'despesa', destino_id: material.id, mes: 3, valor: 1500, justificativa: 'Comprar jogos em março',
    });
    // Pendente: nada muda ainda.
    expect((await lerPrevisao(p, f)).despesas.find((d) => d.id === merenda.id)?.valor).toBe(merenda.valor);
    const { lista } = await listarAjustes(p, f);
    await expect(decidirAjuste(p, f, id, lista[0].versao, true)).rejects.toBeInstanceOf(ErroPermissao);
    await decidirAjuste(p, await dir(), id, lista[0].versao, true);
    const depois = await lerPrevisao(p, f);
    const m2 = depois.despesas.find((d) => d.id === merenda.id)!;
    const mat2 = depois.despesas.find((d) => d.id === material.id)!;
    expect([m2.valor, m2.valorOriginal]).toEqual([merenda.valor - 1500, merenda.valor]);
    expect(mat2.meses[2]).toBe(material.meses[2] + 1500);
    expect(depois.totais.despesa.anual).toBeCloseTo(prev.totais.despesa.anual, 2);
  });

  it('suplementação muda o total; recusa exige motivo; nada é decidido duas vezes', async () => {
    const f = await fin();
    const prev = await lerPrevisao(p, f);
    const leilao = prev.receitas.find((r) => r.descricao.startsWith('Leilão'))!;
    const id = await solicitarAjuste(p, f, { ano: 2027, tipo: 'suplementacao', origem_id: null, destino_tipo: 'receita', destino_id: leilao.id, mes: 8, valor: 50000, justificativa: 'Patrocínio novo' });
    let v = (await listarAjustes(p, f)).lista[0].versao;
    await expect(decidirAjuste(p, await dir(), id, v, false)).rejects.toThrow(/motivo/);
    await decidirAjuste(p, await dir(), id, v, true);
    expect((await lerPrevisao(p, f)).totais.receita.anual).toBe(prev.totais.receita.anual + 50000);
    v = (await listarAjustes(p, f)).lista[0].versao;
    await expect(decidirAjuste(p, await dir(), id, v, true)).rejects.toThrow(/já decidido/);
    const auditoria = (await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.entidade === 'Ajustes');
    expect(auditoria.map((a) => a.acao)).toEqual(['inclusao', 'alteracao']);
    await encerrarExercicio(p, await dir(), 2027);
    expect((await lerPrevisao(p, f)).exercicio?.situacao).toBe('encerrado');
  });
});
