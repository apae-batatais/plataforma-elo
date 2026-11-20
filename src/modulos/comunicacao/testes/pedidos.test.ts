/**
 * Enviar, ajustar e cancelar pedido de publicação, com dados FICTÍCIOS:
 * número, urgência, histórico, auditoria sem valores, quem vê o quê e edição simultânea.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { atualizar, ErroConflito, lerTabela, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { Areas, PerfilPermissoes, RegistrosAuditoria } from '@/nucleo/estrutura/tabelas';
import { mudarSituacaoItemCalendario, salvarItemCalendario } from '../aplicacao/calendario';
import { salvarAntecedencia } from '../aplicacao/configuracoes';
import {
  cancelarPedido,
  contadoresComunicacao,
  decidirPedido,
  detalharPedido,
  editarNaRevisao,
  enviarPedido,
  filtrarPedidos,
  juntarPedido,
  listarPedidos,
  reenviarPedido,
  revisarPedido,
  type DadosPedido,
} from '../aplicacao/pedidos';
import { CalendarioComunicacao, HistoricoComunicacao, PedidosComunicacao } from '../dados/tabelas';
import { ErroComunicacao } from '../dominio/pedido';
import { auditoriaDe, COMUNICACAO, COORDENACAO, como, DIRETORIA, emAprovacao as emAprovacaoEm, emRevisao as emRevisaoEm, FUNCIONARIO, item, OUTRO_FUNCIONARIO, planilhasDeComunicacao } from './apoio';

let p: Planilhas;
let temaId: string;
const SEXTA = { agora: new Date('2026-11-06T15:00:00Z') };

beforeEach(async () => {
  p = await planilhasDeComunicacao();
  temaId = (await salvarItemCalendario(p, await como(p, COMUNICACAO), item({ tema: 'Setembro Verde', inicio: '2026-11-20', fim: '2026-11-20' }))).id;
});

function pedido(x: Partial<DadosPedido & { nomeSolicitante: string }> = {}) {
  return {
    area: 'educacao',
    calendarioId: temaId as string | null,
    tipoPeca: 'post_instagram' as const,
    titulo: 'Convite para a festa',
    descricao: 'Texto fictício do pedido.',
    dataDesejada: '2026-11-25',
    linkVideo: null as string | null,
    imagemConfirmada: false,
    nomeSolicitante: 'Funcionário (fictício)',
    ...x,
  };
}
const historicoDe = async (id: string) =>
  (await lerTabela(p, HistoricoComunicacao)).todos().filter((h) => h.pedido_id === id);
const envia = async (x: Parameters<typeof pedido>[0] = {}, email = FUNCIONARIO) =>
  enviarPedido(p, await como(p, email), pedido(x), SEXTA);
const situacao = async (id: string) => (await lerTabela(p, PedidosComunicacao)).porId(id)!;

describe('enviar pedido', () => {
  it('envia: número, urgência pela antecedência e histórico', async () => {
    const r = await envia({ dataDesejada: '2026-11-12' });
    expect(r).toMatchObject({ numero: 'COM-2026-0001', urgente: true });
    expect(await situacao(r.id)).toMatchObject({ situacao: 'aguardando_revisao', solicitante: FUNCIONARIO, urgente: true });
    expect(await historicoDe(r.id)).toEqual([expect.objectContaining({ acao: 'enviar', de: null, para: 'aguardando_revisao' })]);
    expect((await envia()).numero).toBe('COM-2026-0002');
    expect((await envia({ dataDesejada: '2026-11-13' })).urgente).toBe(false);
  });

  it('usa a antecedência configurada e o dia de Brasília', async () => {
    await salvarAntecedencia(p, await como(p, COORDENACAO), 1);
    // 22h de Brasília (01h UTC do dia seguinte) ainda é sexta, dia 6.
    const noite = { agora: new Date('2026-11-07T01:00:00Z') };
    const f = await como(p, FUNCIONARIO);
    expect((await enviarPedido(p, f, pedido({ dataDesejada: '2026-11-06' }), noite)).urgente).toBe(true);
    await expect(enviarPedido(p, f, pedido({ dataDesejada: '2026-11-05' }), noite)).rejects.toThrow('A data desejada não pode estar no passado.');
  });

  it('fora do calendário, data no passado e confirmação de imagem', async () => {
    const f = await como(p, FUNCIONARIO);
    await expect(enviarPedido(p, f, pedido({ calendarioId: null }), SEXTA)).resolves.toBeTruthy();
    await expect(enviarPedido(p, f, pedido({ dataDesejada: '2020-01-01' }), SEXTA)).rejects.toThrow('A data desejada não pode estar no passado.');
    await expect(enviarPedido(p, f, pedido({ linkVideo: 'https://drive.google.com/x', imagemConfirmada: false }), SEXTA)).rejects.toThrow(
      'Confirme que as pessoas que aparecem têm autorização de uso de imagem.',
    );
    await expect(enviarPedido(p, f, pedido({ linkVideo: 'drive.google.com/x', imagemConfirmada: true }), SEXTA)).rejects.toThrow(
      'Cole o link completo da pasta do vídeo (começando com https://).',
    );
  });

  it('guarda quando e por quem a imagem foi confirmada', async () => {
    const r = await envia({ linkVideo: 'https://drive.google.com/x', imagemConfirmada: true });
    expect(await situacao(r.id)).toMatchObject({
      link_video: 'https://drive.google.com/x',
      imagem_confirmada_por: FUNCIONARIO,
      imagem_confirmada_em: SEXTA.agora.toISOString(),
    });
    expect(await situacao((await envia()).id)).toMatchObject({ imagem_confirmada_em: null, imagem_confirmada_por: null });
  });

  it('recusa data fora do formato ou inexistente com mensagem para a pessoa', async () => {
    const f = await como(p, FUNCIONARIO);
    for (const dataDesejada of ['', '25/11/2026', '2026-13-40', '2026-02-30', 'amanhã'])
      await expect(enviarPedido(p, f, pedido({ dataDesejada }), SEXTA)).rejects.toThrow('Informe a data desejada no formato dia/mês/ano.');
    for (const dataDesejada of ['25/11/2026', '2026-02-30']) {
      await expect(enviarPedido(p, f, pedido({ dataDesejada }), SEXTA)).rejects.toBeInstanceOf(ErroComunicacao);
    }
  });

  it('confere título, descrição, área, tipo e tema', async () => {
    const f = await como(p, FUNCIONARIO);
    await expect(enviarPedido(p, f, pedido({ titulo: '  ' }), SEXTA)).rejects.toThrow('Informe o título.');
    await expect(enviarPedido(p, f, pedido({ descricao: '' }), SEXTA)).rejects.toThrow('Descreva o que deve ser publicado.');
    await expect(enviarPedido(p, f, pedido({ area: 'nao_existe' }), SEXTA)).rejects.toThrow('Escolha a área.');
    await expect(enviarPedido(p, f, pedido({ tipoPeca: 'outro' as never }), SEXTA)).rejects.toThrow('Escolha o tipo de peça.');
    await expect(enviarPedido(p, f, pedido({ calendarioId: 'nao-existe' }), SEXTA)).rejects.toThrow('Escolha um tema ativo do calendário ou "Fora do calendário".');
  });

  it('o tema precisa estar ativo no calendário', async () => {
    await mudarSituacaoItemCalendario(p, await como(p, COMUNICACAO), temaId, 1, false);
    await expect(envia()).rejects.toThrow('Escolha um tema ativo do calendário ou "Fora do calendário".');
  });

  it('o tema continua legível depois de o item mudar ou ser desativado', async () => {
    const r = await envia();
    await mudarSituacaoItemCalendario(p, await como(p, COMUNICACAO), temaId, 1, false);
    const d = await detalharPedido(p, await como(p, FUNCIONARIO), r.id);
    expect(d.pedido.calendario_tema).toBe('Setembro Verde');
    expect((await listarPedidos(p, await como(p, FUNCIONARIO), 'meus'))[0].tema).toBe('Setembro Verde');
  });

  it('a auditoria lista só nomes de colunas, nunca valores', async () => {
    const r = await envia({ titulo: 'Título secreto de teste' });
    const todas = (await lerTabela(p, RegistrosAuditoria)).todos().filter((a) => a.registro_id === r.id);
    expect(todas).toHaveLength(1);
    expect(todas[0]).toMatchObject({ acao: 'inclusao', entidade: 'PedidosComunicacao' });
    expect(todas[0].detalhes).toContain('titulo');
    expect(todas[0].detalhes).not.toContain('Título secreto de teste');
    expect(todas[0].detalhes).not.toContain(FUNCIONARIO);
  });
});

describe('ajustar e reenviar', () => {
  async function devolvido() {
    const r = await envia();
    const reg = await situacao(r.id);
    await atualizar(p, PedidosComunicacao, r.id, reg.versao, { situacao: 'devolvido' }, { email: COMUNICACAO });
    return r.id;
  }

  it('só quem pediu, só se devolvido; recalcula a urgência e registra o reenvio', async () => {
    const id = await devolvido();
    const v = (await situacao(id)).versao;
    await expect(reenviarPedido(p, await como(p, OUTRO_FUNCIONARIO), id, v, pedido(), SEXTA)).rejects.toThrow(ErroPermissao);
    await reenviarPedido(p, await como(p, FUNCIONARIO), id, v, pedido({ titulo: 'Título ajustado', dataDesejada: '2026-11-09' }), SEXTA);
    expect(await situacao(id)).toMatchObject({ situacao: 'aguardando_revisao', titulo: 'Título ajustado', urgente: true });
    expect((await historicoDe(id)).map((h) => [h.acao, h.para])).toEqual([
      ['enviar', 'aguardando_revisao'],
      ['reenviar', 'aguardando_revisao'],
    ]);
    const aud = await auditoriaDe(p, id);
    expect(aud.at(-1)).toMatchObject({ acao: 'alteracao' });
    expect(aud.at(-1)!.detalhes).not.toContain('Título ajustado');
  });

  it('com link de vídeo, cada reenvio pede nova confirmação de imagem e registra a mais recente', async () => {
    const r = await envia({ linkVideo: 'https://drive.google.com/x', imagemConfirmada: true });
    const reg = await situacao(r.id);
    await atualizar(p, PedidosComunicacao, r.id, reg.versao, { situacao: 'devolvido' }, { email: COMUNICACAO });
    const v = (await situacao(r.id)).versao;
    const f = await como(p, FUNCIONARIO);
    const depois = { agora: new Date('2026-11-09T15:00:00Z') };
    const dados = pedido({ linkVideo: 'https://drive.google.com/x' });
    await expect(reenviarPedido(p, f, r.id, v, { ...dados, imagemConfirmada: false }, depois)).rejects.toThrow(
      'Confirme que as pessoas que aparecem têm autorização de uso de imagem.',
    );
    await reenviarPedido(p, f, r.id, v, { ...dados, imagemConfirmada: true }, depois);
    expect(await situacao(r.id)).toMatchObject({ imagem_confirmada_por: FUNCIONARIO, imagem_confirmada_em: depois.agora.toISOString() });
  });

  it('não reenvia pedido que não foi devolvido', async () => {
    const r = await envia();
    await expect(reenviarPedido(p, await como(p, FUNCIONARIO), r.id, 1, pedido(), SEXTA)).rejects.toThrow('Esta ação não vale para um pedido em "Aguardando revisão".');
  });

  it('o ajuste também confere os dados', async () => {
    const id = await devolvido();
    const v = (await situacao(id)).versao;
    await expect(reenviarPedido(p, await como(p, FUNCIONARIO), id, v, pedido({ dataDesejada: '31/12/2026' }), SEXTA)).rejects.toThrow(
      'Informe a data desejada no formato dia/mês/ano.',
    );
  });
});

describe('cancelar', () => {
  it('só quem pediu, só antes da revisão ou quando devolvido', async () => {
    const r = await envia();
    await expect(cancelarPedido(p, await como(p, OUTRO_FUNCIONARIO), r.id, 1)).rejects.toThrow(ErroPermissao);
    await expect(cancelarPedido(p, await como(p, COMUNICACAO), r.id, 1)).rejects.toThrow(ErroPermissao);
    await cancelarPedido(p, await como(p, FUNCIONARIO), r.id, 1);
    expect((await situacao(r.id)).situacao).toBe('cancelado');
    expect((await historicoDe(r.id)).at(-1)).toMatchObject({ acao: 'cancelar', de: 'aguardando_revisao', para: 'cancelado' });
    await expect(cancelarPedido(p, await como(p, FUNCIONARIO), r.id, 2)).rejects.toThrow('Esta ação não vale para um pedido em "Cancelado".');
  });

  it('não cancela depois que a Comunicação iniciou a revisão', async () => {
    const r = await envia();
    await atualizar(p, PedidosComunicacao, r.id, 1, { situacao: 'em_revisao' }, { email: COMUNICACAO });
    await expect(cancelarPedido(p, await como(p, FUNCIONARIO), r.id, 2)).rejects.toThrow('Esta ação não vale para um pedido em "Em revisão".');
  });

  it('versão antiga dá ErroConflito, antes de qualquer regra de situação', async () => {
    const r = await envia();
    await atualizar(p, PedidosComunicacao, r.id, 1, { situacao: 'em_revisao' }, { email: COMUNICACAO });
    await expect(cancelarPedido(p, await como(p, FUNCIONARIO), r.id, 1)).rejects.toBeInstanceOf(ErroConflito);
    expect((await situacao(r.id)).situacao).toBe('em_revisao');
    expect(await historicoDe(r.id)).toHaveLength(1);
  });

  it('pedido inexistente', async () => {
    await expect(cancelarPedido(p, await como(p, FUNCIONARIO), 'x', 1)).rejects.toThrow('Pedido não encontrado.');
  });
});

describe('quem vê o quê', () => {
  it('cada um os seus; Comunicação, coordenação e Diretoria todos', async () => {
    await envia();
    expect(await listarPedidos(p, await como(p, OUTRO_FUNCIONARIO), 'meus')).toEqual([]);
    expect(await listarPedidos(p, await como(p, FUNCIONARIO), 'meus')).toHaveLength(1);
    await expect(listarPedidos(p, await como(p, FUNCIONARIO), 'todos')).rejects.toThrow(ErroPermissao);
    for (const e of [COMUNICACAO, COORDENACAO, DIRETORIA]) expect(await listarPedidos(p, await como(p, e), 'todos')).toHaveLength(1);
  });

  it('as filas pedem a permissão certa', async () => {
    const f = await como(p, FUNCIONARIO);
    for (const v of ['revisar', 'aprovar', 'agendar', 'agendados'] as const) await expect(listarPedidos(p, f, v)).rejects.toThrow(ErroPermissao);
    await expect(listarPedidos(p, await como(p, COMUNICACAO), 'aprovar')).rejects.toThrow(ErroPermissao);
    expect(await listarPedidos(p, await como(p, COMUNICACAO), 'revisar')).toHaveLength(0);
    await envia();
    expect(await listarPedidos(p, await como(p, COMUNICACAO), 'revisar')).toHaveLength(1);
  });

  it('a linha traz o necessário para a lista', async () => {
    const r = await envia({ dataDesejada: '2026-11-09' });
    expect((await listarPedidos(p, await como(p, FUNCIONARIO), 'meus'))[0]).toEqual({
      id: r.id,
      numero: 'COM-2026-0001',
      titulo: 'Convite para a festa',
      tipoPeca: 'post_instagram',
      situacao: 'aguardando_revisao',
      urgente: true,
      dataDesejada: '2026-11-09',
      tema: 'Setembro Verde',
      solicitanteNome: 'Funcionário (fictício)',
      area: 'educacao',
      agendadoPara: null,
    });
  });

  it('detalhe: dono e equipe veem; outra pessoa não; as ações dependem de quem olha', async () => {
    const r = await envia();
    await expect(detalharPedido(p, await como(p, OUTRO_FUNCIONARIO), r.id)).rejects.toThrow(ErroPermissao);
    const dono = await detalharPedido(p, await como(p, FUNCIONARIO), r.id);
    expect(dono.acoes).toEqual(['cancelar']);
    expect(dono.historico).toHaveLength(1);
    expect(dono.anexos).toEqual([]);
    expect((await detalharPedido(p, await como(p, COMUNICACAO), r.id)).acoes).toEqual(['iniciar_revisao']);
    await expect(detalharPedido(p, await como(p, FUNCIONARIO), 'x')).rejects.toThrow('Pedido não encontrado.');
  });
});

describe('revisão e aprovação', () => {
  const emRevisao = () => emRevisaoEm(p);
  const emAprovacao = (opts?: { por?: string }) => emAprovacaoEm(p, opts);
  const c = async (e = COMUNICACAO) => como(p, e);

  it('revisão → aprovação → aprovado, com histórico de cada passo', async () => {
    const { id } = await envia();
    await revisarPedido(p, await c(), id, 1, 'iniciar_revisao', null, SEXTA);
    await editarNaRevisao(p, await c(), id, 2, { titulo: 'Novo título' }, SEXTA);
    await revisarPedido(p, await c(), id, 3, 'enviar_aprovacao', null, SEXTA);
    await expect(decidirPedido(p, await c(), id, 4, 'aprovar', null, SEXTA)).rejects.toThrow(ErroPermissao);
    await decidirPedido(p, await c(COORDENACAO), id, 4, 'aprovar', null, SEXTA);
    expect((await historicoDe(id)).map((h) => h.acao)).toEqual(['enviar', 'iniciar_revisao', 'editar', 'enviar_aprovacao', 'aprovar']);
    expect((await situacao(id)).situacao).toBe('aprovado');
  });

  it('a edição na revisão registra as colunas no histórico e só nomes de colunas na auditoria', async () => {
    const r = await emRevisao();
    await editarNaRevisao(p, await c(), r.id, r.versao, { titulo: 'Título secreto de teste', tipoPeca: 'reel_instagram' }, SEXTA);
    const h = (await historicoDe(r.id)).find((x) => x.acao === 'editar')!;
    expect(h).toMatchObject({ de: 'em_revisao', para: 'em_revisao' });
    expect(h.comentario).toContain('titulo');
    expect(h.comentario).toContain('tipo_peca');
    expect(h.comentario).not.toContain('Título secreto de teste');
    const aud = (await auditoriaDe(p, r.id)).at(-1)!;
    expect(aud.detalhes).toContain('titulo');
    expect(aud.detalhes).not.toContain('Título secreto de teste');
    expect(await situacao(r.id)).toMatchObject({ titulo: 'Título secreto de teste', tipo_peca: 'reel_instagram' });
  });

  it('só edita em revisão, só a Comunicação, e confere os dados', async () => {
    const { id } = await envia();
    await expect(editarNaRevisao(p, await c(), id, 1, { titulo: 'X' }, SEXTA)).rejects.toThrow('Esta ação não vale para um pedido em "Aguardando revisão".');
    const r = await emRevisao();
    await expect(editarNaRevisao(p, await c(FUNCIONARIO), r.id, r.versao, { titulo: 'X' }, SEXTA)).rejects.toThrow(ErroPermissao);
    await expect(editarNaRevisao(p, await c(), r.id, r.versao, { titulo: ' ' }, SEXTA)).rejects.toThrow('Informe o título.');
    await expect(editarNaRevisao(p, await c(), r.id, r.versao, {}, SEXTA)).rejects.toThrow('Nenhuma alteração para salvar.');
    expect((await situacao(r.id)).versao).toBe(r.versao);
    await expect(editarNaRevisao(p, await c(), r.id, r.versao + 5, { titulo: 'X' }, SEXTA)).rejects.toBeInstanceOf(ErroConflito);
  });

  it('na revisão, liga um pedido "fora do calendário" a um item existente', async () => {
    const r = await emRevisao();
    expect((await situacao(r.id)).calendario_id).toBeNull();
    await editarNaRevisao(p, await c(), r.id, r.versao, { calendarioId: temaId }, SEXTA);
    expect(await situacao(r.id)).toMatchObject({ calendario_id: temaId, calendario_tema: 'Setembro Verde' });
    await expect(editarNaRevisao(p, await c(), r.id, r.versao + 1, { calendarioId: 'inexistente' }, SEXTA)).rejects.toThrow(
      'Escolha um tema ativo do calendário ou "Fora do calendário".',
    );
  });

  it('na revisão, cria um tema novo no calendário e liga o pedido a ele', async () => {
    const r = await emRevisao();
    await editarNaRevisao(p, await c(), r.id, r.versao, { novoTema: item({ tema: 'Semana da Inclusão', inicio: '2026-11-30', fim: '2026-11-30' }) }, SEXTA);
    const reg = await situacao(r.id);
    expect(reg.calendario_tema).toBe('Semana da Inclusão');
    expect(reg.calendario_id).toBeTruthy();
    const criado = (await lerTabela(p, CalendarioComunicacao)).porId(reg.calendario_id!);
    expect(criado).toMatchObject({ tema: 'Semana da Inclusão', ativo: true });
    const h = (await historicoDe(r.id)).find((x) => x.acao === 'editar')!;
    expect(h.comentario).toContain('calendario_id');
    expect(h.comentario).toContain('calendario_tema');
    expect((await auditoriaDe(p, criado!.id))[0]).toMatchObject({ acao: 'inclusao', entidade: 'CalendarioComunicacao' });
  });

  it('sem poder gerenciar o calendário ou com dados inválidos, nenhum tema é criado', async () => {
    const r = await emRevisao();
    const antes = async () => (await lerTabela(p, CalendarioComunicacao)).todos().length;
    const total = await antes();
    await expect(editarNaRevisao(p, await c(), r.id, r.versao, { titulo: ' ', novoTema: item() }, SEXTA)).rejects.toThrow('Informe o título.');
    await expect(editarNaRevisao(p, await c(), r.id, r.versao, { novoTema: item({ tema: ' ' }) }, SEXTA)).rejects.toThrow();
    await expect(editarNaRevisao(p, await c(FUNCIONARIO), r.id, r.versao, { novoTema: item() }, SEXTA)).rejects.toThrow(ErroPermissao);
    // Comunicação sem a permissão de gerenciar o calendário: revisa, mas não cria tema.
    const linha = (await lerTabela(p, PerfilPermissoes)).ativos().find((x) => x.perfil === 'comunicacao' && x.permissao === 'comunicacao.calendario.gerenciar')!;
    await atualizar(p, PerfilPermissoes, linha.id, linha.versao, { ativo: false }, { email: DIRETORIA });
    await expect(editarNaRevisao(p, await c(), r.id, r.versao, { novoTema: item() }, SEXTA)).rejects.toThrow(ErroPermissao);
    expect(await antes()).toBe(total);
    expect((await situacao(r.id)).versao).toBe(r.versao);
  });

  it('ações fora da lista de cada porta são recusadas sem gravar nada', async () => {
    const r = await emRevisao();
    for (const a of ['agendar', 'juntar', 'publicar', 'reenviar', 'aprovar'])
      await expect(revisarPedido(p, await c(COORDENACAO), r.id, r.versao, a as never, null, SEXTA), a).rejects.toThrow('Ação inválida.');
    await expect(decidirPedido(p, await c(COORDENACAO), r.id, r.versao, 'agendar' as never, null, SEXTA)).rejects.toThrow('Ação inválida.');
    await expect(decidirPedido(p, await c(COORDENACAO), r.id, r.versao, 'recusar', 'Motivo', SEXTA)).rejects.toThrow('Ação inválida.');
    expect(await situacao(r.id)).toMatchObject({ situacao: 'em_revisao', versao: r.versao });
    expect(await historicoDe(r.id)).toHaveLength(2);
    const a = await emAprovacao();
    await expect(revisarPedido(p, await c(COORDENACAO), a.id, a.versao, 'recusar', 'Motivo', SEXTA)).rejects.toThrow('Ação inválida.');
    expect(await situacao(a.id)).toMatchObject({ situacao: 'aguardando_aprovacao', versao: a.versao });
  });

  it('a área desativada depois do envio não impede a edição na revisão', async () => {
    const r = await emRevisao();
    const area = (await lerTabela(p, Areas)).ativos().find((x) => x.codigo === 'educacao')!;
    await atualizar(p, Areas, area.id, area.versao, { ativo: false }, { email: DIRETORIA });
    await editarNaRevisao(p, await c(), r.id, r.versao, { titulo: 'Título novo' }, SEXTA);
    expect(await situacao(r.id)).toMatchObject({ titulo: 'Título novo', area: 'educacao' });
  });

  it('editar o título não é barrado por data desejada que já passou', async () => {
    const r = await emRevisao();
    await expect(
      editarNaRevisao(p, await c(), r.id, r.versao, { titulo: 'Outro' }, { agora: new Date('2026-12-30T15:00:00Z') }),
    ).resolves.toBeUndefined();
    await expect(
      editarNaRevisao(p, await c(), r.id, r.versao + 1, { dataDesejada: '2026-11-01' }, { agora: new Date('2026-12-30T15:00:00Z') }),
    ).rejects.toThrow('A data desejada não pode estar no passado.');
  });

  it('devolver, recusar e pedir ajustes exigem motivo; pedir ajustes volta para a revisão', async () => {
    const { id, versao } = await emAprovacao();
    await expect(decidirPedido(p, await c(COORDENACAO), id, versao, 'pedir_ajustes', ' ', SEXTA)).rejects.toThrow('Escreva o motivo para quem pediu.');
    await expect(decidirPedido(p, await c(COORDENACAO), id, versao, 'recusar', null, SEXTA)).rejects.toThrow('Escreva o motivo para quem pediu.');
    await decidirPedido(p, await c(COORDENACAO), id, versao, 'pedir_ajustes', 'Trocar a foto', SEXTA);
    expect((await situacao(id)).situacao).toBe('em_revisao');
    expect((await historicoDe(id)).at(-1)).toMatchObject({ acao: 'pedir_ajustes', comentario: 'Trocar a foto' });

    const r = await emRevisao();
    await expect(revisarPedido(p, await c(), r.id, r.versao, 'devolver', '  ', SEXTA)).rejects.toThrow('Escreva o motivo para quem pediu.');
    await revisarPedido(p, await c(), r.id, r.versao, 'devolver', 'Faltou o texto', SEXTA);
    expect((await situacao(r.id)).situacao).toBe('devolvido');
    const s = await emRevisao();
    await revisarPedido(p, await c(), s.id, s.versao, 'recusar', 'Fora do escopo', SEXTA);
    expect((await situacao(s.id)).situacao).toBe('recusado');
  });

  it('recusar na aprovação é da coordenação; a Comunicação não recusa nem aprova', async () => {
    const { id, versao } = await emAprovacao();
    await expect(revisarPedido(p, await c(), id, versao, 'recusar', 'Motivo', SEXTA)).rejects.toThrow('Ação inválida.');
    await expect(decidirPedido(p, await c(), id, versao, 'recusar', 'Motivo', SEXTA)).rejects.toThrow(ErroPermissao);
    await decidirPedido(p, await c(COORDENACAO), id, versao, 'recusar', 'Motivo', SEXTA);
    expect((await situacao(id)).situacao).toBe('recusado');
  });

  it('ações fora da situação são recusadas, mas a versão é conferida primeiro', async () => {
    const { id } = await envia();
    await expect(revisarPedido(p, await c(), id, 1, 'enviar_aprovacao', null, SEXTA)).rejects.toThrow('Esta ação não vale para um pedido em "Aguardando revisão".');
    await expect(revisarPedido(p, await c(), id, 9, 'enviar_aprovacao', null, SEXTA)).rejects.toBeInstanceOf(ErroConflito);
    await expect(revisarPedido(p, await c(FUNCIONARIO), id, 1, 'iniciar_revisao', null, SEXTA)).rejects.toThrow(ErroPermissao);
  });

  it('juntar: destino ativo, outro pedido e não juntado; o destino recebe a referência', async () => {
    const a = await emRevisao();
    const b = await emRevisao();
    await expect(juntarPedido(p, await c(), a.id, a.versao, a.id, null, SEXTA)).rejects.toThrow('Escolha outro pedido para juntar.');
    await expect(juntarPedido(p, await c(), a.id, a.versao, 'x', null, SEXTA)).rejects.toThrow('Não encontramos o pedido escolhido.');
    await juntarPedido(p, await c(), a.id, a.versao, b.id, null, SEXTA);
    expect(await situacao(a.id)).toMatchObject({ situacao: 'juntado', juntado_a: b.numero });
    expect((await historicoDe(a.id)).at(-1)).toMatchObject({ acao: 'juntar', para: 'juntado' });
    expect((await historicoDe(b.id)).at(-1)).toMatchObject({ acao: 'juntar', de: 'em_revisao', para: 'em_revisao' });
    expect((await historicoDe(b.id)).at(-1)!.comentario).toContain(a.numero);
    expect((await situacao(b.id)).versao).toBe(b.versao);
    const d = await emRevisao();
    await expect(juntarPedido(p, await c(), d.id, d.versao, a.id, null, SEXTA)).rejects.toThrow(
      'Este pedido já foi encerrado; escolha um pedido em andamento.',
    );
    await expect(juntarPedido(p, await c(FUNCIONARIO), d.id, d.versao, b.id, null, SEXTA)).rejects.toThrow(ErroPermissao);
  });

  it('duas pessoas no mesmo pedido: a segunda gravação não sobrescreve', async () => {
    const { id } = await envia();
    await revisarPedido(p, await c(), id, 1, 'iniciar_revisao', null, SEXTA);
    await expect(cancelarPedido(p, await c(FUNCIONARIO), id, 1)).rejects.toBeInstanceOf(ErroConflito);
    expect((await situacao(id)).situacao).toBe('em_revisao');
  });

  it('a coordenação aprova o próprio pedido; a Diretoria também aprova', async () => {
    const a = await emAprovacao({ por: COORDENACAO });
    await decidirPedido(p, await c(COORDENACAO), a.id, a.versao, 'aprovar', null, SEXTA);
    const o = await emAprovacao();
    await decidirPedido(p, await c(DIRETORIA), o.id, o.versao, 'aprovar', null, SEXTA);
    expect((await situacao(o.id)).situacao).toBe('aprovado');
  });

  it('o detalhe mostra a cada pessoa só as ações que ela pode fazer', async () => {
    const r = await emRevisao();
    expect((await detalharPedido(p, await c(), r.id)).acoes).toEqual(['enviar_aprovacao', 'devolver', 'recusar', 'juntar']);
    expect((await detalharPedido(p, await c(FUNCIONARIO), r.id)).acoes).toEqual([]);
    const a = await emAprovacao();
    expect((await detalharPedido(p, await c(), a.id)).acoes).toEqual([]);
    expect((await detalharPedido(p, await c(COORDENACAO), a.id)).acoes).toEqual(['recusar', 'aprovar', 'pedir_ajustes']);
  });

  it('as filas mostram cada pedido na etapa certa', async () => {
    const r = await emRevisao();
    const a = await emAprovacao();
    const ids = async (v: 'revisar' | 'aprovar') => (await listarPedidos(p, await c(COORDENACAO), v)).map((x) => x.id);
    expect(await ids('revisar')).toEqual([r.id]);
    expect(await ids('aprovar')).toEqual([a.id]);
  });

  it('filtros da tela Pedidos: situação, tipo, área e tema (inclusive fora do calendário)', async () => {
    await envia();
    await envia({ calendarioId: null, tipoPeca: 'release', area: 'saude' });
    const todas = await listarPedidos(p, await c(), 'todos');
    expect(filtrarPedidos(todas, {})).toHaveLength(2);
    expect(filtrarPedidos(todas, { tipo: 'release' })).toHaveLength(1);
    expect(filtrarPedidos(todas, { area: 'saude' })).toHaveLength(1);
    expect(filtrarPedidos(todas, { tema: 'fora' })[0].tipoPeca).toBe('release');
    expect(filtrarPedidos(todas, { tema: 'Setembro Verde' })[0].tipoPeca).toBe('post_instagram');
    expect(filtrarPedidos(todas, { situacao: 'em_revisao' })).toEqual([]);
    expect(filtrarPedidos(todas, { situacao: 'aguardando_revisao', tipo: 'release', area: 'educacao' })).toEqual([]);
  });
});

describe('avisos no início e no menu', () => {
  it('contadores por perfil, com o dia de Brasília', async () => {
    const noite = new Date('2026-11-07T01:30:00Z');
    // um devolvido do FUNCIONARIO
    const dev = await envia({}, FUNCIONARIO);
    await revisarPedido(p, await como(p, COMUNICACAO), dev.id, (await situacao(dev.id)).versao, 'iniciar_revisao', null, SEXTA);
    await revisarPedido(p, await como(p, COMUNICACAO), dev.id, (await situacao(dev.id)).versao, 'devolver', 'Falta o texto.', SEXTA);
    // dois para revisar (um urgente), de outra pessoa
    await envia({ dataDesejada: '2026-11-12' }, OUTRO_FUNCIONARIO);
    await envia({}, OUTRO_FUNCIONARIO);
    // um para aprovar
    await emAprovacaoEm(p, { por: OUTRO_FUNCIONARIO });
    // um agendado para 06/11 às 23h de Brasília (02h UTC de 07/11), gravado direto na aba
    const ag = await envia({}, OUTRO_FUNCIONARIO);
    await atualizar(p, PedidosComunicacao, ag.id, (await situacao(ag.id)).versao, { situacao: 'agendado', agendado_para: '2026-11-07T02:00:00.000Z' }, { email: COMUNICACAO });

    expect(await contadoresComunicacao(p, await como(p, FUNCIONARIO), { agora: noite })).toEqual({
      devolvidos: 1,
      revisar: 0,
      urgentes: 0,
      publicarHoje: 0,
      aprovar: 0,
      enviosFalharam: 0,
    });
    expect(await contadoresComunicacao(p, await como(p, COMUNICACAO), { agora: noite })).toMatchObject({ revisar: 2, urgentes: 1, publicarHoje: 1, aprovar: 0 });
    expect(await contadoresComunicacao(p, await como(p, COORDENACAO), { agora: noite })).toMatchObject({ aprovar: 1 });
    // No dia seguinte (Brasília), o agendado de ontem não conta mais como "hoje".
    expect((await contadoresComunicacao(p, await como(p, COMUNICACAO), { agora: new Date('2026-11-07T15:00:00Z') })).publicarHoje).toBe(0);
  });
});
