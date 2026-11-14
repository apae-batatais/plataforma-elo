/** Indicadores da Comunicação: conjunto pequeno montado à mão (dados FICTÍCIOS), valores esperados escritos. */
import { beforeEach, describe, expect, it } from 'vitest';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import type { Planilhas } from '@/nucleo/armazenamento/tabela';
import { indicadoresComunicacao } from '../aplicacao/indicadores';
import type { RegCalendario, RegHistorico, RegPedido } from '../dados/tabelas';
import { montarIndicadores, periodoDe } from '../dominio/indicadores';
import type { Situacao } from '../dominio/pedido';
import { popularComunicacaoFicticia } from '../dados/ficticios';
import { COMUNICACAO, COORDENACAO, como, DIRETORIA, FUNCIONARIO, planilhasDeComunicacao } from './apoio';

const controle = { versao: 1, ativo: true, criado_em: '', criado_por: '', atualizado_em: '', atualizado_por: '' };
const noite = (dia: string) => `${dia}T15:00:00.000Z`; // meio-dia em Brasília

function pedido(x: Partial<RegPedido> & { id: string }): RegPedido {
  return {
    ...controle,
    numero: `COM-2026-${x.id}`,
    solicitante: FUNCIONARIO,
    solicitante_nome: 'Pessoa fictícia',
    area: 'educacao',
    calendario_id: null,
    calendario_tema: null,
    tipo_peca: 'post_instagram',
    titulo: 'T',
    descricao: 'D',
    data_desejada: '2026-11-30',
    urgente: false,
    imagem_confirmada_em: null,
    imagem_confirmada_por: null,
    link_video: null,
    situacao: 'aguardando_revisao',
    juntado_a: null,
    enviado_em: noite('2026-11-02'),
    agendado_para: null,
    destinatarios: null,
    link_publicacao: null,
    publicado_em: null,
    servico: null,
    ...x,
  };
}
let n = 0;
const h = (pedido_id: string, dia: string, acao: string, de: Situacao | null, para: Situacao): RegHistorico => ({
  ...controle,
  id: `h${++n}`,
  pedido_id,
  em: noite(dia),
  usuario: 'x',
  acao,
  de,
  para,
  comentario: null,
});
const tema = (id: string, nome: string, fim: string, ativo = true): RegCalendario => ({ ...controle, id, ativo, tema: nome, tipo_data: 'exata', inicio: fim, fim, tipos: 'post_instagram', observacao: null });

// 2026-11-02 é segunda-feira.
const A = pedido({ id: 'A', calendario_id: 'T1', calendario_tema: 'Setembro Verde', situacao: 'publicado', data_desejada: '2026-11-10', publicado_em: noite('2026-11-10') });
const B = pedido({
  id: 'B',
  enviado_em: noite('2026-11-04'),
  urgente: true,
  area: 'saude',
  tipo_peca: 'release',
  calendario_id: 'T1',
  calendario_tema: 'Setembro Verde',
  situacao: 'publicado',
  data_desejada: '2026-11-18',
  publicado_em: noite('2026-11-20'),
});
const C = pedido({ id: 'C', enviado_em: noite('2026-11-12') });
const HIST: RegHistorico[] = [
  h('A', '2026-11-02', 'enviar', null, 'aguardando_revisao'),
  h('A', '2026-11-02', 'iniciar_revisao', 'aguardando_revisao', 'em_revisao'),
  h('A', '2026-11-03', 'enviar_aprovacao', 'em_revisao', 'aguardando_aprovacao'),
  h('A', '2026-11-05', 'aprovar', 'aguardando_aprovacao', 'aprovado'),
  h('A', '2026-11-06', 'agendar', 'aprovado', 'agendado'),
  h('A', '2026-11-10', 'publicar', 'agendado', 'publicado'),
  h('B', '2026-11-04', 'enviar', null, 'aguardando_revisao'),
  h('B', '2026-11-04', 'iniciar_revisao', 'aguardando_revisao', 'em_revisao'),
  h('B', '2026-11-06', 'enviar_aprovacao', 'em_revisao', 'aguardando_aprovacao'),
  h('B', '2026-11-09', 'aprovar', 'aguardando_aprovacao', 'aprovado'),
  h('B', '2026-11-10', 'agendar', 'aprovado', 'agendado'),
  h('B', '2026-11-20', 'publicar', 'agendado', 'publicado'),
  h('C', '2026-11-12', 'enviar', null, 'aguardando_revisao'),
];
const CAL = [tema('T1', 'Setembro Verde', '2026-11-20'), tema('T2', 'Dia sem publicação', '2026-11-25'), tema('T3', 'Fora do mês', '2026-12-01'), tema('T4', 'Desativado', '2026-11-26', false)];
const NOVEMBRO = { inicio: '2026-11-01', fim: '2026-11-30' };

describe('cálculo dos indicadores', () => {
  const r = montarIndicadores({ pedidos: [A, B, C], historico: HIST, calendario: CAL, periodo: NOVEMBRO });

  it('volume por área, tipo e tema, e urgentes', () => {
    expect(r.volume.total).toBe(3);
    expect(r.volume.porArea).toEqual({ educacao: 2, saude: 1 });
    expect(r.volume.porTipo).toMatchObject({ post_instagram: 2, release: 1, artigo: 0 });
    expect(r.volume.porTema).toEqual([
      { tema: 'Setembro Verde', total: 2 },
      { tema: 'Fora do calendário', total: 1 },
    ]);
    expect(r.urgentes).toBe(1);
  });

  it('tempos em dias úteis, com média de 1 casa', () => {
    expect(r.tempoRevisao).toBe(1.5); // A: 1 dia útil; B: 2
    expect(r.tempoAprovacao).toBe(1.5); // A: de 03 a 05 = 2; B: de 06 a 09 = 1
    expect(r.tempoPublicacao).toBe(9); // A: 02→10 = 6; B: 04→20 = 12
  });

  it('publicados com atraso e temas sem publicação', () => {
    expect(r.publicadosComAtraso).toEqual({ percentual: 50, atrasados: 1, publicados: 2 });
    expect(r.temasSemPublicacao).toEqual([{ id: 'T2', tema: 'Dia sem publicação', fim: '2026-11-25' }]);
  });

  it('período sem dados devolve nulos, e a publicação à noite conta o dia de Brasília', () => {
    const vazio = montarIndicadores({ pedidos: [A, B, C], historico: HIST, calendario: [], periodo: { inicio: '2026-01-01', fim: '2026-01-31' } });
    expect(vazio).toMatchObject({
      volume: { total: 0 },
      tempoRevisao: null,
      tempoAprovacao: null,
      tempoPublicacao: null,
      publicadosComAtraso: { percentual: null, atrasados: 0, publicados: 0 },
      urgentes: 0,
      temasSemPublicacao: [],
    });
    // 01:00 UTC de 11-11 ainda é 10 de novembro em Brasília: no prazo.
    const tarde = pedido({ id: 'D', situacao: 'publicado', data_desejada: '2026-11-10', publicado_em: '2026-11-11T01:00:00.000Z' });
    expect(montarIndicadores({ pedidos: [tarde], historico: [], calendario: [], periodo: NOVEMBRO }).publicadosComAtraso).toEqual({ percentual: 0, atrasados: 0, publicados: 1 });
  });

  it('pedido devolvido e reenviado conta uma revisão por envio', () => {
    const hs = [
      h('E', '2026-11-02', 'enviar', null, 'aguardando_revisao'),
      h('E', '2026-11-02', 'iniciar_revisao', 'aguardando_revisao', 'em_revisao'),
      h('E', '2026-11-03', 'devolver', 'em_revisao', 'devolvido'), // 1 dia útil
      h('E', '2026-11-04', 'reenviar', 'devolvido', 'aguardando_revisao'),
      h('E', '2026-11-05', 'iniciar_revisao', 'aguardando_revisao', 'em_revisao'),
      h('E', '2026-11-09', 'enviar_aprovacao', 'em_revisao', 'aguardando_aprovacao'), // 04→09 = 3 dias úteis
    ];
    expect(montarIndicadores({ pedidos: [pedido({ id: 'E' })], historico: hs, calendario: [], periodo: NOVEMBRO }).tempoRevisao).toBe(2);
  });
});

describe('período', () => {
  it('mês, trimestre e ano', () => {
    expect(periodoDe('mes', '2026-02')).toMatchObject({ inicio: '2026-02-01', fim: '2026-02-28' });
    expect(periodoDe('trimestre', '2026-11')).toMatchObject({ inicio: '2026-10-01', fim: '2026-12-31', rotulo: '4º trimestre de 2026' });
    expect(periodoDe('ano', '2026-11')).toMatchObject({ inicio: '2026-01-01', fim: '2026-12-31' });
  });
});

describe('quem vê os indicadores', () => {
  let p: Planilhas;
  beforeEach(async () => {
    p = await planilhasDeComunicacao();
    await popularComunicacaoFicticia(p);
  });

  it('Funcionário e Comunicação recebem ErroPermissao; coordenação e Diretoria recebem os números', async () => {
    const periodo = periodoDe('ano', '2026-11');
    for (const email of [FUNCIONARIO, COMUNICACAO]) await expect(indicadoresComunicacao(p, await como(p, email), periodo)).rejects.toThrow(ErroPermissao);
    for (const email of [COORDENACAO, DIRETORIA]) {
      const r = await indicadoresComunicacao(p, await como(p, email), periodo);
      expect(r.volume.total).toBeGreaterThan(0);
      expect(r.areas.reduce((s, a) => s + a.total, 0)).toBe(r.volume.total);
    }
  });

  it('recusa período inválido', async () => {
    await expect(indicadoresComunicacao(p, await como(p, COORDENACAO), { inicio: '2026-12-01', fim: '2026-11-01' })).rejects.toThrow('Informe um período válido.');
  });
});
