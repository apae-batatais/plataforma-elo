/** Agendar, e-mail pronto e publicar, com dados FICTÍCIOS: regras, histórico, auditoria e quem pode. */
import { beforeEach, describe, expect, it } from 'vitest';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ErroConflito, lerTabela, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { listarContatos, mudarSituacaoContato, salvarContato, salvarGrupo } from '../aplicacao/contatos';
import {
  agendarPedido,
  decidirPedido,
  emailProntoDoPedido,
  enviarPedido,
  publicarPedido,
  revisarPedido,
} from '../aplicacao/pedidos';
import { HistoricoComunicacao, PedidosComunicacao } from '../dados/tabelas';
import { montarEmailPronto } from '../dominio/email-pronto';
import type { TipoPeca } from '../dominio/pedido';
import { dataHoraEmBrasilia } from '../dominio/prazos';
import { auditoriaDe, COMUNICACAO, COORDENACAO, como, DIRETORIA, FUNCIONARIO, planilhasDeComunicacao } from './apoio';

let p: Planilhas;
let grupoId: string;
let grupoSoComInativos: string;
const SEXTA = { agora: new Date('2026-11-06T15:00:00Z') };
const AMANHA_10H = '2026-11-07T10:00:00-03:00';
const DEPOIS_DE_AMANHA_10H = '2026-11-08T10:00:00-03:00';

const reg = async (id: string) => (await lerTabela(p, PedidosComunicacao)).porId(id)!;
const historicoDe = async (id: string) => (await lerTabela(p, HistoricoComunicacao)).todos().filter((h) => h.pedido_id === id);

beforeEach(async () => {
  p = await planilhasDeComunicacao();
  const c = await como(p, COMUNICACAO);
  grupoId = (await salvarGrupo(p, c, { nome: 'Jornais fictícios' })).id;
  await salvarContato(p, c, { nome: 'Redação', veiculo: null, email: 'redacao@jornal.exemplo.local', grupos: [grupoId] });
  grupoSoComInativos = (await salvarGrupo(p, c, { nome: 'Rádios antigas' })).id;
  const { id } = await salvarContato(p, c, { nome: 'Pauta', veiculo: null, email: 'pauta@radio.exemplo.local', grupos: [grupoSoComInativos] });
  const v = (await listarContatos(p, c)).contatos.find((x) => x.id === id)!.versao;
  await mudarSituacaoContato(p, c, id, v, false);
});

async function aprovado(tipoPeca: TipoPeca) {
  const { id } = await enviarPedido(
    p,
    await como(p, FUNCIONARIO),
    { area: 'educacao', calendarioId: null, tipoPeca, titulo: 'Setembro Verde', descricao: 'Texto fictício.', dataDesejada: '2026-11-25', linkVideo: null, imagemConfirmada: false, nomeSolicitante: 'Pessoa' },
    SEXTA,
  );
  const c = await como(p, COMUNICACAO);
  await revisarPedido(p, c, id, (await reg(id)).versao, 'iniciar_revisao', null, SEXTA);
  await revisarPedido(p, c, id, (await reg(id)).versao, 'enviar_aprovacao', null, SEXTA);
  await decidirPedido(p, await como(p, COORDENACAO), id, (await reg(id)).versao, 'aprovar', null, SEXTA);
  return { id, versao: (await reg(id)).versao };
}
async function agendado(tipoPeca: TipoPeca) {
  const a = await aprovado(tipoPeca);
  await agendarPedido(p, await como(p, COMUNICACAO), a.id, a.versao, { agendadoPara: AMANHA_10H, grupos: [grupoId], contatos: [] }, SEXTA);
  return { id: a.id, versao: (await reg(a.id)).versao };
}

describe('e-mail pronto', () => {
  it('cópia oculta, assunto e texto; lista longa vira endereços para copiar', () => {
    const curto = montarEmailPronto({ destinatarios: ['a@jornal.com', 'b@radio.com'], assunto: 'Setembro Verde', corpo: 'Texto' });
    expect(curto.url).toBe('https://mail.google.com/mail/?view=cm&fs=1&bcc=a%40jornal.com%2Cb%40radio.com&su=Setembro%20Verde&body=Texto');
    expect(curto.enderecosNoLink).toBe(true);
    const longo = montarEmailPronto({ destinatarios: Array.from({ length: 120 }, (_, i) => `contato${i}@veiculo-ficticio.com`), assunto: 'A', corpo: 'B' });
    expect(longo.enderecosNoLink).toBe(false);
    expect(longo.url).not.toContain('bcc=');
    expect(longo.url).toContain('su=A');
    expect(longo.enderecos).toHaveLength(120);
  });

  it('o pedido agendado monta o e-mail com os contatos ativos; só a equipe vê', async () => {
    const { id } = await agendado('release');
    const e = await emailProntoDoPedido(p, await como(p, COMUNICACAO), id);
    expect(e.enderecos).toEqual(['redacao@jornal.exemplo.local']);
    expect(e.url).toContain('su=Setembro%20Verde');
    await expect(emailProntoDoPedido(p, await como(p, FUNCIONARIO), id)).rejects.toThrow(ErroPermissao);
  });

  it('post agendado não tem e-mail pronto', async () => {
    const { id } = await agendado('post_instagram');
    await expect(emailProntoDoPedido(p, await como(p, COMUNICACAO), id)).rejects.toThrow('só existe para release e artigo');
  });
});

describe('agendar', () => {
  it('só aprovado, no futuro, release com destinatário ativo', async () => {
    const { id, versao } = await aprovado('release');
    const c = await como(p, COMUNICACAO);
    await expect(agendarPedido(p, c, id, versao, { agendadoPara: '2020-01-01T10:00:00-03:00', grupos: [grupoId], contatos: [] }, SEXTA)).rejects.toThrow('Escolha uma data e hora no futuro.');
    await expect(agendarPedido(p, c, id, versao, { agendadoPara: AMANHA_10H, grupos: [grupoSoComInativos], contatos: [] }, SEXTA)).rejects.toThrow(
      'Escolha pelo menos um contato ativo para receber o e-mail.',
    );
    await expect(agendarPedido(p, c, id, versao, { agendadoPara: 'lixo', grupos: [grupoId], contatos: [] }, SEXTA)).rejects.toThrow('Informe a data e a hora');
    expect((await reg(id)).situacao).toBe('aprovado');
    await agendarPedido(p, c, id, versao, { agendadoPara: AMANHA_10H, grupos: [grupoId], contatos: [] }, SEXTA);
    const r = await reg(id);
    expect(r).toMatchObject({ situacao: 'agendado', agendado_para: '2026-11-07T13:00:00.000Z' });
    expect(JSON.parse(r.destinatarios!)).toEqual({ grupos: [grupoId], contatos: [] });
    const audit = await auditoriaDe(p, id);
    expect(audit.at(-1)?.detalhes).toContain('agendado_para');
    expect(audit.at(-1)?.detalhes).not.toContain('2026-11-07');
  });

  it('reagendar mantém Agendado e guarda a data anterior no histórico', async () => {
    const { id, versao } = await agendado('release');
    await agendarPedido(p, await como(p, COMUNICACAO), id, versao, { agendadoPara: DEPOIS_DE_AMANHA_10H, grupos: [grupoId], contatos: [] }, SEXTA);
    expect((await reg(id)).situacao).toBe('agendado');
    expect((await historicoDe(id)).at(-1)).toMatchObject({ acao: 'reagendar', de: 'agendado', para: 'agendado', comentario: 'Data anterior: 07/11/2026 10:00.' });
  });

  it('post não pede destinatário; só a Comunicação, a coordenação e a Diretoria agendam', async () => {
    const { id, versao } = await aprovado('post_instagram');
    await expect(agendarPedido(p, await como(p, FUNCIONARIO), id, versao, { agendadoPara: AMANHA_10H, grupos: [], contatos: [] }, SEXTA)).rejects.toThrow(ErroPermissao);
    await agendarPedido(p, await como(p, DIRETORIA), id, versao, { agendadoPara: AMANHA_10H, grupos: [], contatos: [] }, SEXTA);
    expect((await reg(id)).destinatarios).toBeNull();
  });

  it('pedido fora de Aprovado ou Agendado não agenda; versão antiga dá conflito', async () => {
    const { id } = await enviarPedido(
      p,
      await como(p, FUNCIONARIO),
      { area: 'educacao', calendarioId: null, tipoPeca: 'post_instagram', titulo: 'X', descricao: 'Y', dataDesejada: '2026-11-25', linkVideo: null, imagemConfirmada: false, nomeSolicitante: 'P' },
      SEXTA,
    );
    const c = await como(p, COMUNICACAO);
    await expect(agendarPedido(p, c, id, (await reg(id)).versao, { agendadoPara: AMANHA_10H, grupos: [], contatos: [] }, SEXTA)).rejects.toThrow('Esta ação não vale');
    const a = await aprovado('post_instagram');
    await expect(agendarPedido(p, c, a.id, a.versao + 5, { agendadoPara: AMANHA_10H, grupos: [], contatos: [] }, SEXTA)).rejects.toThrow(ErroConflito);
  });

  it('a data anterior aparece no horário de Brasília', () => {
    expect(dataHoraEmBrasilia('2026-11-07T01:30:00.000Z')).toBe('06/11/2026 22:30');
  });
});

describe('publicar', () => {
  it('post exige link; entrevista fica Realizada', async () => {
    const post = await agendado('post_instagram');
    const c = await como(p, COMUNICACAO);
    await expect(publicarPedido(p, c, post.id, post.versao, { link: null, comentario: null }, SEXTA)).rejects.toThrow('Cole o link da publicação no Instagram.');
    await expect(publicarPedido(p, c, post.id, post.versao, { link: 'http://x', comentario: null }, SEXTA)).rejects.toThrow('começando com https://');
    await publicarPedido(p, c, post.id, post.versao, { link: 'https://instagram.com/p/ficticio', comentario: null }, SEXTA);
    expect(await reg(post.id)).toMatchObject({ situacao: 'publicado', link_publicacao: 'https://instagram.com/p/ficticio', publicado_em: SEXTA.agora.toISOString() });
    const ent = await agendado('entrevista');
    await publicarPedido(p, c, ent.id, ent.versao, { link: null, comentario: 'Rádio local' }, SEXTA);
    expect((await reg(ent.id)).situacao).toBe('realizada');
    expect((await historicoDe(ent.id)).at(-1)).toMatchObject({ acao: 'publicar', para: 'realizada', comentario: 'Rádio local' });
  });

  it('release publicado registra a data do envio, sem link', async () => {
    const rel = await agendado('release');
    await publicarPedido(p, await como(p, COMUNICACAO), rel.id, rel.versao, { link: null, comentario: null }, SEXTA);
    expect(await reg(rel.id)).toMatchObject({ situacao: 'publicado', link_publicacao: null, publicado_em: SEXTA.agora.toISOString() });
  });

  it('só pedido agendado, e só a equipe da Comunicação', async () => {
    const a = await aprovado('post_instagram');
    const c = await como(p, COMUNICACAO);
    await expect(publicarPedido(p, c, a.id, a.versao, { link: 'https://x.local', comentario: null }, SEXTA)).rejects.toThrow('Esta ação não vale');
    const g = await agendado('post_instagram');
    await expect(publicarPedido(p, await como(p, FUNCIONARIO), g.id, g.versao, { link: 'https://x.local', comentario: null }, SEXTA)).rejects.toThrow(ErroPermissao);
    // Depois de publicado, é situação final.
    await publicarPedido(p, c, g.id, g.versao, { link: 'https://x.local', comentario: null }, SEXTA);
    await expect(publicarPedido(p, c, g.id, g.versao + 1, { link: 'https://x.local', comentario: null }, SEXTA)).rejects.toThrow('Esta ação não vale');
  });
});
