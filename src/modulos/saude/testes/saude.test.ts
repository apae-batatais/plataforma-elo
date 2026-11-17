/**
 * Saúde (CER), com dados FICTÍCIOS: o instrumento como dado, o cálculo pelo motor, as regras de
 * aplicar e fechar, o ciente, quem avalia e quem vê, e a auditoria.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { calcularEscore, dominiosDeMenorPercentual } from '@/capacidades/motor-avaliacao';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { ErroConflito, inserir, lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, Pessoas, RegistrosAuditoria, Servicos, Usuarios, VinculosServico } from '@/nucleo/estrutura/tabelas';
import { darCiente, desistirDaAplicacao, detalharAplicacao, listarAplicacoes, pessoasParaAvaliar, salvarAplicacao, type DadosAplicacao } from '../aplicacao/avaliacoes';
import { popularSaudeFicticia } from '../dados/ficticios';
import { Aplicacoes, Instrumentos, Respostas, TABELAS_SAUDE } from '../dados/tabelas';
import { ErroSaude, INSTRUMENTO_CER, notaDaFrequencia, recusaDePeriodo } from '../dominio/cer';
import { manifesto } from '../manifesto';

const AGORA = new Date('2026-11-06T15:00:00Z');

const respostas = (valores: number[]) => Object.fromEntries(valores.map((v, i) => [i + 1, v]));

describe('instrumento do CER (dado do motor)', () => {
  it('tem 10 itens, máximo de 30 pontos e três dimensões com a CIF de cada item', () => {
    expect(INSTRUMENTO_CER.itens).toHaveLength(10);
    expect(INSTRUMENTO_CER.itens.map((i) => i.dominio)).toEqual([...Array(4).fill('evolucao'), ...Array(2).fill('adequacao'), ...Array(4).fill('barreira')]);
    expect(INSTRUMENTO_CER.itens.map((i) => i.etiqueta)).toEqual(['b7/s7', 'd2', 'd3/b1', 'd2/b1', 'e5', 'e5', 'e5', 'b/s', 'e3', 'e1']);
  });

  it('total e subtotais: Evolução 0-12, Adequação 0-6, Barreira 0-12, e o total é a soma dos três', () => {
    const e = calcularEscore(INSTRUMENTO_CER, respostas([3, 3, 3, 3, 2, 2, 1, 1, 1, 1]));
    expect(e.dominios.map((d) => [d.codigo, d.pontos, d.maximo])).toEqual([['evolucao', 12, 12], ['adequacao', 4, 6], ['barreira', 4, 12]]);
    expect(e.total).toBe(20);
  });

  it('faixas com limites incluídos: 10/11 e 20/21', () => {
    const faixa = (total: number) => {
      // distribui o total pelos itens (máximo 3 por item)
      const v = Array(10).fill(0) as number[];
      let resto = total;
      for (let i = 0; i < 10 && resto > 0; i++) (v[i] = Math.min(3, resto)), (resto -= v[i]!);
      return calcularEscore(INSTRUMENTO_CER, respostas(v)).enquadramento!.nome;
    };
    expect(faixa(0)).toMatch(/^Não evoluindo/);
    expect(faixa(10)).toMatch(/^Não evoluindo/);
    expect(faixa(11)).toMatch(/^Evolução parcial/);
    expect(faixa(20)).toMatch(/^Evolução parcial/);
    expect(faixa(21)).toBe('Evoluindo adequadamente');
    expect(faixa(30)).toBe('Evoluindo adequadamente');
  });

  it('principal barreira: menor percentual do máximo da dimensão, com todas as empatadas', () => {
    // Evolução 12/12 = 100%, Adequação 3/6 = 50%, Barreira 6/12 = 50% → empate entre as duas
    const empate = calcularEscore(INSTRUMENTO_CER, respostas([3, 3, 3, 3, 2, 1, 2, 2, 1, 1]));
    expect(dominiosDeMenorPercentual(empate).map((d) => d.codigo)).toEqual(['adequacao', 'barreira']);
    // Em pontos brutos, Adequação (3) seria a menor; em percentual, Barreira (4/12 = 33%) é a menor.
    const so = calcularEscore(INSTRUMENTO_CER, respostas([3, 3, 3, 3, 2, 2, 1, 1, 1, 1]));
    expect(dominiosDeMenorPercentual(so).map((d) => d.codigo)).toEqual(['barreira']);
  });

  it('item 7: as quatro faixas de frequência sugerem a nota', () => {
    expect([0, 39, 40, 59, 60, 79, 80, 100].map(notaDaFrequencia)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    expect(notaDaFrequencia(101)).toBeNull();
    expect(notaDaFrequencia(-1)).toBeNull();
  });

  it('período: início antes do fim, sem datas futuras', () => {
    const ok = { periodoInicio: '2026-07-01', periodoFim: '2026-09-30', dataIngresso: '2026-01-10' };
    expect(recusaDePeriodo(ok, '2026-11-06')).toBeNull();
    expect(recusaDePeriodo({ ...ok, periodoInicio: '2026-10-01' }, '2026-11-06')).toMatch(/depois do fim/);
    expect(recusaDePeriodo({ ...ok, periodoFim: '2026-12-01' }, '2026-11-06')).toMatch(/futuro/);
    expect(recusaDePeriodo({ ...ok, dataIngresso: '2026-12-01' }, '2026-11-06')).toMatch(/ingresso/);
  });
});

describe('casos de uso', () => {
  let p: Planilhas;
  let pessoaId: string;

  async function como(email: string) {
    const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
    return new Autorizador(email, {
      usuarios: usuarios.ativos(),
      atribuicoes: atribuicoes.ativos(),
      perfilPermissoes: perfilPermissoes.ativos(),
      servicos: servicos.todos(),
    });
  }

  const dados = (x: Partial<DadosAplicacao> = {}): DadosAplicacao => ({
    pessoaId,
    servico: 'cer_reabilitacao',
    periodoInicio: '2026-07-01',
    periodoFim: '2026-09-30',
    dataIngresso: '2026-01-10',
    profissional: 'Fisioterapeuta (fictícia)',
    funcao: 'Fisioterapia',
    justificativa: 'Conforme a pontuação (fictício).',
    respostas: respostas([3, 2, 2, 3, 2, 2, 2, 2, 2, 2]),
    ...x,
  });

  beforeEach(async () => {
    p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'avaliacao_saude']), idDe: (c) => c };
    const permissoes = Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao })));
    await prepararEstrutura(p, { tabelas: [...TABELAS_SAUDE] as never, perfis: manifesto.perfis, permissoes });
    await popularDadosFicticios(p);
    const [vinculos] = await lerTabelas(p, [VinculosServico] as const);
    pessoaId = vinculos.ativos().find((v) => v.servico === 'cer_reabilitacao')!.pessoa_id;
  });

  it('o técnico do CER escolhe só pessoas e serviços da Saúde do seu escopo', async () => {
    const tecnico = await como('tecnico.cer@exemplo.local');
    const lista = await pessoasParaAvaliar(p, tecnico, { agora: AGORA });
    expect(lista.length).toBeGreaterThan(0);
    expect(lista.every((x) => x.servicos.every((s) => s.codigo === 'cer_reabilitacao'))).toBe(true);
    expect(lista.some((x) => x.id === pessoaId)).toBe(true);
  });

  it('salva e fecha com os 10 itens: grava só as notas, guarda o instrumento como dado e audita sem valores', async () => {
    const tecnico = await como('tecnico.cer@exemplo.local');
    const r = await salvarAplicacao(p, tecnico, dados(), { concluir: true, agora: AGORA });
    expect(r).toMatchObject({ total: 22, faixa: 'Evoluindo adequadamente', fechada: true });
    const reg = (await lerTabela(p, Aplicacoes)).porId(r.id)!;
    expect(reg).toMatchObject({ situacao: 'fechada', data_assinatura: '2026-11-06', versao_instrumento: 1, instrumento: 'cer' });
    expect(reg.servico_nome).toMatch(/Reabilitação/);
    expect((await lerTabela(p, Respostas)).ativos()).toHaveLength(10);
    expect((await lerTabela(p, Instrumentos)).ativos()).toHaveLength(1);
    const aud = (await lerTabela(p, RegistrosAuditoria)).todos();
    expect(aud.some((a) => a.entidade === 'saude.Aplicacoes' && a.registro_id === r.id && a.acao === 'inclusao')).toBe(true);
    expect(aud.every((a) => !/Fisioterap|Conforme/.test(a.detalhes ?? ''))).toBe(true);
  });

  it('a aplicação só fecha com os 10 itens, a justificativa, o profissional e a função', async () => {
    const tecnico = await como('tecnico.cer@exemplo.local');
    await expect(salvarAplicacao(p, tecnico, dados({ respostas: respostas([3, 2, 2]) }), { concluir: true, agora: AGORA })).rejects.toThrow(/Faltam responder/);
    await expect(salvarAplicacao(p, tecnico, dados({ justificativa: '  ' }), { concluir: true, agora: AGORA })).rejects.toThrow(/justificativa/);
    await expect(salvarAplicacao(p, tecnico, dados({ profissional: '' }), { concluir: true, agora: AGORA })).rejects.toThrow(/profissional/);
    expect((await lerTabela(p, Aplicacoes)).todos()).toHaveLength(0);
  });

  it('resposta fora de 0 a 3 não passa; rascunho pode ficar incompleto', async () => {
    const tecnico = await como('tecnico.cer@exemplo.local');
    await expect(salvarAplicacao(p, tecnico, dados({ respostas: { 1: 4 } }), { agora: AGORA })).rejects.toThrow(/0 a 3/);
    const r = await salvarAplicacao(p, tecnico, dados({ respostas: { 1: 2 }, justificativa: '' }), { agora: AGORA });
    expect(r).toMatchObject({ total: null, fechada: false });
  });

  it('período futuro é recusado', async () => {
    const tecnico = await como('tecnico.cer@exemplo.local');
    await expect(salvarAplicacao(p, tecnico, dados({ periodoFim: '2026-12-31' }), { agora: AGORA })).rejects.toThrow(/futuro/);
  });

  it('edita o rascunho com a versão lida, depois fecha; conflito não sobrescreve', async () => {
    const tecnico = await como('tecnico.cer@exemplo.local');
    const r = await salvarAplicacao(p, tecnico, dados({ respostas: { 1: 1 } }), { agora: AGORA });
    const lida = (await lerTabela(p, Aplicacoes)).porId(r.id)!;
    await expect(salvarAplicacao(p, tecnico, dados(), { id: r.id, versao: lida.versao + 5, agora: AGORA })).rejects.toThrow(ErroConflito);
    const f = await salvarAplicacao(p, tecnico, dados(), { id: r.id, versao: lida.versao, concluir: true, agora: AGORA });
    expect(f.fechada).toBe(true);
    expect((await lerTabela(p, Respostas)).ativos()).toHaveLength(10);
    expect((await lerTabela(p, Aplicacoes)).todos()).toHaveLength(1);
  });

  it('aplicação fechada não se edita nem se desiste', async () => {
    const tecnico = await como('tecnico.cer@exemplo.local');
    const r = await salvarAplicacao(p, tecnico, dados(), { concluir: true, agora: AGORA });
    const lida = (await lerTabela(p, Aplicacoes)).porId(r.id)!;
    await expect(salvarAplicacao(p, tecnico, dados({ justificativa: 'outra' }), { id: r.id, versao: lida.versao, agora: AGORA })).rejects.toThrow(/fechada/);
    await expect(desistirDaAplicacao(p, tecnico, r.id, lida.versao, 'engano', { agora: AGORA })).rejects.toThrow(/fechada/);
  });

  it('uma pessoa não tem duas aplicações abertas ao mesmo tempo', async () => {
    const tecnico = await como('tecnico.cer@exemplo.local');
    await salvarAplicacao(p, tecnico, dados({ respostas: { 1: 1 } }), { agora: AGORA });
    await expect(salvarAplicacao(p, tecnico, dados({ respostas: { 1: 2 } }), { agora: AGORA })).rejects.toThrow(/já tem uma avaliação aberta/);
  });

  it('corrigir cria nova aplicação ligada à anterior, que continua guardada; só uma correção por vez', async () => {
    const tecnico = await como('tecnico.cer@exemplo.local');
    const r = await salvarAplicacao(p, tecnico, dados(), { concluir: true, agora: AGORA });
    const nova = await salvarAplicacao(p, tecnico, dados({ respostas: respostas([3, 3, 3, 3, 3, 3, 3, 3, 3, 3]) }), { corrige: r.id, concluir: true, agora: AGORA });
    const t = await lerTabela(p, Aplicacoes);
    expect(t.porId(nova.id)!.corrige).toBe(r.id);
    expect(t.porId(r.id)).toMatchObject({ ativo: true, situacao: 'fechada' });
    expect((await detalharAplicacao(p, tecnico, r.id)).corrigida).toBe(true);
    await expect(salvarAplicacao(p, tecnico, dados(), { corrige: r.id, concluir: true, agora: AGORA })).rejects.toThrow(/já foi corrigida/);
    await expect(salvarAplicacao(p, tecnico, dados(), { corrige: 'nao-existe', agora: AGORA })).rejects.toThrow(ErroSaude);
  });

  it('desistir de uma aberta a deixa com ativo = FALSE e o motivo; nada é apagado', async () => {
    const tecnico = await como('tecnico.cer@exemplo.local');
    const r = await salvarAplicacao(p, tecnico, dados({ respostas: { 1: 1 } }), { agora: AGORA });
    const lida = (await lerTabela(p, Aplicacoes)).porId(r.id)!;
    await expect(desistirDaAplicacao(p, tecnico, r.id, lida.versao, ' ', { agora: AGORA })).rejects.toThrow(/motivo/);
    await desistirDaAplicacao(p, tecnico, r.id, lida.versao, 'lançada por engano', { agora: AGORA });
    const depois = (await lerTabela(p, Aplicacoes)).porId(r.id)!;
    expect(depois).toMatchObject({ ativo: false, motivo_desistencia: 'lançada por engano' });
    expect(await listarAplicacoes(p, tecnico)).toHaveLength(0);
    // com a anterior desistida, já pode começar outra
    await salvarAplicacao(p, tecnico, dados({ respostas: { 1: 2 } }), { agora: AGORA });
  });

  it('ciente: só coordenação ou Diretoria, só em fechada, uma vez, sem mexer nas respostas', async () => {
    const tecnico = await como('tecnico.cer@exemplo.local');
    const diretoria = await como('diretoria@exemplo.local');
    const aberta = await salvarAplicacao(p, tecnico, dados({ respostas: { 1: 1 } }), { agora: AGORA });
    const vAberta = (await lerTabela(p, Aplicacoes)).porId(aberta.id)!.versao;
    await expect(darCiente(p, diretoria, aberta.id, vAberta, { agora: AGORA })).rejects.toThrow(/concluída/);
    const r = await salvarAplicacao(p, tecnico, dados(), { id: aberta.id, versao: vAberta, concluir: true, agora: AGORA });
    const v = (await lerTabela(p, Aplicacoes)).porId(r.id)!.versao;
    await expect(darCiente(p, tecnico, r.id, v, { agora: AGORA })).rejects.toThrow(ErroPermissao);
    const antes = (await lerTabela(p, Respostas)).ativos().map((x) => x.valor);
    await darCiente(p, diretoria, r.id, v, { agora: AGORA });
    const reg = (await lerTabela(p, Aplicacoes)).porId(r.id)!;
    expect(reg.ciente_por).toBe('diretoria@exemplo.local');
    expect(reg.ciente_em).toBe(AGORA.toISOString());
    expect((await lerTabela(p, Respostas)).ativos().map((x) => x.valor)).toEqual(antes);
    await expect(darCiente(p, diretoria, r.id, reg.versao, { agora: AGORA })).rejects.toThrow(/já foi dado/);
  });

  it('abrir uma aplicação registra leitura e mostra total, subtotais, faixa e principal barreira', async () => {
    const tecnico = await como('tecnico.cer@exemplo.local');
    const r = await salvarAplicacao(p, tecnico, dados({ respostas: respostas([3, 3, 3, 3, 2, 2, 1, 1, 1, 1]) }), { concluir: true, agora: AGORA });
    const d = await detalharAplicacao(p, tecnico, r.id);
    expect(d.escore.total).toBe(20);
    expect(d.faixa?.nome).toMatch(/^Evolução parcial/);
    expect(d.principalBarreira.map((x) => x.codigo)).toEqual(['barreira']);
    expect(d.proximaAvaliacao).toBe('2027-11-06');
    const aud = (await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.acao === 'leitura' && a.registro_id === r.id);
    expect(aud).toHaveLength(1);
  });

  describe('quem avalia e quem vê', () => {
    it('Conselho, Financeiro e Administração não entram na avaliação', async () => {
      const tecnico = await como('tecnico.cer@exemplo.local');
      const r = await salvarAplicacao(p, tecnico, dados(), { concluir: true, agora: AGORA });
      for (const email of ['leitura@exemplo.local', 'financeiro@exemplo.local', 'admin@exemplo.local']) {
        const quem = await como(email);
        await expect(listarAplicacoes(p, quem)).rejects.toThrow(ErroPermissao);
        await expect(detalharAplicacao(p, quem, r.id)).rejects.toThrow(ErroPermissao);
        await expect(salvarAplicacao(p, quem, dados(), { agora: AGORA })).rejects.toThrow(ErroPermissao);
      }
    });

    it('coordenação de outra área (Educação) não vê nem avalia no CER', async () => {
      const tecnico = await como('tecnico.cer@exemplo.local');
      const r = await salvarAplicacao(p, tecnico, dados(), { concluir: true, agora: AGORA });
      const outra = await como('coord.educacao@exemplo.local');
      await expect(detalharAplicacao(p, outra, r.id)).rejects.toThrow(ErroPermissao);
      await expect(salvarAplicacao(p, outra, dados(), { agora: AGORA })).rejects.toThrow(ErroPermissao);
      expect(await listarAplicacoes(p, outra)).toHaveLength(0);
    });

    it('técnico de outro serviço de Saúde não vê pessoa do CER', async () => {
      const autor = { email: 'teste' };
      await inserir(p, Servicos, { codigo: 'outro_saude', nome: 'Outro serviço de Saúde (exemplo)', unidade: 'sede', area: 'saude', vagas: null, inicio: '2026-01-01', fim: null }, autor);
      const pessoa = await inserir(p, Pessoas, { nome: 'Técnica Outra (fictícia)', email: 'outra@exemplo.local' }, autor);
      await inserir(p, Usuarios, { email: 'outra@exemplo.local', pessoa_id: pessoa.id }, autor);
      await inserir(p, Atribuicoes, { usuario_email: 'outra@exemplo.local', perfil: 'tecnico_avaliador', escopo_tipo: 'servico', escopo: 'outro_saude' }, autor);
      const tecnico = await como('tecnico.cer@exemplo.local');
      const r = await salvarAplicacao(p, tecnico, dados(), { concluir: true, agora: AGORA });
      const outro = await como('outra@exemplo.local');
      await expect(detalharAplicacao(p, outro, r.id)).rejects.toThrow(ErroPermissao);
      expect(await listarAplicacoes(p, outro)).toHaveLength(0);
      expect(await pessoasParaAvaliar(p, outro, { agora: AGORA })).toHaveLength(0);
    });

    it('a Diretoria vê todos os serviços de Saúde e dá o ciente; coordenação do CER também', async () => {
      const tecnico = await como('tecnico.cer@exemplo.local');
      const r = await salvarAplicacao(p, tecnico, dados(), { concluir: true, agora: AGORA });
      const diretoria = await como('diretoria@exemplo.local');
      expect((await listarAplicacoes(p, diretoria)).map((l) => l.id)).toContain(r.id);
      expect((await detalharAplicacao(p, diretoria, r.id)).podeDarCiente).toBe(true);
      expect((await detalharAplicacao(p, tecnico, r.id)).podeDarCiente).toBe(false);
    });

    it('serviço que não é da área Saúde é recusado', async () => {
      const diretoria = await como('diretoria@exemplo.local');
      await expect(salvarAplicacao(p, diretoria, dados({ servico: 'ur' }), { agora: AGORA })).rejects.toThrow(/Saúde/);
    });
  });

  it('a demonstração tem avaliações fechadas, uma com ciente, e uma aberta', async () => {
    await popularSaudeFicticia(p);
    const diretoria = await como('diretoria@exemplo.local');
    const lista = await listarAplicacoes(p, diretoria);
    expect(lista.filter((l) => l.situacao === 'fechada').length).toBeGreaterThanOrEqual(3);
    expect(lista.some((l) => l.situacao === 'aberta')).toBe(true);
    expect(lista.some((l) => l.cienteEm)).toBe(true);
  });
});

describe('manifesto', () => {
  it('só Diretoria e coordenação dão o ciente; Conselho só vê o painel', () => {
    const por = manifesto.permissoesPorPerfil;
    expect(por.diretoria).toContain('saude.ciente');
    expect(por.coordenacao_servico).toContain('saude.ciente');
    expect(por.tecnico_avaliador).not.toContain('saude.ciente');
    expect(por.leitura).toEqual(['saude.acessar', 'saude.painel']);
  });
});
