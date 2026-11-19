import { describe, expect, it } from 'vitest';
import { ACOES, COMENTARIO_OBRIGATORIO, ErroComunicacao, SITUACOES, SITUACOES_FINAIS, TIPOS_PECA, conferirTransicao, proximoNumero } from '../dominio/pedido';
import { conferirItemCalendario, itensParaEscolha } from '../dominio/calendario';
import { diaEmBrasilia, diasUteisEntre, ehUrgente, somarDiasUteis } from '../dominio/prazos';

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

  it('situações finais não têm saída: nenhuma ação sai delas, para nenhum tipo de peça', () => {
    expect([...SITUACOES_FINAIS].sort()).toEqual(['cancelado', 'juntado', 'publicado', 'realizada', 'recusado']);
    for (const s of SITUACOES_FINAIS)
      for (const a of ACOES) for (const t of TIPOS_PECA) expect(() => conferirTransicao(s, a, t), `${s} + ${a}`).toThrow(ErroComunicacao);
  });

  it('matriz completa: só vale o que a regra 1 da especificação permite', () => {
    const VALIDAS: Record<string, string> = {
      'aguardando_revisao|iniciar_revisao': 'em_revisao',
      'aguardando_revisao|cancelar': 'cancelado',
      'em_revisao|enviar_aprovacao': 'aguardando_aprovacao',
      'em_revisao|devolver': 'devolvido',
      'em_revisao|recusar': 'recusado',
      'em_revisao|juntar': 'juntado',
      'devolvido|reenviar': 'aguardando_revisao',
      'devolvido|cancelar': 'cancelado',
      'aguardando_aprovacao|aprovar': 'aprovado',
      'aguardando_aprovacao|pedir_ajustes': 'em_revisao',
      'aguardando_aprovacao|recusar': 'recusado',
      'aprovado|agendar': 'agendado',
      'agendado|reagendar': 'agendado',
      'agendado|publicar': 'publicado',
    };
    for (const s of SITUACOES)
      for (const a of ACOES) {
        const esperado = VALIDAS[`${s}|${a}`];
        if (esperado) expect(conferirTransicao(s, a, 'post_instagram'), `${s} + ${a}`).toBe(esperado);
        else expect(() => conferirTransicao(s, a, 'post_instagram'), `${s} + ${a}`).toThrow(ErroComunicacao);
      }
    expect(conferirTransicao('agendado', 'publicar', 'entrevista')).toBe('realizada');
  });

  it('devolver, recusar e pedir ajustes exigem comentário', () => {
    expect([...COMENTARIO_OBRIGATORIO].sort()).toEqual(['devolver', 'pedir_ajustes', 'recusar']);
  });

  it('numeração sequencial no ano', () => {
    expect(proximoNumero([], 2026)).toBe('COM-2026-0001');
    expect(proximoNumero(['COM-2026-0001', 'COM-2026-0007', 'COM-2025-0099'], 2026)).toBe('COM-2026-0008');
  });
});

describe('dias úteis e urgência', () => {
  it('dia de hoje é o de Brasília', () => {
    expect(diaEmBrasilia(new Date('2026-11-07T01:30:00Z'))).toBe('2026-11-06'); // 22h30 de sexta em Brasília
  });

  it('a virada do dia em Brasília acontece às 03h00 UTC', () => {
    expect(diaEmBrasilia(new Date('2026-11-07T02:59:59Z'))).toBe('2026-11-06');
    expect(diaEmBrasilia(new Date('2026-11-07T03:00:00Z'))).toBe('2026-11-07');
  });

  it('urgência em dias úteis', () => {
    expect(somarDiasUteis('2026-11-06', 5)).toBe('2026-11-13');
    expect(ehUrgente('2026-11-12', '2026-11-06', 5)).toBe(true);
    expect(ehUrgente('2026-11-13', '2026-11-06', 5)).toBe(false);
    expect(ehUrgente('2026-11-06', '2026-11-06', 0)).toBe(false);
    expect(diasUteisEntre('2026-11-06', '2026-11-09')).toBe(1);
  });

  it('feriados não contam como dias úteis', () => {
    const quarta = new Set(['2026-11-11']);
    // Segunda 9/11 + 2 dias úteis: sem feriado termina na quarta; com feriado na quarta, na quinta.
    expect(somarDiasUteis('2026-11-09', 2)).toBe('2026-11-11');
    expect(somarDiasUteis('2026-11-09', 2, quarta)).toBe('2026-11-12');
    expect(diasUteisEntre('2026-11-09', '2026-11-13', quarta)).toBe(3);
    // 5 dias úteis a partir de sexta 6/11: sem feriado, 13/11; com feriado na quarta, 16/11.
    expect(ehUrgente('2026-11-13', '2026-11-06', 5)).toBe(false);
    expect(ehUrgente('2026-11-13', '2026-11-06', 5, quarta)).toBe(true);
  });

  it('zero dias úteis devolve o próprio dia e fim antes do início conta zero', () => {
    expect(somarDiasUteis('2026-11-07', 0)).toBe('2026-11-07');
    expect(somarDiasUteis('2026-11-07', 1)).toBe('2026-11-09');
    expect(diasUteisEntre('2026-11-09', '2026-11-06')).toBe(0);
    expect(diasUteisEntre('2026-11-06', '2026-11-06')).toBe(0);
  });
});

describe('calendário', () => {
  const ok = { tema: 'Dia Nacional de Luta da Pessoa com Deficiência', tipoData: 'exata' as const, inicio: '2026-09-21', fim: '2026-09-21', tipos: ['post_instagram' as const] };

  it('item do calendário', () => {
    expect(conferirItemCalendario(ok)).toEqual([]);
    expect(conferirItemCalendario({ ...ok, fim: '2026-09-22' })).toContain('Data exata tem início e fim no mesmo dia.');
    expect(conferirItemCalendario({ ...ok, tipoData: 'periodo', inicio: '2026-08-28', fim: '2026-08-21' })).toContain('O fim do período não pode ser antes do início.');
    expect(conferirItemCalendario({ ...ok, tipos: [] })).toContain('Escolha pelo menos um tipo de peça sugerido.');
    expect(conferirItemCalendario({ ...ok, tema: ' ' })).toContain('Informe o tema.');
  });

  it('só itens ativos e não encerrados aparecem para escolha, do mais próximo ao mais distante', () => {
    const itens = [
      { id: 'c', ativo: true, inicio: '2026-12-01', fim: '2026-12-01' },
      { id: 'a', ativo: true, inicio: '2026-11-06', fim: '2026-11-06' },
      { id: 'x', ativo: false, inicio: '2026-11-10', fim: '2026-11-10' },
      { id: 'v', ativo: true, inicio: '2026-10-01', fim: '2026-11-05' },
      { id: 'b', ativo: true, inicio: '2026-11-01', fim: '2026-11-30' },
    ];
    expect(itensParaEscolha(itens, '2026-11-06').map((i) => i.id)).toEqual(['b', 'a', 'c']);
  });
});
