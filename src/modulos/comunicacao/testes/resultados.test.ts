/**
 * Resultado das postagens do Instagram (Fase 4, #65): busca diária, prazo de 90 dias, falhas, permissão,
 * isolamento entre instituições e quem vê. Tudo FICTÍCIO, sem Meta de verdade.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArquivosMemoria } from '@/nucleo/armazenamento/arquivos';
import { inserir, lerTabela, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { conectarCredencial } from '@/nucleo/credenciais/credenciais';
import { PublicadorInstagramMemoria } from '@/nucleo/credenciais/instagram-publicacao';
import { RegistrosAuditoria } from '@/nucleo/estrutura/tabelas';
import { iniciarEnvioAnexoComunicacao } from '../aplicacao/anexos';
import { agendarPedido, decidirPedido, enviarPedido, publicarPedido, revisarPedido } from '../aplicacao/pedidos';
import { publicacaoDoPedido, rodarPublicacoes } from '../aplicacao/publicacoes';
import { rodarResultados, resultadoDasPostagens } from '../aplicacao/resultados';
import { HistoricoComunicacao, PedidosComunicacao, PublicacoesComunicacao } from '../dados/tabelas';
import { ErroComunicacao, type TipoPeca } from '../dominio/pedido';
import { proximaTentativa } from '../dominio/publicacao';
import { COMUNICACAO, COORDENACAO, como, FUNCIONARIO, planilhasDeComunicacao } from './apoio';

const SEGREDO = 'chave-mestra-de-teste-com-mais-de-32-caracteres';
const AGORA = new Date('2026-11-20T12:00:00Z');
const HORA = '2026-11-20T15:00:00-03:00'; // 18h UTC
const APOS_HORA = new Date('2026-11-20T18:05:00Z');
const MIN = 60_000;
const URL_BASE = 'https://elo.exemplo.local';
let p: Planilhas;
let arq: ArquivosMemoria;
let pub: PublicadorInstagramMemoria;

const ctx = (instituicao = 'exemplo', publicador = pub) => ({ instituicao, publicador, urlBase: URL_BASE, segredo: SEGREDO });
const pedidoDe = async (id: string) => (await lerTabela(p, PedidosComunicacao)).porId(id)!;
const pubsDe = async (id: string) => (await lerTabela(p, PublicacoesComunicacao)).todos().filter((x) => x.pedido_id === id);
const historicoDe = async (id: string) => (await lerTabela(p, HistoricoComunicacao)).todos().filter((h) => h.pedido_id === id);

beforeEach(async () => {
  process.env.ELO_CHAVE_CREDENCIAIS = SEGREDO;
  p = await planilhasDeComunicacao();
  arq = new ArquivosMemoria();
  pub = new PublicadorInstagramMemoria();
});

async function conectar(instituicao = 'exemplo', usuario = 'conta_a') {
  await conectarCredencial(p, await como(p, COORDENACAO), 'comunicacao.configurar', { instituicao, servico: 'instagram', conta: usuario, valor: `token-${instituicao}`, venceEm: new Date(AGORA.getTime() + 60 * 86400000) }, { agora: AGORA, segredo: SEGREDO });
}

async function foto(mime = 'image/jpeg') {
  const { url } = await iniciarEnvioAnexoComunicacao(p, await como(p, FUNCIONARIO), arq, { tipo: 'foto', mime, tamanho: 50, origem: 'http://localhost' });
  const g = arq.receber(url.replace('/envio/', ''), new Uint8Array(50).fill(9));
  return { arquivoId: g.id, tipo: 'foto' as const };
}

async function video(mime = 'video/mp4') {
  const { url } = await iniciarEnvioAnexoComunicacao(p, await como(p, FUNCIONARIO), arq, { tipo: 'video', mime, tamanho: 80, origem: 'http://localhost' });
  const g = arq.receber(url.replace('/envio/', ''), new Uint8Array(80).fill(5));
  return { arquivoId: g.id, tipo: 'video' as const };
}

/** Pedido aprovado (post por padrão, com uma foto JPG). */
async function aprovado(opcoes: { tipo?: TipoPeca; comFoto?: boolean; mime?: string; descricao?: string; anexos?: { arquivoId: string; tipo: 'foto' | 'video' }[] } = {}) {
  const comFoto = opcoes.comFoto ?? true;
  const { id } = await enviarPedido(
    p,
    await como(p, FUNCIONARIO),
    {
      area: 'educacao', calendarioId: null, tipoPeca: opcoes.tipo ?? 'post_instagram', titulo: 'Convite', descricao: opcoes.descricao ?? 'Legenda fictícia.',
      dataDesejada: '2026-11-25', linkVideo: null, imagemConfirmada: comFoto || Boolean(opcoes.anexos), nomeSolicitante: 'Pessoa', anexos: opcoes.anexos ?? (comFoto ? [await foto(opcoes.mime)] : []),
    },
    { agora: AGORA, arquivos: arq },
  );
  const c = await como(p, COMUNICACAO);
  await revisarPedido(p, c, id, (await pedidoDe(id)).versao, 'iniciar_revisao', null, { agora: AGORA });
  await revisarPedido(p, c, id, (await pedidoDe(id)).versao, 'enviar_aprovacao', null, { agora: AGORA });
  await decidirPedido(p, await como(p, COORDENACAO), id, (await pedidoDe(id)).versao, 'aprovar', null, { agora: AGORA });
  return id;
}

const agendar = async (id: string, publicarPeloElo = true, quando = HORA, inst = 'exemplo') =>
  agendarPedido(p, await como(p, COMUNICACAO), id, (await pedidoDe(id)).versao, { agendadoPara: quando, grupos: [], contatos: [], publicarPeloElo }, { agora: AGORA, instituicao: inst });

async function agendadoPeloElo() {
  await conectar();
  const id = await aprovado();
  await agendar(id);
  return id;
}


const DIA_DEPOIS = new Date('2026-11-21T06:30:00Z'); // 3h30 em Brasília
const rodar = (agora = DIA_DEPOIS, inst = 'exemplo', publicador = pub) => rodarResultados(p, { instituicao: inst, publicador, segredo: SEGREDO }, agora);

async function publicado() {
  await conectar();
  const id = await aprovado();
  await agendar(id);
  await rodarPublicacoes(p, ctx(), APOS_HORA);
  await rodarPublicacoes(p, ctx(), new Date(APOS_HORA.getTime() + MIN));
  const x = (await pubsDe(id))[0];
  expect(x.situacao).toBe('publicada');
  return { id, postId: x.post_id! };
}

describe('busca diária do resultado', () => {
  it('grava os quatro números e a hora, sem mexer no pedido nem no histórico', async () => {
    const { id, postId } = await publicado();
    pub.resultados.set(postId, { alcance: 1240, curtidas: 86, comentarios: 5, salvamentos: 12 });
    const antes = { pedido: await pedidoDe(id), historico: (await historicoDe(id)).length };
    expect(await rodar()).toEqual({ atualizadas: 1 });
    expect((await pubsDe(id))[0]).toMatchObject({ alcance: 1240, curtidas: 86, comentarios: 5, salvamentos: 12, metricas_em: DIA_DEPOIS.toISOString() });
    expect(await pedidoDe(id)).toEqual(antes.pedido);
    expect((await historicoDe(id)).length).toBe(antes.historico);
    const pubId = (await pubsDe(id))[0].id;
    const aud = (await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.registro_id === pubId && a.usuario === 'sistema');
    expect(JSON.stringify(aud.at(-1))).not.toMatch(/1240/);
  });

  it('rodar de novo no mesmo dia não busca de novo; no dia seguinte busca', async () => {
    const { postId } = await publicado();
    await rodar();
    await rodar(new Date(DIA_DEPOIS.getTime() + 15 * MIN));
    expect(pub.buscasDeResultado.filter((x) => x === postId)).toHaveLength(1);
    await rodar(new Date(DIA_DEPOIS.getTime() + 24 * 60 * MIN));
    expect(pub.buscasDeResultado).toHaveLength(2);
  });

  it('número que a Meta não devolve não apaga o anterior', async () => {
    const { id, postId } = await publicado();
    await rodar();
    pub.resultados.set(postId, { alcance: 2000, curtidas: null, comentarios: null, salvamentos: null });
    await rodar(new Date(DIA_DEPOIS.getTime() + 24 * 60 * MIN));
    expect((await pubsDe(id))[0]).toMatchObject({ alcance: 2000, curtidas: 86, comentarios: 5, salvamentos: 12 });
  });

  it('depois de 90 dias publicada, não busca mais e os números ficam', async () => {
    const { id } = await publicado();
    await rodar();
    const longe = new Date(DIA_DEPOIS.getTime() + 91 * 24 * 60 * MIN);
    expect(await rodar(longe)).toEqual({});
    expect(pub.buscasDeResultado).toHaveLength(1);
    expect((await pubsDe(id))[0].alcance).toBe(1240);
  });

  it('post apagado na Meta só pula aquela publicação', async () => {
    const { id, postId } = await publicado();
    pub.postsRecusados.add(postId);
    expect(await rodar()).toEqual({ puladas: 1 });
    expect((await pubsDe(id))[0].metricas_em).toBeNull();
    expect((await pubsDe(id))[0].metricas_aviso).toBeNull();
  });

  it('conta sem permissão de leitura: registra o aviso da conta e a tela explica', async () => {
    const { id } = await publicado();
    pub.semPermissaoDeResultado = true;
    expect(await rodar()).toEqual({ sem_permissao: 1 });
    expect((await pubsDe(id))[0].metricas_aviso).toBe('sem_permissao');
    const v = await publicacaoDoPedido(p, await como(p, COMUNICACAO), id, DIA_DEPOIS);
    expect(v?.resultado).toMatchObject({ numeros: null, aviso: expect.stringMatching(/reconectar o Instagram/) });
    // Depois de reconectar, o aviso some.
    pub.semPermissaoDeResultado = false;
    await rodar(new Date(DIA_DEPOIS.getTime() + 15 * MIN));
    expect((await pubsDe(id))[0].metricas_aviso).toBeNull();
    expect((await publicacaoDoPedido(p, await como(p, COMUNICACAO), id, DIA_DEPOIS))?.resultado?.numeros?.alcance).toBe(1240);
  });

  it('sem número ainda, a tela diz que não está disponível (nunca zero)', async () => {
    const { id } = await publicado();
    const v = await publicacaoDoPedido(p, await como(p, COMUNICACAO), id, DIA_DEPOIS);
    expect(v?.resultado).toEqual({ numeros: null, atualizadoEm: null, aviso: 'Resultado ainda não disponível.' });
  });

  it('conta vencida ou desconectada fica de fora da rodada, sem erro', async () => {
    await publicado();
    const longe = new Date(DIA_DEPOIS.getTime() + 90 * 24 * 60 * MIN);
    expect(await rodar(longe)).toEqual({});
    expect(pub.buscasDeResultado).toHaveLength(0);
    expect(await rodar(DIA_DEPOIS, 'outra')).toEqual({ aguardando_conta: 1 });
  });

  it('o isolamento: a busca de outra instituição não usa publicação nem token desta', async () => {
    await publicado();
    expect(await rodar(DIA_DEPOIS, 'outra')).toEqual({ aguardando_conta: 1 });
    expect(pub.buscasDeResultado).toHaveLength(0);
  });
});

describe('quem vê o resultado', () => {
  it('Indicadores: só quem tem comunicacao.indicadores; lista por período e média por tipo', async () => {
    const { id } = await publicado();
    await rodar();
    const periodo = { inicio: '2026-11-01', fim: '2026-11-30' };
    const r = await resultadoDasPostagens(p, await como(p, COORDENACAO), periodo);
    expect(r.linhas).toHaveLength(1);
    expect(r.linhas[0]).toMatchObject({ tipo: 'post', alcance: 1240 });
    expect(r.medias).toEqual([{ tipo: 'post', nome: 'Post', alcanceMedio: 1240, postagens: 1 }]);
    expect((await resultadoDasPostagens(p, await como(p, COORDENACAO), { inicio: '2026-12-01', fim: '2026-12-31' })).linhas).toHaveLength(0);
    await expect(resultadoDasPostagens(p, await como(p, FUNCIONARIO), periodo)).rejects.toBeInstanceOf(ErroPermissao);
    expect(await publicacaoDoPedido(p, await como(p, FUNCIONARIO), id)).toBeNull();
  });
});
