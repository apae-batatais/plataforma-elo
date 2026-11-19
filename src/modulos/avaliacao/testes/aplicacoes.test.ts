/**
 * Aplicação de instrumentos a pessoas do Cadastro Único (issue #62, entrega 2), com dados FICTÍCIOS:
 * rascunho, fechamento, correção, comparativo, quem vê quem e auditoria.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { instrumentoFicticio } from '@/capacidades/motor-avaliacao/testes/instrumento-ficticio';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { ErroConflito, lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import {
  cadastrarInstrumento,
  comparativoDaPessoa,
  corrigirAplicacao,
  desistirDaAplicacao,
  detalharAplicacao,
  listarAplicacoes,
  listarInstrumentos,
  pessoasParaAplicar,
  salvarAplicacao,
  type EntradaAplicacao,
} from '../aplicacao/aplicacoes';
import { Aplicacoes, Respostas, TABELAS_AVALIACAO } from '../dados/tabelas';
import { ErroAvaliacao } from '../dominio/avaliacao';
import { iniciaisDoNome, montarRespostas } from '../dominio/aplicacao';
import { manifesto } from '../manifesto';

const AGORA = new Date('2026-11-06T15:00:00Z');
// Itens 1 a 4; o item 3 aceita "não se aplica".
const RESPOSTAS = { 1: 1, 2: 2, 3: 'nao_se_aplica', 4: 3 } as const;

describe('regras puras', () => {
  it('iniciais ignoram partículas e usam letras maiúsculas', () => {
    expect(iniciaisDoNome('maria aparecida da Silva')).toBe('MAS');
    expect(iniciaisDoNome('  João  dos Santos ')).toBe('JS');
  });
  it('respostas guardadas voltam como números e "não se aplica"', () => {
    expect(montarRespostas([{ item: 1, valor: '2' }, { item: 3, valor: 'nao_se_aplica' }, { item: 4, valor: 'x' }])).toEqual({ 1: 2, 3: 'nao_se_aplica' });
  });
});

describe('aplicação por pessoa', () => {
  let p: Planilhas;

  async function como(email: string) {
    const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
    return new Autorizador(email, {
      usuarios: usuarios.ativos(),
      atribuicoes: atribuicoes.ativos(),
      perfilPermissoes: perfilPermissoes.ativos(),
      servicos: servicos.todos(),
    });
  }

  /** Uma pessoa atendida na UR e uma no CER, para os testes de quem vê quem. */
  async function pessoaDa(quem: Autorizador) {
    const lista = await pessoasParaAplicar(p, quem, { agora: AGORA });
    return lista[0]!;
  }
  const entrada = (pessoa: { id: string; servicos: { codigo: string }[] }, x: Partial<EntradaAplicacao> = {}): EntradaAplicacao => ({
    pessoaId: pessoa.id,
    instrumento: 'ficticio',
    servico: pessoa.servicos[0]!.codigo,
    tipo: 'Inicial',
    data: '2026-11-03',
    respostas: { ...RESPOSTAS },
    justificativa: 'Justificativa de teste.',
    ...x,
  });

  beforeEach(async () => {
    p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'avaliacao_assistencia']), idDe: (c) => c };
    const permissoes = Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao })));
    await prepararEstrutura(p, { tabelas: [...TABELAS_AVALIACAO] as never, perfis: manifesto.perfis, permissoes });
    await popularDadosFicticios(p);
    await cadastrarInstrumento(p, await como('diretoria@exemplo.local'), instrumentoFicticio(1), { agora: AGORA });
  });

  it('instrumento: só quem acessa todos os serviços cadastra; depois de usado só muda por nova versão', async () => {
    const coord = await como('coord.ur@exemplo.local');
    await expect(cadastrarInstrumento(p, coord, instrumentoFicticio(2))).rejects.toThrow(ErroPermissao);
    const dir = await como('diretoria@exemplo.local');
    const pessoa = await pessoaDa(coord);
    const alterado = { ...instrumentoFicticio(1), nome: 'Outro nome' };
    // Ainda sem aplicação: pode ajustar.
    await cadastrarInstrumento(p, dir, alterado, { agora: AGORA });
    await salvarAplicacao(p, coord, entrada(pessoa), false, { agora: AGORA });
    await expect(cadastrarInstrumento(p, dir, { ...alterado, nome: 'Mais outro' })).rejects.toThrow(/nova versão/);
    await cadastrarInstrumento(p, dir, { ...instrumentoFicticio(2), nome: 'Outro nome' }, { agora: AGORA });
    const lista = await listarInstrumentos(p, coord);
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ versao: 2, usado: false });
  });

  it('só lista as pessoas que quem avalia já vê, nos serviços do seu escopo', async () => {
    const coord = await como('coord.ur@exemplo.local');
    const pessoas = await pessoasParaAplicar(p, coord, { agora: AGORA });
    expect(pessoas.length).toBeGreaterThan(0);
    for (const x of pessoas) expect(x.servicos.map((s) => s.codigo)).toEqual(['ur']);
    const tecnico = await como('tecnico.cer@exemplo.local');
    const doCer = await pessoasParaAplicar(p, tecnico, { agora: AGORA });
    expect(doCer.every((x) => x.servicos.every((s) => s.codigo === 'cer_reabilitacao'))).toBe(true);
    expect(doCer.map((x) => x.id).filter((id) => pessoas.some((y) => y.id === id))).toEqual([]);
    const dir = await como('diretoria@exemplo.local');
    expect((await pessoasParaAplicar(p, dir, { agora: AGORA })).length).toBeGreaterThan(pessoas.length);
  });

  it('Conselho, Financeiro e Administração não aplicam nem veem nada', async () => {
    for (const email of ['leitura@exemplo.local', 'financeiro@exemplo.local', 'admin@exemplo.local']) {
      const quem = await como(email);
      await expect(pessoasParaAplicar(p, quem)).rejects.toThrow(ErroPermissao);
      await expect(listarAplicacoes(p, quem)).rejects.toThrow(ErroPermissao);
      await expect(listarInstrumentos(p, quem)).rejects.toThrow(ErroPermissao);
    }
  });

  it('o técnico de um serviço não aplica nem abre aplicação de pessoa de outro serviço', async () => {
    const coord = await como('coord.ur@exemplo.local');
    const tecnico = await como('tecnico.cer@exemplo.local');
    const pessoaUr = await pessoaDa(coord);
    await expect(salvarAplicacao(p, tecnico, entrada(pessoaUr), false, { agora: AGORA })).rejects.toThrow(ErroAvaliacao);
    const { id } = await salvarAplicacao(p, coord, entrada(pessoaUr), false, { agora: AGORA });
    await expect(detalharAplicacao(p, tecnico, id)).rejects.toThrow(ErroPermissao);
    await expect(corrigirAplicacao(p, tecnico, id)).rejects.toThrow(ErroPermissao);
    expect(await listarAplicacoes(p, tecnico)).toEqual([]);
  });

  it('rascunho guarda o que foi respondido e deixa continuar; concluir exige todos os itens e justificativa', async () => {
    const coord = await como('coord.ur@exemplo.local');
    const pessoa = await pessoaDa(coord);
    const r = await salvarAplicacao(p, coord, entrada(pessoa, { respostas: { 1: 2 }, justificativa: '' }), false, { agora: AGORA });
    expect(r.fechada).toBe(false);
    expect(r.escore.completo).toBe(false);
    await expect(salvarAplicacao(p, coord, entrada(pessoa, { id: r.id, versao: r.versao, respostas: { 1: 2 } }), true, { agora: AGORA })).rejects.toThrow(/Faltam responder/);
    await expect(salvarAplicacao(p, coord, entrada(pessoa, { id: r.id, versao: r.versao, justificativa: '  ' }), true, { agora: AGORA })).rejects.toThrow(/justificativa/);
    const fechada = await salvarAplicacao(p, coord, entrada(pessoa, { id: r.id, versao: r.versao }), true, { agora: AGORA });
    expect(fechada.fechada).toBe(true);
    expect(fechada.escore.total).toBe(6);
    expect(fechada.escore.enquadramento?.nome).toBe('Média');
    const guardadas = (await lerTabela(p, Respostas)).ativos().filter((x) => x.aplicacao_id === r.id);
    expect(guardadas).toHaveLength(4);
  });

  it('recusa resposta fora de 0 a 3, "não se aplica" onde não cabe, data futura e instrumento ou pessoa inexistentes', async () => {
    const coord = await como('coord.ur@exemplo.local');
    const pessoa = await pessoaDa(coord);
    await expect(salvarAplicacao(p, coord, entrada(pessoa, { respostas: { 1: 4 } }), false, { agora: AGORA })).rejects.toThrow(/de 0 a 3/);
    await expect(salvarAplicacao(p, coord, entrada(pessoa, { respostas: { 1: 'nao_se_aplica' } }), false, { agora: AGORA })).rejects.toThrow(/não aceita/);
    await expect(salvarAplicacao(p, coord, entrada(pessoa, { data: '2026-12-01' }), false, { agora: AGORA })).rejects.toThrow(/futuro/);
    await expect(salvarAplicacao(p, coord, entrada(pessoa, { instrumento: 'nao_existe' }), false, { agora: AGORA })).rejects.toThrow(/Instrumento não encontrado/);
    await expect(salvarAplicacao(p, coord, entrada(pessoa, { pessoaId: 'inexistente' }), false, { agora: AGORA })).rejects.toThrow(/pessoa da lista/);
    expect((await lerTabela(p, Aplicacoes)).todos()).toHaveLength(0);
  });

  it('uma pessoa não tem duas aplicações abertas do mesmo instrumento', async () => {
    const coord = await como('coord.ur@exemplo.local');
    const pessoa = await pessoaDa(coord);
    const a = await salvarAplicacao(p, coord, entrada(pessoa), false, { agora: AGORA });
    await expect(salvarAplicacao(p, coord, entrada(pessoa), false, { agora: AGORA })).rejects.toThrow(/em aberto/);
    await desistirDaAplicacao(p, coord, a.id, a.versao, 'Lançada por engano', { agora: AGORA });
    await salvarAplicacao(p, coord, entrada(pessoa), false, { agora: AGORA });
  });

  it('aplicação concluída não se edita nem se desiste; a correção cria nova ligada à anterior e some do comparativo', async () => {
    const coord = await como('coord.ur@exemplo.local');
    const pessoa = await pessoaDa(coord);
    const a = await salvarAplicacao(p, coord, entrada(pessoa), true, { agora: AGORA });
    await expect(salvarAplicacao(p, coord, entrada(pessoa, { id: a.id, versao: a.versao }), false, { agora: AGORA })).rejects.toThrow(/já foi concluída/);
    await expect(desistirDaAplicacao(p, coord, a.id, a.versao, 'motivo qualquer')).rejects.toThrow(/Corrigir/);
    const c = await corrigirAplicacao(p, coord, a.id, { agora: AGORA });
    await expect(corrigirAplicacao(p, coord, a.id, { agora: AGORA })).rejects.toThrow(/já foi corrigida/);
    const aberta = await detalharAplicacao(p, coord, c.id);
    expect(aberta).toMatchObject({ situacao: 'aberta', corrige: a.id, respostas: { ...RESPOSTAS } });
    const fechada = await salvarAplicacao(
      p,
      coord,
      entrada(pessoa, { id: c.id, versao: aberta.versao, respostas: { ...RESPOSTAS, 4: 0 }, justificativa: 'Corrigido.' }),
      true,
      { agora: AGORA },
    );
    expect(fechada.escore.total).toBe(3);
    expect((await detalharAplicacao(p, coord, a.id)).corrigidaPor).toBe(c.id);
    const cmp = await comparativoDaPessoa(p, coord, a.id, { agora: AGORA });
    expect(cmp.comparativo.pontos.map((x) => x.id)).toEqual([c.id]);
    const linhas = await listarAplicacoes(p, coord);
    expect(linhas.find((l) => l.id === a.id)?.corrigida).toBe(true);
    expect(linhas.find((l) => l.id === c.id)?.corrige).toBe(true);
  });

  it('comparativo: escore por ciclo, enquadramento, vencimento em 12 meses e aviso de versões diferentes', async () => {
    const coord = await como('coord.ur@exemplo.local');
    const dir = await como('diretoria@exemplo.local');
    const pessoa = await pessoaDa(coord);
    const a = await salvarAplicacao(p, coord, entrada(pessoa, { data: '2025-10-01', respostas: { 1: 3, 2: 3, 3: 3, 4: 3 } }), true, { agora: AGORA });
    const b = await salvarAplicacao(p, coord, entrada(pessoa, { tipo: 'Anual', data: '2026-10-01', respostas: { 1: 1, 2: 1, 3: 1, 4: 1 } }), true, { agora: AGORA });
    let cmp = await comparativoDaPessoa(p, coord, b.id, { agora: AGORA });
    expect(cmp.comparativo.pontos.map((x) => x.escore.total)).toEqual([12, 4]);
    expect(cmp.comparativo.diferencaDoTotal).toBe(-8);
    expect(cmp.ciclos.map((c) => c.enquadramento)).toEqual(['Alta', 'Baixa']);
    expect(cmp.reavaliacao).toMatchObject({ vence: '2027-10-01', situacao: 'em_dia' });
    expect(a.fechada).toBe(true);
    // Nova versão do instrumento: o ciclo novo não soma com os antigos e a tela avisa.
    await cadastrarInstrumento(p, dir, instrumentoFicticio(2), { agora: AGORA });
    const c = await salvarAplicacao(p, coord, entrada(pessoa, { tipo: 'Anual', data: '2026-11-05' }), true, { agora: AGORA });
    cmp = await comparativoDaPessoa(p, coord, c.id, { agora: AGORA });
    expect(cmp.comparativo.versao).toBe(2);
    expect(cmp.comparativo.pontos).toHaveLength(1);
    expect(cmp.comparativo.avisoDeVersoes).toMatch(/outra versão/);
  });

  it('auditoria: inclusão, alteração e fechamento só com colunas; abrir e comparar registram leitura; nunca valores', async () => {
    const coord = await como('coord.ur@exemplo.local');
    const pessoa = await pessoaDa(coord);
    const a = await salvarAplicacao(p, coord, entrada(pessoa, { respostas: { 1: 2 } }), false, { agora: AGORA });
    await salvarAplicacao(p, coord, entrada(pessoa, { id: a.id, versao: a.versao, justificativa: 'Texto sigiloso da equipe.' }), true, { agora: AGORA });
    await detalharAplicacao(p, coord, a.id);
    await comparativoDaPessoa(p, coord, a.id, { agora: AGORA });
    const aud = (await lerTabela(p, RegistrosAuditoria)).todos().filter((x) => x.registro_id === a.id);
    expect(aud.map((x) => `${x.entidade}:${x.acao}`)).toEqual([
      'avaliacao.Aplicacoes:inclusao',
      'avaliacao.Respostas:inclusao',
      'avaliacao.Aplicacoes:alteracao',
      'avaliacao.Respostas:inclusao',
      'avaliacao.Respostas:alteracao',
      'avaliacao.Aplicacoes:alteracao',
      'avaliacao.Aplicacoes:leitura',
      'avaliacao.Aplicacoes:leitura',
    ]);
    const tudo = aud.map((x) => x.detalhes ?? '').join(' ');
    expect(tudo).not.toContain('sigiloso');
    expect(JSON.parse(aud[5]!.detalhes!)).toMatchObject({ evento: 'fechamento' });
  });

  it('conferência de versão: dois rascunhos simultâneos não se sobrescrevem', async () => {
    const coord = await como('coord.ur@exemplo.local');
    const pessoa = await pessoaDa(coord);
    const a = await salvarAplicacao(p, coord, entrada(pessoa, { respostas: { 1: 1 } }), false, { agora: AGORA });
    await salvarAplicacao(p, coord, entrada(pessoa, { id: a.id, versao: a.versao, respostas: { 1: 2 } }), false, { agora: AGORA });
    await expect(salvarAplicacao(p, coord, entrada(pessoa, { id: a.id, versao: a.versao, respostas: { 1: 3 } }), false, { agora: AGORA })).rejects.toThrow(ErroConflito);
  });

  it('as colunas pessoais e sensíveis estão marcadas', () => {
    expect(Aplicacoes.sigilo).toMatchObject({ pessoa_id: 'pessoal', justificativa: 'sensivel' });
    expect(Respostas.sigilo).toMatchObject({ valor: 'sensivel' });
  });
});
