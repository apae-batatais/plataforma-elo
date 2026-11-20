/** Envios automáticos de release e artigo (ADR-027, entrega 2), com dados FICTÍCIOS e e-mail em memória. */
import { beforeEach, describe, expect, it } from 'vitest';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ArquivosMemoria } from '@/nucleo/armazenamento/arquivos';
import { lerTabela, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { EnviadorMemoria } from '@/nucleo/email/email';
import { listarContatos, mudarSituacaoContato, salvarContato, salvarGrupo } from '../aplicacao/contatos';
import { contarEnviosFalhos, envioDoPedido, rodarEnvios, tentarEnvioDeNovo } from '../aplicacao/envios';
import { agendarPedido, contadoresComunicacao, decidirPedido, enviarPedido, publicarPedido, revisarPedido } from '../aplicacao/pedidos';
import { EnviosComunicacao, HistoricoComunicacao, PedidosComunicacao } from '../dados/tabelas';
import type { TipoPeca } from '../dominio/pedido';
import { auditoriaDe, COMUNICACAO, COORDENACAO, como, FUNCIONARIO, planilhasDeComunicacao } from './apoio';

let p: Planilhas;
let grupoId: string;
let redacao: string;
let email: EnviadorMemoria;
const SEXTA = new Date('2026-11-06T15:00:00Z');
const HORA = '2026-11-07T10:00:00-03:00';
const NA_HORA = new Date('2026-11-07T13:00:00Z');
const COM_EMAIL = { agora: SEXTA, emailDisponivel: true };

const reg = async (id: string) => (await lerTabela(p, PedidosComunicacao)).porId(id)!;
const envios = async () => (await lerTabela(p, EnviosComunicacao)).todos();
const meios = () => ({ email, arquivos: null });
const mais = (d: Date, min: number) => new Date(d.getTime() + min * 60_000);

beforeEach(async () => {
  p = await planilhasDeComunicacao();
  email = new EnviadorMemoria('nao-responda@exemplo.local');
  const c = await como(p, COMUNICACAO);
  grupoId = (await salvarGrupo(p, c, { nome: 'Jornais fictícios' })).id;
  await salvarContato(p, c, { nome: 'Redação', veiculo: null, email: 'Redacao@jornal.exemplo.local', grupos: [grupoId] });
  redacao = (await listarContatos(p, c)).contatos[0].id;
});

async function aprovado(tipoPeca: TipoPeca = 'release') {
  const { id } = await enviarPedido(
    p,
    await como(p, FUNCIONARIO),
    { area: 'educacao', calendarioId: null, tipoPeca, titulo: 'Setembro Verde', descricao: 'Texto fictício do release.', dataDesejada: '2026-11-25', linkVideo: null, imagemConfirmada: false, nomeSolicitante: 'Pessoa' },
    { agora: SEXTA },
  );
  const c = await como(p, COMUNICACAO);
  await revisarPedido(p, c, id, (await reg(id)).versao, 'iniciar_revisao', null, { agora: SEXTA });
  await revisarPedido(p, c, id, (await reg(id)).versao, 'enviar_aprovacao', null, { agora: SEXTA });
  await decidirPedido(p, await como(p, COORDENACAO), id, (await reg(id)).versao, 'aprovar', null, { agora: SEXTA });
  return id;
}
async function agendarAuto(id: string, quando = HORA) {
  await agendarPedido(p, await como(p, COMUNICACAO), id, (await reg(id)).versao, { agendadoPara: quando, grupos: [grupoId], contatos: [], envioAutomatico: true }, COM_EMAIL);
}
async function agendado(tipo: TipoPeca = 'release') {
  const id = await aprovado(tipo);
  await agendarAuto(id);
  return id;
}

describe('agendar com envio automático', () => {
  it('cria um envio pendente, sem gravar o corpo da mensagem', async () => {
    const id = await agendado();
    const [e] = await envios();
    expect(e).toMatchObject({ pedido_id: id, tipo: 'release', situacao: 'pendente', tentativas: 0, assunto: 'Setembro Verde' });
    expect(JSON.stringify(e)).not.toContain('Texto fictício');
    expect((await reg(id)).envio_automatico).toBe(true);
    expect((await auditoriaDe(p, e.id)).map((a) => a.acao)).toEqual(['inclusao']);
    expect(JSON.stringify(await auditoriaDe(p, e.id))).not.toContain('Setembro');
  });

  it('sem e-mail de envio da instituição é recusado e nada é gravado', async () => {
    const id = await aprovado();
    await expect(
      agendarPedido(p, await como(p, COMUNICACAO), id, (await reg(id)).versao, { agendadoPara: HORA, grupos: [grupoId], contatos: [], envioAutomatico: true }, { agora: SEXTA }),
    ).rejects.toThrow(/e-mail de envio/);
    expect(await envios()).toHaveLength(0);
    expect((await reg(id)).situacao).toBe('aprovado');
  });

  it('reagendar atualiza o envio pendente: nunca há um segundo', async () => {
    const id = await agendado();
    await agendarAuto(id, '2026-11-08T10:00:00-03:00');
    const lista = await envios();
    expect(lista).toHaveLength(1);
    expect(lista[0].previsto_para).toBe('2026-11-08T13:00:00.000Z');
  });

  it('reagendar para o e-mail pronto cancela o envio pendente', async () => {
    const id = await agendado();
    await agendarPedido(p, await como(p, COMUNICACAO), id, (await reg(id)).versao, { agendadoPara: HORA, grupos: [grupoId], contatos: [] }, COM_EMAIL);
    expect((await envios())[0].situacao).toBe('cancelado');
    expect((await reg(id)).envio_automatico).toBe(false);
    await rodarEnvios(p, meios(), NA_HORA);
    expect(email.enviadas).toHaveLength(0);
  });

  it('só release e artigo têm envio; post não', async () => {
    const id = await aprovado('post_instagram');
    await agendarPedido(p, await como(p, COMUNICACAO), id, (await reg(id)).versao, { agendadoPara: HORA, grupos: [], contatos: [], envioAutomatico: true }, COM_EMAIL);
    expect(await envios()).toHaveLength(0);
  });

  it('marcar como publicado à mão cancela o envio pendente', async () => {
    const id = await agendado();
    await publicarPedido(p, await como(p, COMUNICACAO), id, (await reg(id)).versao, { link: null, comentario: null }, { agora: SEXTA });
    expect((await envios())[0].situacao).toBe('cancelado');
  });
});

describe('rotina', () => {
  it('antes da hora não envia; na hora envia em cópia oculta e registra no histórico', async () => {
    const id = await agendado();
    expect(await rodarEnvios(p, meios(), SEXTA)).toMatchObject({ enviados: 0 });
    expect(email.enviadas).toHaveLength(0);
    expect(await rodarEnvios(p, meios(), NA_HORA)).toMatchObject({ enviados: 1 });
    expect(email.enviadas).toHaveLength(1);
    expect(email.enviadas[0]).toMatchObject({ cco: ['redacao@jornal.exemplo.local'], assunto: 'Setembro Verde', texto: 'Texto fictício do release.' });
    expect(email.enviadas[0].para).toBeUndefined();
    const [e] = await envios();
    expect(e).toMatchObject({ situacao: 'enviado', enviado_em: NA_HORA.toISOString(), tentativas: 1 });
    const hist = (await lerTabela(p, HistoricoComunicacao)).todos().filter((h) => h.pedido_id === id);
    expect(hist.at(-1)).toMatchObject({ acao: 'envio', para: 'agendado' });
    // o pedido continua Agendado: a Comunicação confirma a publicação
    expect((await reg(id)).situacao).toBe('agendado');
  });

  it('rodar de novo não envia outra vez', async () => {
    await agendado();
    await rodarEnvios(p, meios(), NA_HORA);
    await rodarEnvios(p, meios(), mais(NA_HORA, 30));
    expect(email.enviadas).toHaveLength(1);
  });

  it('usa os contatos ativos na hora do envio: contato desativado sai', async () => {
    await agendado();
    const c = await como(p, COMUNICACAO);
    await salvarContato(p, c, { nome: 'Pauta', veiculo: null, email: 'pauta@radio.exemplo.local', grupos: [grupoId] });
    const lista = (await listarContatos(p, c)).contatos;
    const r = lista.find((x) => x.id === redacao)!;
    await mudarSituacaoContato(p, c, redacao, r.versao, false);
    await rodarEnvios(p, meios(), NA_HORA);
    expect(email.enviadas[0].cco).toEqual(['pauta@radio.exemplo.local']);
  });

  it('leva os anexos do pedido', async () => {
    const id = await agendado();
    const arquivos = new ArquivosMemoria();
    const { url } = await arquivos.iniciarEnvio({ nome: 'nota.pdf', tipo: 'application/pdf', tamanho: 3, origem: 'x' });
    const guardado = arquivos.receber(url.split('/').pop()!, new Uint8Array([1, 2, 3]));
    const { inserir } = await import('@/nucleo/armazenamento/tabela');
    const { AnexosComunicacao } = await import('../dados/tabelas');
    await inserir(p, AnexosComunicacao, { pedido_id: id, tipo: 'documento', arquivo_id: guardado.id, nome: 'nota.pdf', mime: 'application/pdf', tamanho: 3 }, { email: COMUNICACAO });
    await rodarEnvios(p, { email, arquivos }, NA_HORA);
    expect(email.enviadas[0].anexos?.[0]).toMatchObject({ nome: 'nota.pdf', tipo: 'application/pdf' });
    expect([...email.enviadas[0].anexos![0].dados]).toEqual([1, 2, 3]);
  });

  it('pedido com anexo e sem pasta de anexos falha com motivo claro', async () => {
    const id = await agendado();
    const { inserir } = await import('@/nucleo/armazenamento/tabela');
    const { AnexosComunicacao } = await import('../dados/tabelas');
    await inserir(p, AnexosComunicacao, { pedido_id: id, tipo: 'documento', arquivo_id: 'x', nome: 'nota.pdf', mime: 'application/pdf', tamanho: 3 }, { email: COMUNICACAO });
    expect(await rodarEnvios(p, meios(), NA_HORA)).toMatchObject({ falhas: 1, enviados: 0 });
    expect((await envios())[0].erro).toMatch(/pasta de anexos/);
  });

  it('pedido que deixou de estar agendado tem o envio cancelado, sem enviar', async () => {
    const id = await agendado();
    const { atualizar } = await import('@/nucleo/armazenamento/tabela');
    await atualizar(p, PedidosComunicacao, id, (await reg(id)).versao, { situacao: 'cancelado' }, { email: COMUNICACAO });
    expect(await rodarEnvios(p, meios(), NA_HORA)).toMatchObject({ cancelados: 1 });
    expect(email.enviadas).toHaveLength(0);
    expect((await envios())[0].situacao).toBe('cancelado');
  });

  it('envia no máximo 100 por rodada', async () => {
    const { inserirVarios, lerTabela: ler } = await import('@/nucleo/armazenamento/tabela');
    const id = await agendado();
    const t = await ler(p, EnviosComunicacao);
    const modelo = t.todos()[0];
    await inserirVarios(
      p,
      t,
      Array.from({ length: 105 }, () => ({ pedido_id: id, tipo: 'release' as const, assunto: 'A', previsto_para: modelo.previsto_para, proxima_tentativa: modelo.proxima_tentativa, situacao: 'pendente' as const, tentativas: 0 })),
      { email: COMUNICACAO },
    );
    const r = await rodarEnvios(p, meios(), NA_HORA);
    expect(r.enviados).toBe(100);
  });
});

describe('falha e "tentar de novo"', () => {
  it('3 tentativas (+15 e +60 minutos); depois falhou, o pedido segue Agendado e há aviso', async () => {
    const id = await agendado();
    email.falhar = 'O Gmail respondeu 500.';
    expect(await rodarEnvios(p, meios(), NA_HORA)).toMatchObject({ falhas: 1 });
    expect((await envios())[0]).toMatchObject({ situacao: 'pendente', tentativas: 1, proxima_tentativa: mais(NA_HORA, 15).toISOString(), erro: 'O Gmail respondeu 500.' });
    // antes dos 15 minutos nada acontece
    expect(await rodarEnvios(p, meios(), mais(NA_HORA, 10))).toMatchObject({ falhas: 0, esgotados: 0 });
    const t2 = mais(NA_HORA, 15);
    await rodarEnvios(p, meios(), t2);
    expect((await envios())[0]).toMatchObject({ tentativas: 2, proxima_tentativa: mais(t2, 60).toISOString() });
    const t3 = mais(t2, 60);
    expect(await rodarEnvios(p, meios(), t3)).toMatchObject({ esgotados: 1 });
    expect((await envios())[0]).toMatchObject({ situacao: 'falhou', tentativas: 3 });
    expect((await reg(id)).situacao).toBe('agendado');
    // nunca mais tenta sozinho
    await rodarEnvios(p, meios(), mais(t3, 600));
    expect((await envios())[0].tentativas).toBe(3);
    const com = await como(p, COMUNICACAO);
    expect(await contarEnviosFalhos(p, com)).toBe(1);
    expect((await contadoresComunicacao(p, com)).enviosFalharam).toBe(1);
    expect(await contarEnviosFalhos(p, await como(p, FUNCIONARIO))).toBe(0);
  });

  it('o erro gravado não traz endereço nem texto da mensagem', async () => {
    await agendado();
    email.falhar = 'O Gmail recusou a mensagem (400): confira o e-mail de envio e os destinos.';
    await rodarEnvios(p, meios(), NA_HORA);
    const e = (await envios())[0];
    expect(JSON.stringify(e)).not.toContain('redacao@');
    expect(e.erro).not.toContain('Texto fictício');
  });

  it('erro inesperado vira mensagem genérica (nada do erro original vaza)', async () => {
    await agendado();
    email.enviar = async () => {
      throw new Error('segredo@interno.exemplo.local token=abc');
    };
    await rodarEnvios(p, meios(), NA_HORA);
    expect((await envios())[0].erro).not.toContain('segredo');
  });

  it('sem e-mail de envio na hora da rotina, conta como falha', async () => {
    await agendado();
    await rodarEnvios(p, { email: null, arquivos: null }, NA_HORA);
    expect((await envios())[0].erro).toMatch(/e-mail de envio/);
  });

  it('tentar de novo volta o envio para a fila com tentativas novas, e a rotina envia', async () => {
    const id = await agendado();
    email.falhar = 'falha';
    await rodarEnvios(p, meios(), NA_HORA);
    await rodarEnvios(p, meios(), mais(NA_HORA, 15));
    await rodarEnvios(p, meios(), mais(NA_HORA, 75));
    const e = (await envios())[0];
    expect(e.situacao).toBe('falhou');
    const com = await como(p, COMUNICACAO);
    await tentarEnvioDeNovo(p, com, e.id, e.versao, { agora: mais(NA_HORA, 100) });
    expect((await envios())[0]).toMatchObject({ situacao: 'pendente', tentativas: 0, erro: null });
    expect((await auditoriaDe(p, e.id)).at(-1)?.acao).toBe('alteracao');
    email.falhar = null;
    await rodarEnvios(p, meios(), mais(NA_HORA, 101));
    expect((await envios())[0].situacao).toBe('enviado');
    expect(email.enviadas).toHaveLength(1);
    void id;
  });

  it('só um envio que falhou pode ser tentado de novo; versão velha é recusada', async () => {
    await agendado();
    const e = (await envios())[0];
    const com = await como(p, COMUNICACAO);
    await expect(tentarEnvioDeNovo(p, com, e.id, e.versao, { agora: NA_HORA })).rejects.toThrow(/falhou/);
  });
});

describe('quem vê e quem altera', () => {
  it('quem só pede não vê o envio e não pode tentar de novo', async () => {
    const id = await agendado();
    const e = (await envios())[0];
    const f = await como(p, FUNCIONARIO);
    expect(await envioDoPedido(p, f, id)).toBeNull();
    await expect(tentarEnvioDeNovo(p, f, e.id, e.versao)).rejects.toBeInstanceOf(ErroPermissao);
  });

  it('a Comunicação vê a situação do envio', async () => {
    const id = await agendado();
    expect(await envioDoPedido(p, await como(p, COMUNICACAO), id)).toMatchObject({ situacao: 'pendente', previstoPara: '2026-11-07T13:00:00.000Z' });
    expect(await envioDoPedido(p, await como(p, COORDENACAO), id)).not.toBeNull();
  });

  it('quem só pede não agenda (nem com envio automático)', async () => {
    const id = await aprovado();
    await expect(
      agendarPedido(p, await como(p, FUNCIONARIO), id, (await reg(id)).versao, { agendadoPara: HORA, grupos: [grupoId], contatos: [], envioAutomatico: true }, COM_EMAIL),
    ).rejects.toBeInstanceOf(ErroPermissao);
    expect(await envios()).toHaveLength(0);
  });

  it('as colunas de Envios têm sigilo pessoal nos destinatários', async () => {
    expect(EnviosComunicacao.sigilo?.destinatarios).toBe('pessoal');
  });
});
