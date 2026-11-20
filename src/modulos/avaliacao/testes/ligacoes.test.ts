/**
 * Ligação das avaliações antigas à pessoa do Cadastro Único (issue #62, entrega 3), com dados FICTÍCIOS:
 * sugestão, confirmação, comparativo por pessoa, quem confirma e auditoria.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { lerTabela, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, Pessoas, RegistrosAuditoria, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { pessoasParaAplicar } from '../aplicacao/aplicacoes';
import { historicoDaPessoa, listarAvaliacoes, salvarAvaliacao } from '../aplicacao/avaliacoes';
import { avaliacoesParaLigar, confirmarLigacao, desfazerLigacao } from '../aplicacao/ligacoes';
import { Avaliacoes, LigacoesPessoa, TABELAS_AVALIACAO } from '../dados/tabelas';
import { iniciaisDoNome } from '../dominio/aplicacao';
import { ErroAvaliacao, type DadosAvaliacao } from '../dominio/avaliacao';
import { manifesto } from '../manifesto';

const AGORA = new Date('2026-11-06T15:00:00Z');

const completa = (x: Partial<DadosAvaliacao>): DadosAvaliacao => ({
  tipo: 'Inicial',
  iniciais: 'XX',
  nascimento: '1958-03-02',
  sexo: 'F',
  prontuario: '',
  servico: 'ur',
  data_avaliacao: '2026-03-03',
  evolucao_usuario: 'Manteve',
  evolucao_familia: 'Manteve',
  cuidador: 'Filha',
  bpc: 'Sim',
  mae_solo: 'Não',
  rede_apoio: 'Sim',
  cuidador_idoso: 'Não',
  nucleo_mais_pcd: 'Não',
  adultos_30: 'Sim',
  isolamento: 'Não',
  enfermagem: 'Não',
  grau_deficiencia: 'Moderada',
  grau_dependencia: 'II',
  ostomia: 'Não',
  ostomia_tipo: '',
  transporte: 'Comum',
  barreiras: ['nenhuma'],
  observacoes: '',
  profissional: '',
  registro_profissional: '',
  ...x,
});

describe('ligação das avaliações antigas', () => {
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

  /** Uma pessoa fictícia da UR e uma avaliação antiga dela por iniciais (a data de nascimento pode não bater). */
  async function pessoaEAvaliacoes(quantas = 2, nascimento?: string) {
    const coord = await como('coord.ur@exemplo.local');
    const pessoa = (await pessoasParaAplicar(p, coord, { agora: AGORA }))[0]!;
    const [pessoas] = await lerTabelas(p, [Pessoas] as const);
    const cadastro = pessoas.porId(pessoa.id)!;
    const ids: string[] = [];
    for (let i = 0; i < quantas; i++) {
      const r = await salvarAvaliacao(
        p,
        coord,
        completa({
          iniciais: pessoa.iniciais,
          nascimento: nascimento ?? cadastro.data_nascimento ?? '1958-03-02',
          data_avaliacao: `2026-0${3 + i}-03`,
          tipo: i === 0 ? 'Inicial' : 'Acompanhamento anual',
        }),
        { agora: AGORA },
      );
      ids.push(r.id);
    }
    return { coord, pessoa, ids, cadastro };
  }

  beforeEach(async () => {
    p = { armazenamento: new ArmazenamentoMemoria(['nucleo', 'auditoria', 'avaliacao_assistencia']), idDe: (c) => c };
    const permissoes = Object.entries(manifesto.permissoesPorPerfil).flatMap(([perfil, l]) => l.map((permissao) => ({ perfil, permissao })));
    await prepararEstrutura(p, { tabelas: [...TABELAS_AVALIACAO] as never, perfis: manifesto.perfis, permissoes });
    await popularDadosFicticios(p);
  });

  it('lista as avaliações sem ligação, com a pessoa sugerida quando iniciais e nascimento batem', async () => {
    const { coord, pessoa, ids, cadastro } = await pessoaEAvaliacoes();
    const lista = await avaliacoesParaLigar(p, coord, { agora: AGORA });
    const a = lista.find((x) => x.id === ids[0])!;
    expect(a.candidatas.map((c) => c.id)).toContain(pessoa.id);
    expect(a.candidatas[0]!.combina).toBe(true);
    expect([pessoa.id, null]).toContain(a.sugerida);
    if (cadastro.data_nascimento && a.candidatas.filter((c) => c.combina).length === 1) expect(a.sugerida).toBe(pessoa.id);
  });

  it('sem pessoa de iniciais iguais, não sugere ninguém', async () => {
    const coord = await como('coord.ur@exemplo.local');
    await salvarAvaliacao(p, coord, completa({ iniciais: 'QQQQ' }), { agora: AGORA });
    const [a] = await avaliacoesParaLigar(p, coord, { agora: AGORA });
    expect(a!.sugerida).toBeNull();
  });

  it('confirmar grava a ligação, audita e não altera a avaliação original', async () => {
    const { coord, pessoa, ids } = await pessoaEAvaliacoes();
    const antes = (await lerTabela(p, Avaliacoes)).porId(ids[0]!)!;
    await confirmarLigacao(p, coord, ids[0]!, pessoa.id, { agora: AGORA });
    const depois = (await lerTabela(p, Avaliacoes)).porId(ids[0]!)!;
    expect(depois).toEqual(antes);
    const ligacoes = (await lerTabela(p, LigacoesPessoa)).ativos();
    expect(ligacoes).toHaveLength(1);
    expect(ligacoes[0]).toMatchObject({ avaliacao_id: ids[0], pessoa_id: pessoa.id, criado_por: 'coord.ur@exemplo.local' });
    const auditoria = (await lerTabela(p, RegistrosAuditoria)).todos().filter((r) => r.entidade === 'avaliacao.LigacoesPessoa');
    expect(auditoria.map((r) => r.acao)).toEqual(['inclusao']);
    expect(JSON.stringify(auditoria)).not.toContain(pessoa.id);
    const restantes = await avaliacoesParaLigar(p, coord, { agora: AGORA });
    expect(restantes.map((x) => x.id)).not.toContain(ids[0]);
    await expect(confirmarLigacao(p, coord, ids[0]!, pessoa.id)).rejects.toThrow(/já está ligada/);
  });

  it('o comparativo passa a usar a pessoa do Cadastro Único quando há ligação', async () => {
    const coord = await como('coord.ur@exemplo.local');
    const pessoa = (await pessoasParaAplicar(p, coord, { agora: AGORA }))[0]!;
    // Duas avaliações com iniciais diferentes (erro de digitação) da mesma pessoa e uma de outra com as mesmas iniciais.
    const a1 = await salvarAvaliacao(p, coord, completa({ iniciais: pessoa.iniciais, data_avaliacao: '2026-03-03' }), { agora: AGORA });
    const a2 = await salvarAvaliacao(p, coord, completa({ iniciais: `${pessoa.iniciais}Z`, nascimento: '1959-01-01', data_avaliacao: '2026-06-03' }), { agora: AGORA });
    const a3 = await salvarAvaliacao(p, coord, completa({ iniciais: pessoa.iniciais, nascimento: '1970-05-05', data_avaliacao: '2026-07-03' }), { agora: AGORA });
    let h = await historicoDaPessoa(p, coord, a1.id, { agora: AGORA });
    expect(h.avaliacoes).toHaveLength(1);
    expect(h.ligada).toBe(false);
    await confirmarLigacao(p, coord, a1.id, pessoa.id, { agora: AGORA });
    await confirmarLigacao(p, coord, a2.id, pessoa.id, { agora: AGORA });
    h = await historicoDaPessoa(p, coord, a2.id, { agora: AGORA });
    expect(h.ligada).toBe(true);
    expect(h.avaliacoes.map((x) => x.id)).toEqual([a1.id, a2.id]);
    const linhas = await listarAvaliacoes(p, coord, { agora: AGORA });
    expect(linhas.find((l) => l.id === a1.id)).toMatchObject({ ligada: true, avaliacoesDaPessoa: 2 });
    expect(linhas.find((l) => l.id === a3.id)).toMatchObject({ ligada: false, avaliacoesDaPessoa: 1 });
    expect((await historicoDaPessoa(p, coord, a3.id, { agora: AGORA })).avaliacoes).toHaveLength(1);
  });

  it('só quem avalia no serviço da avaliação confirma; pessoa de outro serviço é recusada', async () => {
    const { pessoa, ids } = await pessoaEAvaliacoes(1);
    const tecnicoCer = await como('tecnico.cer@exemplo.local');
    await expect(confirmarLigacao(p, tecnicoCer, ids[0]!, pessoa.id)).rejects.toThrow(ErroPermissao);
    expect(await avaliacoesParaLigar(p, tecnicoCer, { agora: AGORA })).toEqual([]);
    const dir = await como('diretoria@exemplo.local');
    const doCer = (await pessoasParaAplicar(p, tecnicoCer, { agora: AGORA }))[0]!;
    await expect(confirmarLigacao(p, dir, ids[0]!, doCer.id)).rejects.toThrow(ErroAvaliacao);
    await expect(confirmarLigacao(p, dir, ids[0]!, 'inexistente')).rejects.toThrow(ErroAvaliacao);
    await expect(confirmarLigacao(p, dir, ids[0]!, '')).rejects.toThrow(/Escolha a pessoa/);
    await confirmarLigacao(p, dir, ids[0]!, pessoa.id, { agora: AGORA });
  });

  it('Conselho, Financeiro e Administração não veem nem confirmam', async () => {
    const { pessoa, ids } = await pessoaEAvaliacoes(1);
    for (const email of ['leitura@exemplo.local', 'financeiro@exemplo.local', 'admin@exemplo.local']) {
      const quem = await como(email);
      await expect(avaliacoesParaLigar(p, quem)).rejects.toThrow(ErroPermissao);
      await expect(confirmarLigacao(p, quem, ids[0]!, pessoa.id)).rejects.toThrow(ErroPermissao);
      await expect(desfazerLigacao(p, quem, ids[0]!)).rejects.toThrow(ErroPermissao);
    }
  });

  it('desfazer deixa a ligação inativa (nada é apagado) e a avaliação volta à lista', async () => {
    const { coord, pessoa, ids } = await pessoaEAvaliacoes(1);
    await expect(desfazerLigacao(p, coord, ids[0]!)).rejects.toThrow(/não está ligada/);
    await confirmarLigacao(p, coord, ids[0]!, pessoa.id, { agora: AGORA });
    await desfazerLigacao(p, coord, ids[0]!, { agora: AGORA });
    const todas = (await lerTabela(p, LigacoesPessoa)).todos();
    expect(todas).toHaveLength(1);
    expect(todas[0]!.ativo).toBe(false);
    expect((await avaliacoesParaLigar(p, coord, { agora: AGORA })).map((x) => x.id)).toContain(ids[0]);
    const auditoria = (await lerTabela(p, RegistrosAuditoria)).todos().filter((r) => r.entidade === 'avaliacao.LigacoesPessoa');
    expect(auditoria.map((r) => r.acao)).toEqual(['inclusao', 'encerramento']);
    // Pode ligar de novo, a outra pessoa.
    await confirmarLigacao(p, coord, ids[0]!, pessoa.id, { agora: AGORA });
  });

  it('iniciais mostradas vêm do nome sem exibi-lo', () => {
    expect(iniciaisDoNome('Maria da Silva')).toBe('MS');
  });
});
