/** Avisos e lembrete por e-mail (ADR-027, entrega 3), com dados FICTÍCIOS e e-mail em memória. */
import { beforeEach, describe, expect, it } from 'vitest';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { lerTabela, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { EnviadorMemoria } from '@/nucleo/email/email';
import { contarAvisosFalhos, rodarAvisos } from '../aplicacao/avisos';
import { lerAvisosPorEmail, salvarAvisosPorEmail } from '../aplicacao/configuracoes';
import { listarContatos, salvarContato, salvarGrupo } from '../aplicacao/contatos';
import { rodarEnvios } from '../aplicacao/envios';
import { agendarPedido, contadoresComunicacao, decidirPedido, enviarPedido, publicarPedido, revisarPedido } from '../aplicacao/pedidos';
import { EnviosComunicacao, HistoricoComunicacao, PedidosComunicacao } from '../dados/tabelas';
import { auditoriaDe, COMUNICACAO, COORDENACAO, como, DIRETORIA, FUNCIONARIO, planilhasDeComunicacao } from './apoio';

let p: Planilhas;
let email: EnviadorMemoria;
const SEXTA = new Date('2026-11-06T15:00:00Z');
const COM_EMAIL: { agora: Date; emailDisponivel?: boolean } = { agora: SEXTA, emailDisponivel: true };
const SEM_EMAIL: { agora: Date; emailDisponivel?: boolean } = { agora: SEXTA };
const BASE = 'https://elo.exemplo.local';
const meios = () => ({ email, urlBase: BASE });
const reg = async (id: string) => (await lerTabela(p, PedidosComunicacao)).porId(id)!;
const envios = async () => (await lerTabela(p, EnviosComunicacao)).todos();
const mais = (d: Date, min: number) => new Date(d.getTime() + min * 60_000);

async function ligar(ligado = true) {
  const { versao } = await lerAvisosPorEmail(p);
  await salvarAvisosPorEmail(p, await como(p, COORDENACAO), ligado, { agora: SEXTA, versao });
}

async function novo(tipoPeca: 'release' | 'post_instagram' | 'entrevista' = 'release') {
  const { id } = await enviarPedido(
    p,
    await como(p, FUNCIONARIO),
    { area: 'educacao', calendarioId: null, tipoPeca, titulo: 'Título secreto do pedido', descricao: 'Descrição secreta do pedido.', dataDesejada: '2026-11-25', linkVideo: null, imagemConfirmada: false, nomeSolicitante: 'Pessoa' },
    { agora: SEXTA },
  );
  return id;
}
const revisar = async (id: string, acao: 'iniciar_revisao' | 'enviar_aprovacao' | 'devolver', opcoes = COM_EMAIL) =>
  revisarPedido(p, await como(p, COMUNICACAO), id, (await reg(id)).versao, acao, acao === 'devolver' ? 'Falta ajustar.' : null, opcoes);
const aprovar = async (id: string, opcoes = COM_EMAIL) => decidirPedido(p, await como(p, COORDENACAO), id, (await reg(id)).versao, 'aprovar', null, opcoes);

beforeEach(async () => {
  p = await planilhasDeComunicacao();
  email = new EnviadorMemoria('nao-responda@exemplo.local');
});

describe('configuração dos avisos', () => {
  it('começa desligado; só a coordenação liga e desliga, com auditoria só de colunas', async () => {
    expect((await lerAvisosPorEmail(p)).ligado).toBe(false);
    await expect(salvarAvisosPorEmail(p, await como(p, COMUNICACAO), true)).rejects.toThrow(ErroPermissao);
    await expect(salvarAvisosPorEmail(p, await como(p, FUNCIONARIO), true)).rejects.toThrow(ErroPermissao);
    await ligar(true);
    expect((await lerAvisosPorEmail(p)).ligado).toBe(true);
    await ligar(false);
    expect((await lerAvisosPorEmail(p)).ligado).toBe(false);
  });
});

describe('criação do aviso com a mudança de situação', () => {
  it('devolver, enviar para aprovação e publicar criam o aviso certo', async () => {
    await ligar();
    const id = await novo();
    await revisar(id, 'iniciar_revisao');
    await revisar(id, 'devolver');
    expect((await envios()).map((e) => [e.tipo, e.modelo, e.pedido_id])).toEqual([['aviso', 'devolvido', id]]);
    const id2 = await novo('post_instagram');
    await revisar(id2, 'iniciar_revisao');
    await revisar(id2, 'enviar_aprovacao');
    expect((await envios()).map((e) => e.modelo)).toEqual(['devolvido', 'aprovacao']);
    await aprovar(id2);
    await agendarPedido(p, await como(p, COMUNICACAO), id2, (await reg(id2)).versao, { agendadoPara: '2026-11-07T10:00:00-03:00', grupos: [], contatos: [] }, COM_EMAIL);
    await publicarPedido(p, await como(p, COMUNICACAO), id2, (await reg(id2)).versao, { link: 'https://exemplo.local/p/1', comentario: null }, COM_EMAIL);
    expect((await envios()).map((e) => e.modelo)).toEqual(['devolvido', 'aprovacao', 'publicado']);
    const a = (await envios())[0];
    expect((await auditoriaDe(p, a.id)).map((x) => x.acao)).toEqual(['inclusao']);
    expect(JSON.stringify(await auditoriaDe(p, a.id))).not.toContain('secreto');
    expect(JSON.stringify(await envios())).not.toContain('Descrição secreta');
  });

  it('com os avisos desligados, ou sem e-mail de envio, nada é criado', async () => {
    const id = await novo();
    await revisar(id, 'iniciar_revisao');
    await revisar(id, 'devolver');
    expect(await envios()).toHaveLength(0);
    await ligar();
    const id2 = await novo();
    await revisar(id2, 'iniciar_revisao', SEM_EMAIL);
    await revisar(id2, 'devolver', SEM_EMAIL);
    expect(await envios()).toHaveLength(0);
  });

  it('mudanças que não pedem aviso não criam nada', async () => {
    await ligar();
    const id = await novo();
    await revisar(id, 'iniciar_revisao');
    await revisar(id, 'enviar_aprovacao');
    await decidirPedido(p, await como(p, COORDENACAO), id, (await reg(id)).versao, 'pedir_ajustes', 'Ajuste.', COM_EMAIL);
    expect((await envios()).map((e) => e.modelo)).toEqual(['aprovacao']);
  });
});

describe('rotina dos avisos', () => {
  it('devolvido vai só a quem pediu, com número e link e sem título nem descrição', async () => {
    await ligar();
    const id = await novo();
    await revisar(id, 'iniciar_revisao');
    await revisar(id, 'devolver');
    const numero = (await reg(id)).numero;
    expect(await rodarAvisos(p, meios(), SEXTA)).toMatchObject({ enviados: 1 });
    expect(email.enviadas).toHaveLength(1);
    const m = email.enviadas[0];
    expect(m.para).toEqual([FUNCIONARIO]);
    expect(m.assunto).toBe(`Pedido ${numero} devolvido para ajuste`);
    expect(m.texto).toContain('Seu pedido foi devolvido para ajuste.');
    expect(m.texto).toContain(`${BASE}/comunicacao/${id}`);
    expect(JSON.stringify(m)).not.toMatch(/secret/i);
    expect((await envios())[0]).toMatchObject({ situacao: 'enviado', destinatarios: FUNCIONARIO });
    const hist = (await lerTabela(p, HistoricoComunicacao)).todos().filter((h) => h.pedido_id === id).at(-1)!;
    expect(hist).toMatchObject({ acao: 'aviso_enviado', comentario: 'Aviso enviado por e-mail a quem fez o pedido.', para: 'devolvido' });
    expect(hist.comentario).not.toContain('@');
  });

  it('aprovação vai a quem tem comunicacao.aprovar, não à Comunicação nem a quem pediu', async () => {
    await ligar();
    const id = await novo();
    await revisar(id, 'iniciar_revisao');
    await revisar(id, 'enviar_aprovacao');
    await rodarAvisos(p, meios(), SEXTA);
    const m = email.enviadas.find((x) => x.assunto.includes('aguardando aprovação'))!;
    const destinos = [...(m.para ?? []), ...(m.cco ?? [])];
    expect(destinos).toEqual(expect.arrayContaining([COORDENACAO, DIRETORIA]));
    expect(destinos).not.toContain(COMUNICACAO);
    expect(destinos).not.toContain(FUNCIONARIO);
    expect(m.texto).toBe(`Um pedido espera a sua aprovação.\n\nAbrir no Elo: ${BASE}/comunicacao/${id}`);
  });

  it('o aviso que perdeu o sentido (pedido já mudou) é cancelado e não sai', async () => {
    await ligar();
    const id = await novo();
    await revisar(id, 'iniciar_revisao');
    await revisar(id, 'devolver');
    const f = await como(p, FUNCIONARIO);
    const { cancelarPedido } = await import('../aplicacao/pedidos');
    await cancelarPedido(p, f, id, (await reg(id)).versao, { agora: SEXTA });
    await rodarAvisos(p, meios(), SEXTA);
    expect(email.enviadas).toHaveLength(0);
    expect((await envios())[0]).toMatchObject({ situacao: 'cancelado', erro: 'O pedido já mudou de situação.' });
  });

  it('destinatário desativado é ignorado e o aviso não falha', async () => {
    await ligar();
    const id = await novo();
    await revisar(id, 'iniciar_revisao');
    await revisar(id, 'devolver');
    const { Usuarios } = await import('@/nucleo/estrutura/tabelas');
    const { atualizar } = await import('@/nucleo/armazenamento/tabela');
    const u = (await lerTabela(p, Usuarios)).ativos().find((x) => x.email === FUNCIONARIO)!;
    await atualizar(p, Usuarios, u.id, u.versao, { ativo: false } as never, { email: DIRETORIA, agora: () => SEXTA });
    await rodarAvisos(p, meios(), SEXTA);
    expect(email.enviadas).toHaveLength(0);
    expect((await envios())[0]).toMatchObject({ situacao: 'cancelado' });
  });

  it('desligar os avisos cancela o que estava pendente; sem e-mail de envio também', async () => {
    await ligar();
    const id = await novo();
    await revisar(id, 'iniciar_revisao');
    await revisar(id, 'devolver');
    await rodarAvisos(p, { email: null, urlBase: BASE }, SEXTA);
    expect((await envios())[0]).toMatchObject({ situacao: 'cancelado', erro: expect.stringMatching(/e-mail de envio/) });
    expect(email.enviadas).toHaveLength(0);
  });

  it('falha ao enviar: 3 tentativas, depois falhou; a situação do pedido não muda', async () => {
    await ligar();
    const id = await novo();
    await revisar(id, 'iniciar_revisao');
    await revisar(id, 'devolver');
    email.falhar = 'Gmail fora do ar.';
    expect(await rodarAvisos(p, meios(), SEXTA)).toMatchObject({ falhas: 1 });
    expect(await rodarAvisos(p, meios(), SEXTA)).toMatchObject({ enviados: 0, falhas: 0 });
    expect(await rodarAvisos(p, meios(), mais(SEXTA, 16))).toMatchObject({ falhas: 1 });
    expect(await rodarAvisos(p, meios(), mais(SEXTA, 80))).toMatchObject({ esgotados: 1 });
    expect((await envios())[0]).toMatchObject({ situacao: 'falhou', tentativas: 3, erro: 'Gmail fora do ar.' });
    expect((await reg(id)).situacao).toBe('devolvido');
    const hist = (await lerTabela(p, HistoricoComunicacao)).todos().filter((h) => h.pedido_id === id).at(-1)!;
    expect(hist).toMatchObject({ acao: 'aviso_nao_enviado', comentario: 'Aviso por e-mail não enviado: Gmail fora do ar.' });
    expect(await contarAvisosFalhos(p, await como(p, COMUNICACAO), mais(SEXTA, 90))).toBe(1);
    expect(await contarAvisosFalhos(p, await como(p, FUNCIONARIO), mais(SEXTA, 90))).toBe(0);
    expect((await contadoresComunicacao(p, await como(p, COMUNICACAO), { agora: mais(SEXTA, 90) })).enviosFalharam).toBe(1);
  });

  it('a mesma rotina rodando duas vezes não reenvia', async () => {
    await ligar();
    const id = await novo();
    await revisar(id, 'iniciar_revisao');
    await revisar(id, 'devolver');
    await rodarAvisos(p, meios(), SEXTA);
    await rodarAvisos(p, meios(), mais(SEXTA, 15));
    expect(email.enviadas).toHaveLength(1);
  });
});

describe('resumo de pedidos aguardando revisão', () => {
  it('um resumo à Comunicação quando chega pedido novo; sem pedido novo, nada', async () => {
    await ligar();
    await novo();
    await novo();
    await rodarAvisos(p, meios(), SEXTA);
    expect(email.enviadas).toHaveLength(1);
    const m = email.enviadas[0];
    expect(m.assunto).toBe('2 pedidos aguardando revisão');
    expect(m.texto).toBe(`Há 2 pedidos aguardando revisão.\n\nAbrir no Elo: ${BASE}/comunicacao/pedidos`);
    const destinos = [...(m.para ?? []), ...(m.cco ?? [])];
    expect(destinos).toContain(COMUNICACAO);
    expect(destinos).not.toContain(FUNCIONARIO);
    await rodarAvisos(p, meios(), mais(SEXTA, 15));
    await rodarAvisos(p, meios(), mais(SEXTA, 30));
    expect(email.enviadas).toHaveLength(1);
  });

  it('com os avisos desligados, nenhum resumo é criado', async () => {
    await novo();
    await rodarAvisos(p, meios(), SEXTA);
    expect(await envios()).toHaveLength(0);
  });
});

describe('lembrete do dia', () => {
  const DIA = '2026-11-09';
  const OITO = new Date(`${DIA}T08:05:00-03:00`);
  async function agendadoPara(tipo: 'post_instagram' | 'entrevista', dia = DIA) {
    const id = await novo(tipo);
    await revisar(id, 'iniciar_revisao');
    await revisar(id, 'enviar_aprovacao');
    await aprovar(id);
    await agendarPedido(p, await como(p, COMUNICACAO), id, (await reg(id)).versao, { agendadoPara: `${dia}T15:00:00-03:00`, grupos: [], contatos: [] }, COM_EMAIL);
    return id;
  }

  it('às 8h manda um resumo à Comunicação e, rodando de novo no dia, não reenvia', async () => {
    await ligar();
    await agendadoPara('post_instagram');
    await agendadoPara('entrevista');
    await rodarAvisos(p, meios(), new Date(`${DIA}T07:30:00-03:00`));
    expect(email.enviadas.filter((m) => m.assunto.startsWith('Hoje'))).toHaveLength(0);
    await rodarAvisos(p, meios(), OITO);
    await rodarAvisos(p, meios(), mais(OITO, 15));
    await rodarAvisos(p, meios(), mais(OITO, 300));
    const lembretes = email.enviadas.filter((m) => m.assunto.startsWith('Hoje'));
    expect(lembretes).toHaveLength(1);
    expect(lembretes[0].assunto).toBe('Hoje: 2 pedidos para publicar');
    expect(lembretes[0].texto).toBe(`Hoje: 2 pedidos para publicar.\n\nAbrir no Elo: ${BASE}/comunicacao/calendario`);
    expect(JSON.stringify(lembretes[0])).not.toMatch(/secret/i);
    const destinos = [...(lembretes[0].para ?? []), ...(lembretes[0].cco ?? [])];
    expect(destinos).not.toContain(FUNCIONARIO);
  });

  it('dia sem pedido para publicar não envia nada', async () => {
    await ligar();
    await agendadoPara('post_instagram', '2026-11-10');
    await rodarAvisos(p, meios(), OITO);
    expect(email.enviadas.filter((m) => m.assunto.startsWith('Hoje'))).toHaveLength(0);
  });
});

describe('aviso de falha do envio de release', () => {
  const HORA = '2026-11-07T10:00:00-03:00';
  const NA_HORA = new Date('2026-11-07T13:00:00Z');

  async function releaseQueFalhou() {
    const c = await como(p, COMUNICACAO);
    const g = (await salvarGrupo(p, c, { nome: 'Jornais fictícios' })).id;
    await salvarContato(p, c, { nome: 'Redação', veiculo: null, email: 'redacao@jornal.exemplo.local', grupos: [g] });
    void (await listarContatos(p, c));
    const id = await novo('release');
    await revisar(id, 'iniciar_revisao');
    await revisar(id, 'enviar_aprovacao');
    await aprovar(id);
    await agendarPedido(p, c, id, (await reg(id)).versao, { agendadoPara: HORA, grupos: [g], contatos: [], envioAutomatico: true }, COM_EMAIL);
    const releases = new EnviadorMemoria('nao-responda@exemplo.local');
    releases.falhar = 'Sem conexão.';
    for (const min of [0, 20, 90]) await rodarEnvios(p, { email: releases, arquivos: null }, mais(NA_HORA, min));
    return id;
  }

  it('avisa a Comunicação uma vez; o pedido continua Agendado', async () => {
    await ligar();
    const id = await releaseQueFalhou();
    const depois = mais(NA_HORA, 100);
    await rodarAvisos(p, meios(), depois);
    await rodarAvisos(p, meios(), mais(depois, 15));
    const m = email.enviadas.find((x) => x.assunto.includes('falhou'))!;
    expect(email.enviadas.filter((x) => x.assunto.includes('falhou'))).toHaveLength(1);
    expect(m.texto).toContain('Abra o Elo para tentar de novo ou enviar à mão.');
    expect(m.texto).toContain(`${BASE}/comunicacao/${id}`);
    expect([...(m.para ?? []), ...(m.cco ?? [])]).toContain(COMUNICACAO);
    expect((await reg(id)).situacao).toBe('agendado');
    await expect(publicarPedido(p, await como(p, FUNCIONARIO), id, (await reg(id)).versao, { link: null, comentario: null }, COM_EMAIL)).rejects.toThrow(ErroPermissao);
  });

  it('com os avisos desligados não cria aviso de falha', async () => {
    await releaseQueFalhou();
    await rodarAvisos(p, meios(), mais(NA_HORA, 100));
    expect(email.enviadas).toHaveLength(0);
    expect((await envios()).filter((e) => e.tipo === 'aviso')).toHaveLength(0);
  });
});
