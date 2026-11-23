/** Entrega L5, parte 3 (regra L20): campo Projeto no pedido de divulgação e leitura para o Projetos, com dados FICTÍCIOS. */
import { describe, expect, it } from 'vitest';
import { atualizar, lerTabela } from '@/nucleo/armazenamento/tabela';
import { cancelarPedido, enviarPedido, pedidosDoProjeto, reenviarPedido, type DadosPedido, type ProjetoParaPedido } from '../aplicacao/pedidos';
import { PedidosComunicacao } from '../dados/tabelas';
import { auditoriaDe, COMUNICACAO, como, FUNCIONARIO, OUTRO_FUNCIONARIO, planilhasDeComunicacao } from './apoio';

const AGORA = { agora: new Date('2026-11-06T15:00:00Z') };
const EVENTO: ProjetoParaPedido = { id: 'prj-1', codigo: 'PRJ-0001', titulo: 'Bazar de exemplo' };

const dados = (x: Partial<DadosPedido> = {}): DadosPedido & { nomeSolicitante: string } => ({
  area: 'educacao',
  calendarioId: null,
  tipoPeca: 'post_instagram',
  titulo: 'Convite do bazar',
  descricao: 'Texto fictício.',
  dataDesejada: '2026-11-25',
  linkVideo: null,
  imagemConfirmada: false,
  nomeSolicitante: 'Pessoa fictícia',
  ...x,
});

describe('campo Projeto no pedido (L20)', () => {
  it('grava o projeto escolhido da lista e a auditoria guarda só as colunas', async () => {
    const p = await planilhasDeComunicacao();
    const r = await enviarPedido(p, await como(p, FUNCIONARIO), dados({ projetoId: EVENTO.id }), { ...AGORA, projetos: [EVENTO] });
    const linha = (await lerTabela(p, PedidosComunicacao)).porId(r.id)!;
    expect(linha.projeto_id).toBe('prj-1');
    expect(linha.projeto_codigo).toBe('PRJ-0001');
    const audit = JSON.stringify(await auditoriaDe(p, r.id));
    expect(audit).toContain('projeto_id');
    expect(audit).not.toContain('Bazar de exemplo');
  });

  it('sem projeto o pedido segue como antes', async () => {
    const p = await planilhasDeComunicacao();
    const r = await enviarPedido(p, await como(p, FUNCIONARIO), dados(), AGORA);
    expect((await lerTabela(p, PedidosComunicacao)).porId(r.id)!.projeto_id ?? null).toBeNull();
  });

  it('projeto que a pessoa não pode escolher é recusado, inclusive sem Projetos ativo', async () => {
    const p = await planilhasDeComunicacao();
    const quem = await como(p, FUNCIONARIO);
    await expect(enviarPedido(p, quem, dados({ projetoId: 'outro' }), { ...AGORA, projetos: [EVENTO] })).rejects.toThrow(/não está disponível/);
    await expect(enviarPedido(p, quem, dados({ projetoId: EVENTO.id }), { ...AGORA, projetos: null })).rejects.toThrow(/não está disponível/);
  });

  it('ao ajustar, o projeto já gravado continua mesmo se saiu da lista; trocar exige um da lista', async () => {
    const p = await planilhasDeComunicacao();
    const quem = await como(p, FUNCIONARIO);
    const r = await enviarPedido(p, quem, dados({ projetoId: EVENTO.id }), { ...AGORA, projetos: [EVENTO] });
    const reg = (await lerTabela(p, PedidosComunicacao)).porId(r.id)!;
    await atualizar(p, PedidosComunicacao, r.id, reg.versao, { situacao: 'devolvido' }, { email: COMUNICACAO });
    const v = (await lerTabela(p, PedidosComunicacao)).porId(r.id)!.versao;
    await reenviarPedido(p, quem, r.id, v, dados({ projetoId: EVENTO.id, titulo: 'Convite novo' }), { ...AGORA, projetos: [] });
    expect((await lerTabela(p, PedidosComunicacao)).porId(r.id)!.projeto_id).toBe('prj-1');
    // Trocar por outro projeto que não está na lista é recusado.
    const v2 = (await lerTabela(p, PedidosComunicacao)).porId(r.id)!;
    await atualizar(p, PedidosComunicacao, r.id, v2.versao, { situacao: 'devolvido' }, { email: COMUNICACAO });
    await expect(reenviarPedido(p, quem, r.id, v2.versao + 1, dados({ projetoId: 'outro' }), { ...AGORA, projetos: [EVENTO] })).rejects.toThrow(/não está disponível/);
  });
});

describe('pedidosDoProjeto (L20)', () => {
  it('lista número, título e situação, conta os pendentes e nunca traz o nome de quem pediu', async () => {
    const p = await planilhasDeComunicacao();
    const a = await enviarPedido(p, await como(p, FUNCIONARIO), dados({ projetoId: EVENTO.id }), { ...AGORA, projetos: [EVENTO] });
    await enviarPedido(p, await como(p, OUTRO_FUNCIONARIO), dados({ titulo: 'Sem projeto' }), AGORA);
    const b = await enviarPedido(p, await como(p, FUNCIONARIO), dados({ projetoId: EVENTO.id, titulo: 'Cartaz do bazar' }), { ...AGORA, projetos: [EVENTO] });
    await cancelarPedido(p, await como(p, FUNCIONARIO), b.id, (await lerTabela(p, PedidosComunicacao)).porId(b.id)!.versao, AGORA);
    const lida = await pedidosDoProjeto(p, await como(p, COMUNICACAO), EVENTO.id);
    expect(lida.estado).toBe('ok');
    if (lida.estado !== 'ok') return;
    expect(lida.dados.map((x) => x.numero).sort()).toEqual([a.numero, b.numero].sort());
    expect(lida.dados.filter((x) => x.pendente)).toHaveLength(1);
    expect(lida.dados.find((x) => x.id === b.id)?.situacaoNome).toBe('Cancelado');
    expect(JSON.stringify(lida.dados)).not.toContain('Pessoa fictícia');
    expect(JSON.stringify(lida.dados)).not.toContain('@');
  });

  it('quem não tem acesso à Comunicação recebe "sem permissão"', async () => {
    const p = await planilhasDeComunicacao();
    const lida = await pedidosDoProjeto(p, await como(p, 'ninguem@exemplo.local'), EVENTO.id);
    expect(lida.estado).toBe('sem_permissao');
  });
});
