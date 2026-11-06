import { describe, expect, it } from 'vitest';
import { COMENTARIO_OBRIGATORIO, ErroComunicacao, SITUACOES_FINAIS, conferirTransicao, proximoNumero } from '../dominio/pedido';

describe('caminho do pedido', () => {
  it('caminho completo do pedido', () => {
    expect(conferirTransicao('aguardando_revisao', 'iniciar_revisao', 'release')).toBe('em_revisao');
    expect(conferirTransicao('em_revisao', 'enviar_aprovacao', 'release')).toBe('aguardando_aprovacao');
    expect(conferirTransicao('em_revisao', 'devolver', 'release')).toBe('devolvido');
    expect(conferirTransicao('em_revisao', 'juntar', 'release')).toBe('juntado');
    expect(conferirTransicao('devolvido', 'reenviar', 'release')).toBe('aguardando_revisao');
    expect(conferirTransicao('devolvido', 'cancelar', 'release')).toBe('cancelado');
    expect(conferirTransicao('aguardando_revisao', 'cancelar', 'release')).toBe('cancelado');
    expect(conferirTransicao('aguardando_aprovacao', 'aprovar', 'release')).toBe('aprovado');
    expect(conferirTransicao('aguardando_aprovacao', 'pedir_ajustes', 'release')).toBe('em_revisao');
    expect(conferirTransicao('aguardando_aprovacao', 'recusar', 'release')).toBe('recusado');
    expect(conferirTransicao('aprovado', 'agendar', 'release')).toBe('agendado');
    expect(conferirTransicao('agendado', 'reagendar', 'release')).toBe('agendado');
    expect(conferirTransicao('agendado', 'publicar', 'post_instagram')).toBe('publicado');
    expect(conferirTransicao('agendado', 'publicar', 'entrevista')).toBe('realizada');
  });

  it('a revisão também pode recusar o pedido', () => {
    expect(conferirTransicao('em_revisao', 'recusar', 'artigo')).toBe('recusado');
  });

  it('ações fora de hora são recusadas', () => {
    expect(() => conferirTransicao('em_revisao', 'cancelar', 'release')).toThrow(ErroComunicacao);
    expect(() => conferirTransicao('aguardando_revisao', 'aprovar', 'release')).toThrow(ErroComunicacao);
    expect(() => conferirTransicao('publicado', 'reagendar', 'release')).toThrow(ErroComunicacao);
  });

  it('a mensagem de erro cita a situação em português', () => {
    expect(() => conferirTransicao('publicado', 'reagendar', 'release')).toThrow('Esta ação não vale para um pedido em "Publicado".');
  });

  it('situações finais não têm saída e devolver, recusar e pedir ajustes exigem comentário', () => {
    expect([...SITUACOES_FINAIS].sort()).toEqual(['cancelado', 'juntado', 'publicado', 'realizada', 'recusado']);
    expect([...COMENTARIO_OBRIGATORIO].sort()).toEqual(['devolver', 'pedir_ajustes', 'recusar']);
  });

  it('numeração sequencial no ano', () => {
    expect(proximoNumero([], 2026)).toBe('COM-2026-0001');
    expect(proximoNumero(['COM-2026-0001', 'COM-2026-0007', 'COM-2025-0099'], 2026)).toBe('COM-2026-0008');
  });
});
