/**
 * Instagram da Comunicação, entrega 2 (ADR-028): publicar post com imagem na hora marcada, mídia temporária,
 * falhas e "Tentar de novo", isolamento entre instituições e quem pode o quê. Tudo FICTÍCIO, sem Meta de verdade.
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
import {
  abrirMidiaTemporaria,
  instituicaoDoCodigo,
  problemasDePublicacao,
  publicacaoAutomaticaDisponivel,
  publicacaoDoPedido,
  rodarPublicacoes,
  tentarDeNovo,
} from '../aplicacao/publicacoes';
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

/** Pedido aprovado (post por padrão, com uma foto JPG). */
async function aprovado(opcoes: { tipo?: TipoPeca; comFoto?: boolean; mime?: string; descricao?: string } = {}) {
  const comFoto = opcoes.comFoto ?? true;
  const { id } = await enviarPedido(
    p,
    await como(p, FUNCIONARIO),
    {
      area: 'educacao', calendarioId: null, tipoPeca: opcoes.tipo ?? 'post_instagram', titulo: 'Convite', descricao: opcoes.descricao ?? 'Legenda fictícia.',
      dataDesejada: '2026-11-25', linkVideo: null, imagemConfirmada: comFoto, nomeSolicitante: 'Pessoa', anexos: comFoto ? [await foto(opcoes.mime)] : [],
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

describe('agendar com "Publicar pelo Elo"', () => {
  it('cria uma publicação pendente e marca o pedido; reagendar não cria segunda', async () => {
    const id = await agendadoPeloElo();
    expect((await pedidoDe(id)).publicacao_automatica).toBe(true);
    let l = await pubsDe(id);
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ situacao: 'pendente', tipo: 'post', tentativas: 0, prevista_para: new Date(HORA).toISOString() });
    await agendar(id, true, '2026-11-21T10:00:00-03:00');
    l = await pubsDe(id);
    expect(l).toHaveLength(1);
    expect(l[0].prevista_para).toBe(new Date('2026-11-21T10:00:00-03:00').toISOString());
  });

  it('sem conta conectada, conta vencida, sem foto, foto que não é JPG, legenda longa ou reel: recusa com motivo', async () => {
    const semConta = await aprovado();
    await expect(agendar(semConta)).rejects.toThrow(/não está conectado/);
    await conectar();
    await expect(agendar(await aprovado({ comFoto: false }))).rejects.toThrow(/foto exigida/);
    await expect(agendar(await aprovado({ mime: 'image/png' }))).rejects.toThrow(/precisa ser JPG/);
    await expect(agendar(await aprovado({ descricao: 'a'.repeat(2201) }))).rejects.toThrow(/2\.200/);
    await expect(agendar(await aprovado({ tipo: 'reel_instagram' }))).rejects.toThrow(/só para post/);
    await expect(agendar(await aprovado(), true, HORA, '')).rejects.toBeInstanceOf(ErroComunicacao);
    expect((await lerTabela(p, PublicacoesComunicacao)).todos()).toHaveLength(0);
  });

  it('"Eu publico à mão" continua como hoje, sem publicação', async () => {
    await conectar();
    const id = await aprovado();
    await agendar(id, false);
    expect((await pedidoDe(id)).situacao).toBe('agendado');
    expect((await pedidoDe(id)).publicacao_automatica).toBe(false);
    expect(await pubsDe(id)).toHaveLength(0);
  });

  it('só a Comunicação e a coordenação agendam; a tela sabe se está disponível', async () => {
    await conectar();
    const id = await aprovado();
    await expect(
      agendarPedido(p, await como(p, FUNCIONARIO), id, (await pedidoDe(id)).versao, { agendadoPara: HORA, grupos: [], contatos: [], publicarPeloElo: true }, { agora: AGORA, instituicao: 'exemplo' }),
    ).rejects.toBeInstanceOf(ErroPermissao);
    expect(await publicacaoAutomaticaDisponivel(p, await como(p, COMUNICACAO), await pedidoDe(id), 'exemplo', AGORA)).toEqual({ disponivel: true });
    const r = await publicacaoAutomaticaDisponivel(p, await como(p, COMUNICACAO), await pedidoDe(id), 'outra', AGORA);
    expect(r.disponivel).toBe(false);
    await expect(publicacaoAutomaticaDisponivel(p, await como(p, FUNCIONARIO), await pedidoDe(id), 'exemplo', AGORA)).rejects.toBeInstanceOf(ErroPermissao);
  });
});

describe('rotina: publicar na hora marcada', () => {
  it('antes da hora não faz nada; na hora cria o contêiner, publica, grava o link e passa o pedido para Publicado', async () => {
    const id = await agendadoPeloElo();
    expect(await rodarPublicacoes(p, ctx(), new Date('2026-11-20T17:00:00Z'))).toEqual({});
    expect(pub.containers).toHaveLength(0);
    const r = await rodarPublicacoes(p, ctx(), APOS_HORA);
    expect(r).toEqual({ publicadas: 1 });
    expect(pub.containers).toHaveLength(1);
    expect(pub.containers[0].legenda).toBe('Legenda fictícia.');
    expect(pub.containers[0].url).toMatch(/^https:\/\/elo\.exemplo\.local\/api\/midia-temporaria\/exemplo\./);
    const ped = await pedidoDe(id);
    expect(ped).toMatchObject({ situacao: 'publicado', link_publicacao: 'https://www.instagram.com/p/post-1/', publicacao_automatica: true });
    expect((await pubsDe(id))[0]).toMatchObject({ situacao: 'publicada', post_id: 'post-1', codigo_midia: null });
    const h = (await historicoDe(id)).at(-1)!;
    expect(h).toMatchObject({ acao: 'publicar', para: 'publicado', comentario: 'Publicado pelo Elo no Instagram.', usuario: 'sistema' });
  });

  it('nunca publica duas vezes: segunda rodada, rodadas ao mesmo tempo e rodada depois de publicado', async () => {
    const id = await agendadoPeloElo();
    await Promise.all([rodarPublicacoes(p, ctx(), APOS_HORA), rodarPublicacoes(p, ctx(), APOS_HORA)]);
    await rodarPublicacoes(p, ctx(), new Date(APOS_HORA.getTime() + MIN));
    expect(pub.publicados).toHaveLength(1);
    expect(await pubsDe(id)).toHaveLength(1);
  });

  it('a auditoria registra só colunas, nunca token, link ou legenda', async () => {
    await agendadoPeloElo();
    await rodarPublicacoes(p, ctx(), APOS_HORA);
    const texto = JSON.stringify((await lerTabela(p, RegistrosAuditoria)).todos());
    expect(texto).not.toMatch(/token-exemplo|instagram\.com\/p|Legenda fictícia/);
    expect(texto).toContain('PublicacoesComunicacao');
  });

  it('Meta ainda processando: acompanha nas rodadas seguintes e depois publica', async () => {
    const id = await agendadoPeloElo();
    pub.processandoPor = 2;
    expect(await rodarPublicacoes(p, ctx(), APOS_HORA)).toEqual({ processando: 1 });
    expect(await rodarPublicacoes(p, ctx(), new Date(APOS_HORA.getTime() + 15 * MIN))).toEqual({ processando: 1 });
    expect(pub.containers).toHaveLength(1);
    expect(await rodarPublicacoes(p, ctx(), new Date(APOS_HORA.getTime() + 30 * MIN))).toEqual({ publicadas: 1 });
    expect((await pedidoDe(id)).situacao).toBe('publicado');
    expect(pub.containers).toHaveLength(1);
  });

  it('se a Meta já devolveu o post e só o link falhou, a rodada seguinte só consulta o link (não recria)', async () => {
    const id = await agendadoPeloElo();
    pub.falharLink = true;
    expect(await rodarPublicacoes(p, ctx(), APOS_HORA)).toEqual({ aguardando_link: 1 });
    expect((await pubsDe(id))[0]).toMatchObject({ situacao: 'publicando', post_id: 'post-1' });
    pub.falharLink = false;
    await rodarPublicacoes(p, ctx(), new Date(APOS_HORA.getTime() + 15 * MIN));
    expect(pub.publicados).toHaveLength(1);
    expect(pub.containers).toHaveLength(1);
    expect((await pedidoDe(id)).situacao).toBe('publicado');
  });

  it('limite de 25 por rodada: o excedente fica pendente para a rodada seguinte', async () => {
    await conectar();
    const ids: string[] = [];
    for (let i = 0; i < 26; i += 1) {
      const id = await aprovado();
      await agendar(id);
      ids.push(id);
    }
    const r = await rodarPublicacoes(p, ctx(), APOS_HORA);
    expect(r).toMatchObject({ publicadas: 25, adiadas: 1 });
    expect(await rodarPublicacoes(p, ctx(), new Date(APOS_HORA.getTime() + MIN))).toEqual({ publicadas: 1 });
  }, 60_000);

  it('limite de 50 em 24 horas por conta', async () => {
    await conectar();
    const id = await aprovado();
    await agendar(id);
    const ped = await pedidoDe(id);
    for (let i = 0; i < 50; i += 1) {
      await inserir(p, PublicacoesComunicacao, { pedido_id: `antigo-${i}`, tipo: 'post', prevista_para: AGORA.toISOString(), situacao: 'publicada', tentativas: 1, publicada_em: new Date(APOS_HORA.getTime() - 60 * MIN).toISOString() }, { email: 'teste' });
    }
    expect(ped.situacao).toBe('agendado');
    expect(await rodarPublicacoes(p, ctx(), APOS_HORA)).toEqual({ adiadas: 1 });
    // Passadas 24 horas das outras, a publicação sai.
    expect(await rodarPublicacoes(p, ctx(), new Date(APOS_HORA.getTime() + 25 * 60 * MIN))).toEqual({ publicadas: 1 });
  });

  it('conta desconectada ou vencida: nada sai e a publicação continua pendente', async () => {
    const id = await aprovado();
    await conectar();
    await agendar(id);
    const longe = new Date(AGORA.getTime() + 61 * 86400000);
    expect(await rodarPublicacoes(p, ctx(), longe)).toEqual({ aguardando_conta: 1 });
    expect(pub.containers).toHaveLength(0);
    expect((await pubsDe(id))[0].situacao).toBe('pendente');
  });
});

describe('falhas', () => {
  it('3 tentativas (+15 e +60 minutos); esgotadas, a publicação falha e o pedido continua Agendado com o motivo no histórico', async () => {
    const id = await agendadoPeloElo();
    pub.falharContainer = 'A imagem não foi aceita pelo Instagram.';
    expect(await rodarPublicacoes(p, ctx(), APOS_HORA)).toEqual({ novas_tentativas: 1 });
    let x = (await pubsDe(id))[0];
    expect(x).toMatchObject({ situacao: 'pendente', tentativas: 1, erro: 'A imagem não foi aceita pelo Instagram.' });
    expect(x.proxima_tentativa).toBe(new Date(APOS_HORA.getTime() + 15 * MIN).toISOString());
    // Antes da espera, não tenta.
    expect(await rodarPublicacoes(p, ctx(), new Date(APOS_HORA.getTime() + 10 * MIN))).toEqual({});
    const segunda = new Date(APOS_HORA.getTime() + 16 * MIN);
    expect(await rodarPublicacoes(p, ctx(), segunda)).toEqual({ novas_tentativas: 1 });
    x = (await pubsDe(id))[0];
    expect(x.proxima_tentativa).toBe(new Date(segunda.getTime() + 60 * MIN).toISOString());
    expect(await rodarPublicacoes(p, ctx(), new Date(segunda.getTime() + 61 * MIN))).toEqual({ falharam: 1 });
    x = (await pubsDe(id))[0];
    expect(x).toMatchObject({ situacao: 'falhou', tentativas: 3 });
    expect((await pedidoDe(id)).situacao).toBe('agendado');
    const h = (await historicoDe(id)).at(-1)!;
    expect(h).toMatchObject({ acao: 'publicacao_falhou', comentario: 'A imagem não foi aceita pelo Instagram.' });
    // Falhou: a rotina não tenta mais.
    expect(await rodarPublicacoes(p, ctx(), new Date(segunda.getTime() + 300 * MIN))).toEqual({});
  });

  it('erro de rede ou da Meta sem mensagem pronta vira texto genérico, nunca o erro cru', async () => {
    const id = await agendadoPeloElo();
    pub.falharStatus = true;
    await rodarPublicacoes(p, ctx(), APOS_HORA);
    expect((await pubsDe(id))[0].erro).toBe('A imagem não foi aceita pelo Instagram.');
  });

  it('"Tentar de novo" volta a publicação para a fila; quem não é da Comunicação não pode', async () => {
    const id = await agendadoPeloElo();
    pub.falharContainer = 'A conta precisa ser reconectada.';
    let t = APOS_HORA;
    for (const espera of [0, 16, 61]) {
      t = new Date(t.getTime() + espera * MIN);
      await rodarPublicacoes(p, ctx(), t);
    }
    expect((await pubsDe(id))[0].situacao).toBe('falhou');
    expect(await problemasDePublicacao(p, await como(p, COMUNICACAO), 'exemplo', t)).toMatchObject({ falharam: 1 });
    expect(await problemasDePublicacao(p, await como(p, FUNCIONARIO), 'exemplo', t)).toEqual({ falharam: 0, atrasadas: 0, reconectar: false });
    await expect(tentarDeNovo(p, await como(p, FUNCIONARIO), id, 'exemplo', t)).rejects.toBeInstanceOf(ErroPermissao);
    await tentarDeNovo(p, await como(p, COMUNICACAO), id, 'exemplo', t);
    expect((await pubsDe(id))[0]).toMatchObject({ situacao: 'pendente', tentativas: 0, erro: null });
    pub.falharContainer = null;
    expect(await rodarPublicacoes(p, ctx(), new Date(t.getTime() + MIN))).toEqual({ publicadas: 1 });
    expect((await pedidoDe(id)).situacao).toBe('publicado');
    await expect(tentarDeNovo(p, await como(p, COMUNICACAO), id, 'exemplo', t)).rejects.toBeInstanceOf(ErroComunicacao);
  });

  it('"Publicar à mão" encerra a publicação automática e a rotina nada mais faz', async () => {
    const id = await agendadoPeloElo();
    await publicarPedido(p, await como(p, COMUNICACAO), id, (await pedidoDe(id)).versao, { link: 'https://www.instagram.com/p/abc/', comentario: null }, { agora: AGORA });
    expect((await pubsDe(id))[0].situacao).toBe('cancelada');
    expect((await pedidoDe(id)).publicacao_automatica).toBe(false);
    expect(await rodarPublicacoes(p, ctx(), APOS_HORA)).toEqual({});
    expect(pub.containers).toHaveLength(0);
  });

  it('publicação atrasada mais de 1 hora aparece como problema', async () => {
    const id = await agendadoPeloElo();
    const c = await como(p, COMUNICACAO);
    expect((await problemasDePublicacao(p, c, 'exemplo', new Date('2026-11-20T18:30:00Z'))).atrasadas).toBe(0);
    expect((await problemasDePublicacao(p, c, 'exemplo', new Date('2026-11-20T19:30:00Z'))).atrasadas).toBe(1);
    expect((await publicacaoDoPedido(p, c, id, new Date('2026-11-20T19:30:00Z')))?.atrasada).toBe(true);
    expect(await publicacaoDoPedido(p, await como(p, FUNCIONARIO), id)).toBeNull();
  });

  it('as esperas e o limite de tentativas são os da especificação', () => {
    expect(proximaTentativa(1, AGORA)!.getTime() - AGORA.getTime()).toBe(15 * MIN);
    expect(proximaTentativa(2, AGORA)!.getTime() - AGORA.getTime()).toBe(60 * MIN);
    expect(proximaTentativa(3, AGORA)).toBeNull();
  });
});

describe('mídia temporária', () => {
  /** Roda com Meta lenta para o código continuar vivo e devolve o código usado. */
  async function emPublicacao() {
    const id = await agendadoPeloElo();
    pub.processandoPor = 99;
    await rodarPublicacoes(p, ctx(), APOS_HORA);
    const codigo = pub.containers[0].url.split('/').pop()!;
    return { id, codigo };
  }

  it('entrega só a foto daquele pedido, até 1 hora, e cada entrega vai para a auditoria', async () => {
    const { codigo } = await emPublicacao();
    expect(instituicaoDoCodigo(codigo)).toBe('exemplo');
    const m = await abrirMidiaTemporaria(p, arq, codigo, new Date(APOS_HORA.getTime() + 30 * MIN));
    expect(m).not.toBeNull();
    expect(m!.tipo).toBe('image/jpeg');
    expect((await m!.lerTrecho(0)).dados).toHaveLength(50);
    const leituras = (await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.acao === 'leitura' && a.usuario === 'midia-temporaria');
    expect(leituras).toHaveLength(1);
    expect(leituras[0].entidade).toBe('AnexosComunicacao');
  });

  it('código errado, parecido, vencido ou sem pasta de anexos dá o mesmo "não encontrado"', async () => {
    const { codigo } = await emPublicacao();
    const agora = new Date(APOS_HORA.getTime() + MIN);
    expect(await abrirMidiaTemporaria(p, arq, `${codigo}x`, agora)).toBeNull();
    expect(await abrirMidiaTemporaria(p, arq, `exemplo.${'a'.repeat(43)}`, agora)).toBeNull();
    expect(await abrirMidiaTemporaria(p, arq, 'curto', agora)).toBeNull();
    expect(await abrirMidiaTemporaria(p, arq, codigo, new Date(APOS_HORA.getTime() + 61 * MIN))).toBeNull();
    expect(await abrirMidiaTemporaria(p, null, codigo, agora)).toBeNull();
  });

  it('deixa de funcionar quando a publicação termina (com sucesso)', async () => {
    const { codigo } = await emPublicacao();
    pub.processandoPor = 0;
    expect(await rodarPublicacoes(p, ctx(), new Date(APOS_HORA.getTime() + 5 * MIN))).toEqual({ publicadas: 1 });
    expect(await abrirMidiaTemporaria(p, arq, codigo, new Date(APOS_HORA.getTime() + 6 * MIN))).toBeNull();
  });

  it('código vencido sem a Meta terminar conta como falha (o código é encerrado)', async () => {
    const { id, codigo } = await emPublicacao();
    expect(await rodarPublicacoes(p, ctx(), new Date(APOS_HORA.getTime() + 61 * MIN))).toEqual({ novas_tentativas: 1 });
    expect(await abrirMidiaTemporaria(p, arq, codigo, new Date(APOS_HORA.getTime() + 61 * MIN))).toBeNull();
    expect((await pubsDe(id))[0]).toMatchObject({ situacao: 'pendente', codigo_midia: null });
  });

  it('o resumo guardado na planilha não é o código', async () => {
    const { id, codigo } = await emPublicacao();
    const x = (await pubsDe(id))[0];
    expect(x.codigo_midia).not.toBe(codigo);
    expect(x.codigo_midia).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('isolamento entre instituições', () => {
  it('a rotina só usa a credencial da instituição dona do pedido', async () => {
    await conectar('exemplo');
    await conectar('outra', 'conta_b');
    const id = await aprovado();
    await agendar(id);
    await rodarPublicacoes(p, ctx('exemplo'), APOS_HORA);
    expect(pub.containers.map((c) => c.token)).toEqual(['token-exemplo']);
    expect(pub.containers[0].url).toContain('/exemplo.');
  });

  it('instituição sem conta própria não publica com a conta de outra', async () => {
    await conectar('exemplo');
    const id = await aprovado();
    await agendar(id);
    expect(await rodarPublicacoes(p, ctx('outra'), APOS_HORA)).toEqual({ aguardando_conta: 1 });
    expect(pub.containers).toHaveLength(0);
    expect((await pubsDe(id))[0].situacao).toBe('pendente');
  });

  it('código de uma instituição não abre mídia na planilha de outra instituição', async () => {
    const id = await agendadoPeloElo();
    pub.processandoPor = 99;
    await rodarPublicacoes(p, ctx(), APOS_HORA);
    const codigo = pub.containers[0].url.split('/').pop()!;
    expect(id).toBeTruthy();
    const outras = await planilhasDeComunicacao();
    expect(await abrirMidiaTemporaria(outras, new ArquivosMemoria(), codigo, new Date(APOS_HORA.getTime() + MIN))).toBeNull();
  });
});
