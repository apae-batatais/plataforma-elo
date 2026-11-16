import { beforeAll, describe, expect, it } from 'vitest';
import { Autorizador, ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArmazenamentoMemoria } from '@/nucleo/armazenamento/memoria';
import { idsPrevisiveis } from '@/nucleo/armazenamento/ids-previsiveis';
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { popularDadosFicticios } from '@/nucleo/estrutura/dados-ficticios';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { Atribuicoes, PerfilPermissoes, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { conferirIds } from '@/capacidades/indicadores';
import { manifesto as manifestoComunicacao } from '@/modulos/comunicacao';
import { indicadoresDaPlataforma as indicadoresComunicacao } from '@/modulos/comunicacao/aplicacao/indicadores-plataforma';
import { indicadoresComunicacao as telaComunicacao } from '@/modulos/comunicacao/aplicacao/indicadores';
import { periodoDe } from '@/modulos/comunicacao/dominio/indicadores';
import { manifesto as manifestoOrcamento } from '@/modulos/orcamento';
import { indicadoresDaPlataforma as indicadoresOrcamento } from '@/modulos/orcamento/aplicacao/indicadores-plataforma';
import { painelGeral } from '@/modulos/orcamento/aplicacao/painel-geral';
import { manifesto as manifestoRequisicoes } from '@/modulos/requisicoes';
import { indicadoresDaPlataforma as indicadoresRequisicoes } from '@/modulos/requisicoes/aplicacao/indicadores-plataforma';
import { painelDePrazos } from '@/modulos/requisicoes/aplicacao/requisicoes';
import { navegacaoDoUsuario } from '@/plataforma/navegacao';
import { anoDoPainel, painelDeIndicadores, type FonteDeIndicadores } from '@/plataforma/indicadores';
import { ESTRUTURA_DOS_MODULOS, MODULOS, popularDemonstracaoDosModulos, TABELAS_DOS_MODULOS } from '@/plataforma/registro-modulos';

let p: Planilhas;
const AGORA = new Date('2026-11-14T15:00:00Z');
const PERIODO = { ano: 2026, agora: AGORA };

beforeAll(async () => {
  const chaves = ['nucleo', 'auditoria', ...new Set(TABELAS_DOS_MODULOS.map((t) => t.planilha))];
  p = { armazenamento: new ArmazenamentoMemoria(chaves), idDe: (c) => c, novoId: idsPrevisiveis('teste') };
  await prepararEstrutura(p, ESTRUTURA_DOS_MODULOS, 'sistema', []);
  await popularDadosFicticios(p);
  await popularDemonstracaoDosModulos(p);
});

async function como(email: string) {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  return new Autorizador(email, { usuarios: usuarios.ativos(), atribuicoes: atribuicoes.ativos(), perfilPermissoes: perfilPermissoes.ativos(), servicos: servicos.todos() });
}

const ids = (l: { definicao: { id: string } }[]) => l.map((i) => i.definicao.id);
const porId = <T extends { definicao: { id: string } }>(l: T[], id: string) => l.find((i) => i.definicao.id === id)!;

describe('painel de indicadores: quem vê', () => {
  it('a Diretoria vê os três apps', async () => {
    const blocos = await painelDeIndicadores(p, await como('diretoria@exemplo.local'), PERIODO);
    expect(blocos.map((b) => [b.id, b.estado])).toEqual([['orcamento', 'ok'], ['requisicoes', 'ok'], ['comunicacao', 'ok']]);
  });

  it.each(['admin@exemplo.local', 'coord.ur@exemplo.local', 'financeiro@exemplo.local', 'leitura@exemplo.local', 'tecnico.cer@exemplo.local', 'funcionario@exemplo.local'])(
    '%s não abre o painel',
    async (email) => {
      await expect(painelDeIndicadores(p, await como(email), PERIODO)).rejects.toBeInstanceOf(ErroPermissao);
    },
  );

  it('um app que a Diretoria não pode ler fica avisado, sem ampliar o acesso', async () => {
    const dir = await como('diretoria@exemplo.local');
    const semAcesso: FonteDeIndicadores = { id: 'x', nome: 'X', rota: '/x', calcular: async () => { throw new ErroPermissao(); } };
    const [bloco] = await painelDeIndicadores(p, dir, PERIODO, { fontes: [semAcesso] });
    expect(bloco).toMatchObject({ estado: 'sem_acesso', indicadores: [] });
  });

  it('falha de um app não derruba os outros', async () => {
    const dir = await como('diretoria@exemplo.local');
    const quebrado: FonteDeIndicadores = { id: 'q', nome: 'Q', rota: '/q', calcular: async () => { throw new Error('falhou'); } };
    const ok: FonteDeIndicadores = { id: 'o', nome: 'O', rota: '/o', calcular: async () => [] };
    const blocos = await painelDeIndicadores(p, dir, PERIODO, { fontes: [quebrado, ok] });
    expect(blocos.map((b) => b.estado)).toEqual(['falhou', 'ok']);
  });

  it('app desligado fica fora do painel', async () => {
    const blocos = await painelDeIndicadores(p, await como('diretoria@exemplo.local'), PERIODO, { desligados: new Set(['orcamento']) });
    expect(blocos.map((b) => b.id)).toEqual(['requisicoes', 'comunicacao']);
  });

  it('a permissão nova existe só no perfil Diretoria e o item do menu segue a permissão', async () => {
    const [perfilPermissoes] = await lerTabelas(p, [PerfilPermissoes] as const);
    const perfis = perfilPermissoes.ativos().filter((x) => x.permissao === 'plataforma.indicadores.ver').map((x) => x.perfil);
    expect(perfis).toEqual(['diretoria']);
    const itens = async (email: string) => navegacaoDoUsuario(await como(email), false).flatMap((g) => g.itens.map((i) => i.href));
    expect(await itens('diretoria@exemplo.local')).toContain('/indicadores');
    for (const e of ['admin@exemplo.local', 'financeiro@exemplo.local', 'leitura@exemplo.local']) expect(await itens(e)).not.toContain('/indicadores');
  });
});

describe('ids batem com o manifesto', () => {
  it('Requisições, Comunicação e Orçamento', async () => {
    const dir = await como('diretoria@exemplo.local');
    expect(conferirIds(ids(await indicadoresRequisicoes(p, dir, PERIODO)), manifestoRequisicoes.indicadores, ['requisicoes_aprovacao_no_prazo', 'requisicoes_atendimento_no_prazo'])).toEqual([]);
    expect(
      conferirIds(ids(await indicadoresComunicacao(p, dir, PERIODO)), manifestoComunicacao.indicadores, [
        'comunicacao_volume', 'comunicacao_tempo_revisao', 'comunicacao_tempo_aprovacao', 'comunicacao_tempo_publicacao', 'comunicacao_publicados_com_atraso', 'comunicacao_urgentes',
      ]),
    ).toEqual([]);
    expect(conferirIds(ids(await indicadoresOrcamento(p, dir)), manifestoOrcamento.indicadores, ['folha_sobre_receita', 'dependencia_recursos_publicos', 'recursos_livres', 'resultado_previsto'])).toEqual([]);
  });
});

describe('o painel mostra o mesmo número da tela de cada app', () => {
  it('Requisições', async () => {
    const dir = await como('diretoria@exemplo.local');
    const painel = await painelDePrazos(p, dir, { de: '2026-01', ate: '2026-12' }, { agora: AGORA });
    const r = await indicadoresRequisicoes(p, dir, PERIODO);
    const ap = porId(r, 'requisicoes_aprovacao_no_prazo');
    expect(ap.pontos).toHaveLength(12);
    painel.porMes.forEach((m, i) => expect(ap.pontos[i].valor).toBe(m.aprovacao.pct));
    expect(ap.pontos.some((x) => x.valor !== null)).toBe(true);
    const comDado = ap.pontos.find((x) => x.valor !== null)!;
    expect(comDado.base).toMatch(/^\d+ de \d+$/);
    // Sem dado no mês: null (nunca 0) e sem base.
    const vazio = ap.pontos.find((x) => x.valor === null);
    expect(vazio?.base).toBeUndefined();
  });

  it('Comunicação (mês a mês, igual à tela de Indicadores)', async () => {
    const dir = await como('diretoria@exemplo.local');
    const c = await indicadoresComunicacao(p, dir, PERIODO);
    for (const mes of ['2026-08', '2026-09', '2026-10']) {
      const tela = await telaComunicacao(p, dir, periodoDe('mes', mes));
      const idx = Number(mes.slice(5)) - 1;
      expect(porId(c, 'comunicacao_volume').pontos[idx].valor).toBe(tela.volume.total);
      expect(porId(c, 'comunicacao_urgentes').pontos[idx].valor).toBe(tela.urgentes);
      expect(porId(c, 'comunicacao_tempo_aprovacao').pontos[idx].valor).toBe(tela.tempoAprovacao);
      expect(porId(c, 'comunicacao_tempo_publicacao').pontos[idx].valor).toBe(tela.tempoPublicacao);
      expect(porId(c, 'comunicacao_tempo_revisao').pontos[idx].valor).toBe(tela.tempoRevisao);
      expect(porId(c, 'comunicacao_publicados_com_atraso').pontos[idx].valor).toBe(tela.publicadosComAtraso.percentual);
    }
  });

  it('Comunicação: mês futuro é "sem dados" e o corrente é parcial', async () => {
    const c = await indicadoresComunicacao(p, await como('diretoria@exemplo.local'), PERIODO);
    const volume = porId(c, 'comunicacao_volume').pontos;
    expect(volume[11].valor).toBeNull(); // dezembro, ainda não chegou
    expect(volume[10].parcial).toBe(true); // novembro
    expect(volume[9].parcial).toBe(false);
  });

  it('Orçamento (um ponto por exercício, igual ao Painel geral)', async () => {
    const dir = await como('diretoria@exemplo.local');
    const geral = await painelGeral(p, dir);
    const o = await indicadoresOrcamento(p, dir);
    expect(porId(o, 'folha_sobre_receita').pontos.map((x) => x.periodo)).toEqual(geral.anos.map((a) => String(a.ano)));
    geral.anos.forEach((a, i) => {
      expect(porId(o, 'folha_sobre_receita').pontos[i].valor).toBe(a.indicadores.folhaSobreReceita);
      expect(porId(o, 'resultado_previsto').pontos[i].valor).toBe(a.indicadores.resultado);
      expect(porId(o, 'recursos_livres').pontos[i].valor).toBe(a.indicadores.recursosLivres);
      expect(porId(o, 'dependencia_recursos_publicos').pontos[i].valor).toBe(a.indicadores.dependenciaPublica);
    });
  });
});

describe('cada app confere a própria permissão', () => {
  it('sem permissão no app, o módulo recusa', async () => {
    const leitura = await como('leitura@exemplo.local');
    await expect(indicadoresComunicacao(p, leitura, PERIODO)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(indicadoresRequisicoes(p, await como('funcionario@exemplo.local'), PERIODO)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(indicadoresOrcamento(p, await como('funcionario@exemplo.local'))).rejects.toBeInstanceOf(ErroPermissao);
  });
});

describe('ano do painel', () => {
  it('ano inválido volta ao atual', () => {
    expect(anoDoPainel(undefined, AGORA)).toBe(2026);
    expect(anoDoPainel('abc', AGORA)).toBe(2026);
    expect(anoDoPainel('1850', AGORA)).toBe(2026);
    expect(anoDoPainel('2025', AGORA)).toBe(2025);
  });
});

describe('módulos ativos', () => {
  it('todo app do painel existe na composição', () => {
    const ativos = MODULOS.map((m) => m.id);
    for (const id of ['orcamento', 'requisicoes', 'comunicacao']) expect(ativos).toContain(id);
  });
});
