/**
 * App Educação, com dados FICTÍCIOS: instrumentos, total e subtotais, faixas, principal barreira,
 * aplicar e concluir, correção, ciente, quem avalia e quem vê, auditoria.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { inserir, lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, Pessoas, RegistrosAuditoria, Servicos, Usuarios, VinculosServico } from '@/nucleo/estrutura/tabelas';
import {
  corrigirAplicacao,
  darCiente,
  desistirAplicacao,
  detalharAplicacao,
  listarAplicacoes,
  opcoesParaNova,
  salvarAplicacao,
  type EntradaAplicacao,
} from '../aplicacao/avaliacoes';
import { popularEducacaoFicticia } from '../dados/ficticios';
import { INSTRUMENTOS_EDUCACAO } from '../dados/instrumentos';
import { Aplicacoes, Instrumentos, Respostas, TABELAS_EDUCACAO } from '../dados/tabelas';
import { ErroEducacao, instrumentoSugerido, notaDeFrequencia, recusaDeDatas, resultadoDe } from '../dominio/educacao';
import { manifesto } from '../manifesto';

const AGORA = new Date('2026-11-06T15:00:00Z');
const tudo = (n: number) => Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, n]));
const instrumento = (codigo: string) => INSTRUMENTOS_EDUCACAO.find((i) => i.codigo === codigo)!;

describe('os três instrumentos', () => {
  it('têm 10 itens, escala 0 a 3, dimensões 4 + 2 + 4 e etiqueta CIF em todos os itens', () => {
    expect(INSTRUMENTOS_EDUCACAO.map((i) => i.codigo)).toEqual(['educacao_infantil', 'ensino_fundamental', 'educacao_trabalho']);
    for (const i of INSTRUMENTOS_EDUCACAO) {
      expect(i.itens).toHaveLength(10);
      expect(i.versao).toBe(1);
      for (const d of i.dominios) expect(i.itens.filter((x) => x.dominio === d.codigo).length).toBe(d.codigo === 'adequacao' ? 2 : 4);
      expect(i.itens.every((x) => x.etiqueta)).toBe(true);
      expect(i.itens[6]!.texto).toBe('Frequência e assiduidade');
    }
  });

  it('trazem o texto e a CIF da especificação (amostra)', () => {
    const infantil = instrumento('educacao_infantil');
    expect(infantil.itens[0]).toMatchObject({ texto: 'Desenvolvimento motor', etiqueta: 'd4/b7', dominio: 'evolucao' });
    expect(infantil.itens[5]).toMatchObject({ texto: 'Adequação de turma, turno e recursos de acessibilidade', etiqueta: 'e1/e5' });
    expect(instrumento('educacao_trabalho').itens[8]).toMatchObject({ etiqueta: 'e3/e1', dominio: 'barreira' });
  });
});

describe('total, subtotais e faixa', () => {
  it('tudo 3 dá 30 (12, 6 e 12) e tudo 0 dá 0, nos três instrumentos', () => {
    for (const i of INSTRUMENTOS_EDUCACAO) {
      const max = resultadoDe(i, tudo(3));
      expect(max.total).toBe(30);
      expect(max.subtotais.map((s) => s.pontos)).toEqual([12, 6, 12]);
      expect(max.faixa).toBe('Evoluindo adequadamente');
      const zero = resultadoDe(i, tudo(0));
      expect(zero.total).toBe(0);
      expect(zero.faixa).toBe('Não evoluindo / serviço potencialmente inadequado');
    }
  });

  it('o total é a soma dos três subtotais', () => {
    const r = resultadoDe(instrumento('ensino_fundamental'), { 1: 3, 2: 2, 3: 1, 4: 0, 5: 3, 6: 1, 7: 2, 8: 2, 9: 1, 10: 3 });
    expect(r.subtotais.map((s) => [s.nome, s.pontos])).toEqual([['Evolução', 6], ['Adequação', 4], ['Barreira', 8]]);
    expect(r.total).toBe(18);
    expect(r.subtotais.reduce((s, x) => s + x.pontos, 0)).toBe(r.total);
  });

  it('limites das faixas: 10/11 e 20/21', () => {
    const i = instrumento('educacao_infantil');
    const com = (total: number) => {
      const r: Record<number, number> = {};
      let falta = total;
      for (let n = 1; n <= 10; n++) {
        r[n] = Math.min(3, falta);
        falta -= r[n]!;
      }
      return resultadoDe(i, r).faixa;
    };
    expect(com(10)).toMatch(/^Não evoluindo/);
    expect(com(11)).toMatch(/^Evolução parcial/);
    expect(com(20)).toMatch(/^Evolução parcial/);
    expect(com(21)).toBe('Evoluindo adequadamente');
  });

  it('principal barreira: a dimensão de menor percentual do máximo, e todas em empate', () => {
    const i = instrumento('educacao_trabalho');
    // Evolução 12/12, Adequação 3/6 (50%), Barreira 12/12 → Adequação, embora tenha mais pontos que 0 bruto.
    expect(resultadoDe(i, { 1: 3, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 3, 8: 3, 9: 3, 10: 3 }).principalBarreira).toEqual(['Adequação']);
    // Evolução 6/12 = 50%, Adequação 3/6 = 50%, Barreira 12/12 → empate entre as duas.
    expect(resultadoDe(i, { 1: 3, 2: 3, 3: 0, 4: 0, 5: 2, 6: 1, 7: 3, 8: 3, 9: 3, 10: 3 }).principalBarreira).toEqual(['Evolução', 'Adequação']);
    // Incompleto: sem faixa e sem principal barreira.
    const parcial = resultadoDe(i, { 1: 3 });
    expect(parcial.completo).toBe(false);
    expect(parcial.faixa).toBeNull();
    expect(parcial.principalBarreira).toEqual([]);
  });
});

describe('regras pequenas', () => {
  it('frequência sugere a nota pelas quatro faixas', () => {
    expect([0, 39.9, 40, 59, 60, 79, 80, 100].map(notaDeFrequencia)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    expect(notaDeFrequencia(101)).toBeNull();
    expect(notaDeFrequencia(-1)).toBeNull();
    expect(notaDeFrequencia(Number.NaN)).toBeNull();
  });

  it('datas: início antes do fim, fim e ingresso não futuros', () => {
    const hoje = '2026-11-06';
    expect(recusaDeDatas({ periodoInicio: '2026-02-01', periodoFim: '2026-06-30', dataIngresso: '2024-02-01' }, hoje)).toBeNull();
    expect(recusaDeDatas({ periodoInicio: '2026-07-01', periodoFim: '2026-06-30' }, hoje)).toMatch(/depois do fim/);
    expect(recusaDeDatas({ periodoFim: '2026-12-01' }, hoje)).toMatch(/futuro/);
    expect(recusaDeDatas({ dataIngresso: '2027-01-01' }, hoje)).toMatch(/futuro/);
  });

  it('sugere o instrumento pelo nome do serviço', () => {
    expect(instrumentoSugerido('Educação Infantil')).toBe('educacao_infantil');
    expect(instrumentoSugerido('Ensino Fundamental (exemplo)')).toBe('ensino_fundamental');
    expect(instrumentoSugerido('Educação para o Trabalho')).toBe('educacao_trabalho');
    expect(instrumentoSugerido('Escola (exemplo)')).toBeNull();
  });
});

describe('casos de uso', () => {
  let p: Planilhas;
  let pessoaA: string;

  async function como(email: string) {
    const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
    return new Autorizador(email, {
      usuarios: usuarios.ativos(),
      atribuicoes: atribuicoes.ativos(),
      perfilPermissoes: perfilPermissoes.ativos(),
      servicos: servicos.todos(),
    });
  }

  async function novoUsuario(email: string, perfil: string, escopo: { tipo: 'global' | 'area' | 'servico'; codigo: string | null }) {
    const autor = { email: 'teste' };
    const pessoa = await inserir(p, Pessoas, { nome: `Pessoa ${email} (fictícia)`, email }, autor);
    await inserir(p, Usuarios, { email, pessoa_id: pessoa.id }, autor);
    await inserir(p, Atribuicoes, { usuario_email: email, perfil, escopo_tipo: escopo.tipo, escopo: escopo.codigo }, autor);
  }

  const entrada = (x: Partial<EntradaAplicacao> = {}): EntradaAplicacao => ({
    pessoaId: pessoaA,
    instrumento: 'ensino_fundamental',
    servico: 'escola',
    periodoInicio: '2026-02-01',
    periodoFim: '2026-06-30',
    dataIngresso: '2024-02-05',
    profissional: 'Profissional de exemplo',
    funcao: 'Educador(a)',
    justificativa: 'Enquadramento de exemplo.',
    respostas: tudo(2),
    ...x,
  });

  beforeEach(async () => {
    p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'avaliacao_educacao']), idDe: (c) => c };
    const permissoes = Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao })));
    await prepararEstrutura(p, { tabelas: [...TABELAS_EDUCACAO] as never, perfis: manifesto.perfis, permissoes });
    await popularDadosFicticios(p);
    const [vinculos] = await lerTabelas(p, [VinculosServico] as const);
    [pessoaA] = vinculos.ativos().filter((v) => v.servico === 'escola').map((v) => v.pessoa_id);
    await novoUsuario('educador.escola@exemplo.local', 'tecnico_avaliador', { tipo: 'servico', codigo: 'escola' });
    await novoUsuario('educador.transporte@exemplo.local', 'tecnico_avaliador', { tipo: 'servico', codigo: 'transporte' });
  });

  it('o educador avalia só no serviço dele; a coordenação da área e a Diretoria em toda a Educação', async () => {
    const educador = await como('educador.escola@exemplo.local');
    expect((await opcoesParaNova(p, educador)).servicos.map((s) => s.codigo)).toEqual(['escola']);
    const coord = await como('coord.educacao@exemplo.local');
    expect((await opcoesParaNova(p, coord)).servicos.map((s) => s.codigo).sort()).toEqual(['escola', 'transporte']);
    const dir = await como('diretoria@exemplo.local');
    expect((await opcoesParaNova(p, dir)).servicos.map((s) => s.codigo).sort()).toEqual(['escola', 'transporte']);
    // O serviço de Assistência Social não é de Educação, nem para a Diretoria.
    await expect(salvarAplicacao(p, dir, entrada({ servico: 'ur' }), { agora: AGORA })).rejects.toThrow(/serviço de Educação/);
  });

  it('as pessoas da lista são as visíveis e vinculadas a um serviço do escopo', async () => {
    const educador = await como('educador.escola@exemplo.local');
    const { pessoas } = await opcoesParaNova(p, educador);
    expect(pessoas.map((x) => x.id)).toContain(pessoaA);
    expect(pessoas.every((x) => x.servicos.includes('escola'))).toBe(true);
    const outro = await como('educador.transporte@exemplo.local');
    expect((await opcoesParaNova(p, outro)).pessoas).toEqual([]);
  });

  it('salva um rascunho sem exigir tudo e guarda as respostas por item', async () => {
    const educador = await como('educador.escola@exemplo.local');
    const r = await salvarAplicacao(p, educador, entrada({ respostas: { 1: 3, 2: 1 }, justificativa: '', profissional: '' }), { agora: AGORA });
    expect(r.situacao).toBe('aberta');
    expect(r.resultado.completo).toBe(false);
    const respostas = (await lerTabela(p, Respostas)).ativos().filter((x) => x.aplicacao_id === r.id);
    expect(respostas.map((x) => [x.item, x.valor])).toEqual([[1, 3], [2, 1]]);
    // Voltar ao rascunho e completar altera só o que mudou.
    const r2 = await salvarAplicacao(p, educador, entrada({ respostas: { 1: 2, 2: 1, 3: 3 } }), { id: r.id, versao: r.versao, agora: AGORA });
    const depois = (await lerTabela(p, Respostas)).ativos().filter((x) => x.aplicacao_id === r.id);
    expect(depois.map((x) => [x.item, x.valor])).toEqual([[1, 2], [2, 1], [3, 3]]);
    expect(r2.id).toBe(r.id);
  });

  it('concluir exige os 10 itens, a justificativa, o período, o ingresso, o profissional e a função', async () => {
    const educador = await como('educador.escola@exemplo.local');
    await expect(salvarAplicacao(p, educador, entrada({ respostas: { 1: 1 } }), { concluir: true, agora: AGORA })).rejects.toThrow(/Faltam responder/);
    await expect(salvarAplicacao(p, educador, entrada({ justificativa: ' ' }), { concluir: true, agora: AGORA })).rejects.toThrow(/justificativa/);
    await expect(salvarAplicacao(p, educador, entrada({ profissional: '' }), { concluir: true, agora: AGORA })).rejects.toThrow(/profissional responsável/);
    await expect(salvarAplicacao(p, educador, entrada({ periodoInicio: '' }), { concluir: true, agora: AGORA })).rejects.toThrow(/período avaliado/);
    expect((await lerTabela(p, Aplicacoes)).todos()).toHaveLength(0);
  });

  it('concluir fecha, assina e calcula total, subtotais e faixa; nada disso é guardado', async () => {
    const educador = await como('educador.escola@exemplo.local');
    const r = await salvarAplicacao(p, educador, entrada(), { concluir: true, agora: AGORA });
    expect(r.situacao).toBe('fechada');
    expect(r.resultado.total).toBe(20);
    expect(r.resultado.faixa).toMatch(/^Evolução parcial/);
    const a = (await lerTabela(p, Aplicacoes)).porId(r.id)!;
    expect(a.data_assinatura).toBe('2026-11-06');
    expect(Object.keys(a)).not.toContain('total');
    const d = await detalharAplicacao(p, educador, r.id, { agora: AGORA });
    expect(d.resultado.subtotais.map((s) => s.pontos)).toEqual([8, 4, 8]);
    expect(d.instrumento.versao).toBe(1);
  });

  it('aplicação fechada não se edita; a correção cria nova e a anterior fica no histórico', async () => {
    const educador = await como('educador.escola@exemplo.local');
    const r = await salvarAplicacao(p, educador, entrada(), { concluir: true, agora: AGORA });
    await expect(salvarAplicacao(p, educador, entrada({ respostas: tudo(3) }), { id: r.id, versao: r.versao, agora: AGORA })).rejects.toThrow(/já foi concluída/);
    const nova = await corrigirAplicacao(p, educador, r.id, { agora: AGORA });
    const novoDetalhe = await detalharAplicacao(p, educador, nova.id, { agora: AGORA });
    expect(novoDetalhe.situacao).toBe('aberta');
    expect(novoDetalhe.corrige).toBe(r.id);
    expect(novoDetalhe.respostas[1]).toBe(2);
    // Só uma correção aberta por vez.
    await expect(corrigirAplicacao(p, educador, r.id, { agora: AGORA })).rejects.toThrow(/já tem uma avaliação aberta/);
    await salvarAplicacao(p, educador, entrada({ respostas: tudo(3) }), { id: nova.id, versao: novoDetalhe.versao, concluir: true, agora: AGORA });
    const lista = await listarAplicacoes(p, educador, { agora: AGORA });
    expect(lista).toHaveLength(2);
    expect(lista.find((l) => l.id === r.id)!.corrigida).toBe(true);
    expect(lista.find((l) => l.id === nova.id)!.total).toBe(30);
    expect((await detalharAplicacao(p, educador, r.id, { agora: AGORA })).corrigidaPor).toBe(nova.id);
    await expect(corrigirAplicacao(p, educador, r.id, { agora: AGORA })).rejects.toThrow(/já foi corrigida/);
  });

  it('uma pessoa não tem duas aplicações abertas do mesmo instrumento, mas pode ter de instrumentos diferentes', async () => {
    const educador = await como('educador.escola@exemplo.local');
    await salvarAplicacao(p, educador, entrada({ respostas: { 1: 1 } }), { agora: AGORA });
    await expect(salvarAplicacao(p, educador, entrada({ respostas: { 1: 2 } }), { agora: AGORA })).rejects.toThrow(/já tem uma avaliação aberta/);
    await expect(salvarAplicacao(p, educador, entrada({ instrumento: 'educacao_infantil', respostas: { 1: 2 } }), { agora: AGORA })).resolves.toBeDefined();
  });

  it('respostas fora de 0 a 3, item inexistente e datas erradas são recusados', async () => {
    const educador = await como('educador.escola@exemplo.local');
    await expect(salvarAplicacao(p, educador, entrada({ respostas: { 1: 4 } }), { agora: AGORA })).rejects.toThrow(/de 0 a 3/);
    await expect(salvarAplicacao(p, educador, entrada({ respostas: { 11: 1 } }), { agora: AGORA })).rejects.toThrow(/não existe/);
    await expect(salvarAplicacao(p, educador, entrada({ periodoFim: '2027-01-01' }), { agora: AGORA })).rejects.toThrow(/futuro/);
  });

  it('a pessoa precisa existir, ser visível e ter vínculo ativo com o serviço', async () => {
    const educador = await como('educador.escola@exemplo.local');
    await expect(salvarAplicacao(p, educador, entrada({ pessoaId: 'nao-existe' }), { agora: AGORA })).rejects.toThrow(ErroEducacao);
    // Pessoa de outro serviço (CER) não é visível ao educador da escola.
    const [vinculos] = await lerTabelas(p, [VinculosServico] as const);
    const doCer = vinculos.ativos().find((v) => v.servico === 'cer_reabilitacao')!.pessoa_id;
    await expect(salvarAplicacao(p, educador, entrada({ pessoaId: doCer }), { agora: AGORA })).rejects.toThrow(ErroPermissao);
    // Visível à coordenação, mas sem vínculo com o serviço de Educação escolhido.
    const coord = await como('coord.educacao@exemplo.local');
    await expect(salvarAplicacao(p, coord, entrada({ servico: 'transporte' }), { agora: AGORA })).rejects.toThrow(/vínculo ativo/);
  });

  it('o educador do serviço A não lista, não abre e não corrige o que é do serviço B', async () => {
    const educador = await como('educador.escola@exemplo.local');
    const { id } = await salvarAplicacao(p, educador, entrada(), { concluir: true, agora: AGORA });
    const outro = await como('educador.transporte@exemplo.local');
    expect(await listarAplicacoes(p, outro, { agora: AGORA })).toEqual([]);
    await expect(detalharAplicacao(p, outro, id, { agora: AGORA })).rejects.toThrow(ErroPermissao);
    await expect(corrigirAplicacao(p, outro, id, { agora: AGORA })).rejects.toThrow(ErroPermissao);
    const coord = await como('coord.educacao@exemplo.local');
    expect(await listarAplicacoes(p, coord, { agora: AGORA })).toHaveLength(1);
  });

  it('Conselho, Financeiro, Administração e técnico da Saúde não avaliam nem leem', async () => {
    const educador = await como('educador.escola@exemplo.local');
    const { id } = await salvarAplicacao(p, educador, entrada(), { concluir: true, agora: AGORA });
    // O técnico da Saúde tem "avaliar" só no serviço dele: a lista vem vazia e o resto é recusado.
    expect(await listarAplicacoes(p, await como('tecnico.cer@exemplo.local'), { agora: AGORA })).toEqual([]);
    for (const email of ['leitura@exemplo.local', 'financeiro@exemplo.local', 'admin@exemplo.local', 'tecnico.cer@exemplo.local']) {
      const quem = await como(email);
      if (email !== 'tecnico.cer@exemplo.local') await expect(listarAplicacoes(p, quem, { agora: AGORA })).rejects.toThrow(ErroPermissao);
      await expect(salvarAplicacao(p, quem, entrada(), { agora: AGORA })).rejects.toThrow(ErroPermissao);
      await expect(detalharAplicacao(p, quem, id, { agora: AGORA })).rejects.toThrow(ErroPermissao);
    }
    // O Conselho entra no app (para "Sobre o instrumento"), mas não avalia.
    const conselho = await como('leitura@exemplo.local');
    expect(conselho.permissoes().has('educacao.acessar')).toBe(true);
    expect(conselho.permissoes().has('educacao.avaliar')).toBe(false);
  });

  it('o ciente é da coordenação e da Diretoria, só em aplicação fechada, uma vez, sem mexer nas respostas', async () => {
    const educador = await como('educador.escola@exemplo.local');
    const aberta = await salvarAplicacao(p, educador, entrada({ respostas: { 1: 1 } }), { agora: AGORA });
    const coord = await como('coord.educacao@exemplo.local');
    await expect(darCiente(p, coord, aberta.id, aberta.versao, { agora: AGORA })).rejects.toThrow(/concluída/);
    const fechada = await salvarAplicacao(p, educador, entrada(), { id: aberta.id, versao: aberta.versao, concluir: true, agora: AGORA });
    expect((await detalharAplicacao(p, educador, fechada.id, { agora: AGORA })).podeDarCiente).toBe(false);
    await expect(darCiente(p, educador, fechada.id, fechada.versao, { agora: AGORA })).rejects.toThrow(ErroPermissao);
    expect((await detalharAplicacao(p, coord, fechada.id, { agora: AGORA })).podeDarCiente).toBe(true);
    await darCiente(p, coord, fechada.id, fechada.versao, { agora: AGORA });
    const d = await detalharAplicacao(p, educador, fechada.id, { agora: AGORA });
    expect(d.cientePor).toBe('coord.educacao@exemplo.local');
    expect(d.cienteEm).toBe('2026-11-06');
    expect(d.resultado.total).toBe(20);
    await expect(darCiente(p, coord, fechada.id, d.versao, { agora: AGORA })).rejects.toThrow(/já foi dado/);
  });

  it('a Diretoria também dá o ciente', async () => {
    const educador = await como('educador.escola@exemplo.local');
    const f = await salvarAplicacao(p, educador, entrada(), { concluir: true, agora: AGORA });
    const dir = await como('diretoria@exemplo.local');
    await expect(darCiente(p, dir, f.id, f.versao, { agora: AGORA })).resolves.toBeUndefined();
  });

  it('desistir de uma aplicação aberta guarda o motivo e a tira da lista; fechada não se desfaz', async () => {
    const educador = await como('educador.escola@exemplo.local');
    const aberta = await salvarAplicacao(p, educador, entrada({ respostas: { 1: 1 } }), { agora: AGORA });
    await expect(desistirAplicacao(p, educador, aberta.id, aberta.versao, ' ', { agora: AGORA })).rejects.toThrow(/motivo/);
    await desistirAplicacao(p, educador, aberta.id, aberta.versao, 'Lançada por engano', { agora: AGORA });
    const reg = (await lerTabela(p, Aplicacoes)).porId(aberta.id)!;
    expect(reg.ativo).toBe(false);
    expect(reg.motivo_desistencia).toBe('Lançada por engano');
    expect(await listarAplicacoes(p, educador, { agora: AGORA })).toEqual([]);
    const f = await salvarAplicacao(p, educador, entrada(), { concluir: true, agora: AGORA });
    await expect(desistirAplicacao(p, educador, f.id, f.versao, 'Teste', { agora: AGORA })).rejects.toThrow(/Corrigir/);
  });

  it('outra pessoa alterou antes: nada é sobrescrito', async () => {
    const educador = await como('educador.escola@exemplo.local');
    const r = await salvarAplicacao(p, educador, entrada({ respostas: { 1: 1 } }), { agora: AGORA });
    await salvarAplicacao(p, educador, entrada({ respostas: { 1: 1 }, profissional: 'Outra pessoa' }), { id: r.id, versao: r.versao, agora: AGORA });
    await expect(salvarAplicacao(p, educador, entrada({ respostas: { 1: 3 }, profissional: 'Terceira' }), { id: r.id, versao: r.versao, agora: AGORA })).rejects.toThrow(/alterado por outra pessoa/);
  });

  it('audita inclusão, leitura, alteração e ciente, só com colunas e nunca valores', async () => {
    const educador = await como('educador.escola@exemplo.local');
    const f = await salvarAplicacao(p, educador, entrada({ justificativa: 'Texto sigiloso da justificativa' }), { concluir: true, agora: AGORA });
    await detalharAplicacao(p, educador, f.id, { agora: AGORA });
    const coord = await como('coord.educacao@exemplo.local');
    await darCiente(p, coord, f.id, f.versao, { agora: AGORA });
    const aud = (await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.entidade.startsWith('educacao.') && a.entidade !== 'educacao.Instrumentos');
    expect(aud.map((a) => `${a.entidade}:${a.acao}`)).toEqual([
      'educacao.Aplicacoes:inclusao',
      'educacao.Respostas:inclusao',
      'educacao.Aplicacoes:leitura',
      'educacao.Aplicacoes:alteracao',
    ]);
    expect(aud.some((a) => /sigiloso|Profissional de exemplo/.test(a.detalhes ?? ''))).toBe(false);
  });

  it('os instrumentos entram uma vez na aba e não são duplicados nas leituras seguintes', async () => {
    const educador = await como('educador.escola@exemplo.local');
    await opcoesParaNova(p, educador, { agora: AGORA });
    await opcoesParaNova(p, educador, { agora: AGORA });
    const lidos = (await lerTabela(p, Instrumentos)).ativos();
    expect(lidos.map((i) => [i.codigo, i.versao_instrumento])).toEqual([['educacao_infantil', 1], ['ensino_fundamental', 1], ['educacao_trabalho', 1]]);
    expect(JSON.parse(lidos[0]!.definicao).itens).toHaveLength(10);
  });

  it('a demonstração grava avaliações fictícias concluídas, com ciente, e um rascunho', async () => {
    await popularEducacaoFicticia(p);
    const dir = await como('diretoria@exemplo.local');
    const lista = await listarAplicacoes(p, dir, { agora: AGORA });
    expect(lista.filter((l) => l.situacao === 'fechada')).toHaveLength(5);
    expect(lista.filter((l) => l.situacao === 'aberta')).toHaveLength(1);
    expect(lista.filter((l) => l.cienteDada)).toHaveLength(2);
    expect(lista.filter((l) => l.total !== null).map((l) => l.total).sort((a, b) => a! - b!)).toEqual([9, 15, 17, 26, 26]);
  });
});
