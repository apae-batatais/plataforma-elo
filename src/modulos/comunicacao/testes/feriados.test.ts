/** Feriados do Núcleo na urgência dos pedidos da Comunicação. */
import { beforeEach, describe, expect, it } from 'vitest';
import type { Planilhas } from '@/nucleo/armazenamento/tabela';
import { incluirFeriado } from '@/nucleo/feriados/feriados';
import { detalharPedido, enviarPedido, opcoesDoPedido, type DadosPedido } from '../aplicacao/pedidos';
import { FUNCIONARIO, como, planilhasDeComunicacao } from './apoio';

const SEXTA = { agora: new Date('2026-11-06T15:00:00Z') };
let p: Planilhas;
beforeEach(async () => {
  p = await planilhasDeComunicacao();
});

// Sexta 6/11 + 5 dias úteis = 13/11; com feriado numa quarta (11/11), 16/11.
const dados = (dataDesejada: string): DadosPedido & { nomeSolicitante: string } => ({
  area: 'educacao',
  calendarioId: null,
  tipoPeca: 'post_instagram',
  titulo: 'Convite',
  descricao: 'Texto fictício.',
  dataDesejada,
  linkVideo: null,
  imagemConfirmada: false,
  nomeSolicitante: 'Pessoa',
});

describe('urgência com feriados do Núcleo', () => {
  it('sem feriado o pedido é normal; com feriado cadastrado no Núcleo vira urgente', async () => {
    const normal = await enviarPedido(p, await como(p, FUNCIONARIO), dados('2026-11-13'), SEXTA);
    expect((await detalharPedido(p, await como(p, FUNCIONARIO), normal.id)).pedido.urgente).toBe(false);

    await incluirFeriado(p, await como(p, 'admin@exemplo.local'), { data: '2026-11-11', nome: 'Feriado de teste' });
    const urgente = await enviarPedido(p, await como(p, FUNCIONARIO), dados('2026-11-13'), SEXTA);
    expect((await detalharPedido(p, await como(p, FUNCIONARIO), urgente.id)).pedido.urgente).toBe(true);
    // Pedido já enviado não é recalculado ao incluir o feriado.
    expect((await detalharPedido(p, await como(p, FUNCIONARIO), normal.id)).pedido.urgente).toBe(false);
  });

  it('o formulário recebe as datas dos feriados', async () => {
    await incluirFeriado(p, await como(p, 'admin@exemplo.local'), { data: '2026-11-11', nome: 'Feriado de teste' });
    expect((await opcoesDoPedido(p, await como(p, FUNCIONARIO), SEXTA)).feriados).toEqual(['2026-11-11']);
  });
});

