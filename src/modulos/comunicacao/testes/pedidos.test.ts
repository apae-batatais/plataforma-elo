/**
 * Enviar, ajustar e cancelar pedido de publicação, com dados FICTÍCIOS:
 * número, urgência, histórico, auditoria sem valores, quem vê o quê e edição simultânea.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { atualizar, ErroConflito, lerTabela, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { RegistrosAuditoria } from '@/nucleo/estrutura/tabelas';
import { mudarSituacaoItemCalendario, salvarItemCalendario } from '../aplicacao/calendario';
import { salvarAntecedencia } from '../aplicacao/configuracoes';
import { cancelarPedido, detalharPedido, enviarPedido, listarPedidos, reenviarPedido, type DadosPedido } from '../aplicacao/pedidos';
import { HistoricoComunicacao, PedidosComunicacao } from '../dados/tabelas';
import { ErroComunicacao } from '../dominio/pedido';
import { auditoriaDe, COMUNICACAO, COORDENACAO, como, DIRETORIA, FUNCIONARIO, item, OUTRO_FUNCIONARIO, planilhasDeComunicacao } from './apoio';

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
