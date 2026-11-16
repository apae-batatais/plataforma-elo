import { describe, expect, it } from 'vitest';
import { conferirIds, formatarIndicador, mesAtualEmBrasilia, situacaoDe, ultimoEAnterior, type DefinicaoDeIndicador } from '@/capacidades/indicadores';

const def = (o: Partial<DefinicaoDeIndicador> = {}): DefinicaoDeIndicador => ({
  id: 'x', nome: 'X', explicacao: '', formato: 'pct', sentido: 'mais', periodicidade: 'mes', ...o,
});

describe('molde dos indicadores', () => {
  it('sem referência nunca é "dentro" nem "fora"', () => {
    expect(situacaoDe(def(), 50)).toBe('sem_referencia');
    expect(situacaoDe(def({ referencia: 80, sentido: 'neutro' }), 50)).toBe('sem_referencia');
  });
  it('sem dado não é julgado', () => {
    expect(situacaoDe(def({ referencia: 80 }), null)).toBe('sem_dados');
  });
  it('respeita o sentido (mais ou menos é melhor)', () => {
    expect(situacaoDe(def({ referencia: 80 }), 80)).toBe('dentro');
    expect(situacaoDe(def({ referencia: 80 }), 79)).toBe('fora');
    expect(situacaoDe(def({ referencia: 30, sentido: 'menos' }), 30)).toBe('dentro');
    expect(situacaoDe(def({ referencia: 30, sentido: 'menos' }), 31)).toBe('fora');
  });
  it('formata em português e escreve "Sem dados" no lugar de zero', () => {
    expect(formatarIndicador('pct', 83.3)).toBe('83,3%');
    expect(formatarIndicador('dias', 1)).toBe('1 dia útil');
    expect(formatarIndicador('dias', 2.5)).toBe('2,5 dias úteis');
    expect(formatarIndicador('numero', null)).toBe('Sem dados');
    expect(formatarIndicador('moeda', 1500)).toContain('1.500');
  });
  it('o mês corrente (parcial) fica fora da comparação', () => {
    const r = ultimoEAnterior([
      { periodo: '2026-08', valor: 10 },
      { periodo: '2026-09', valor: 20 },
      { periodo: '2026-10', valor: null },
      { periodo: '2026-11', valor: 30, parcial: true },
    ]);
    expect(r.atual?.periodo).toBe('2026-09');
    expect(r.anterior?.periodo).toBe('2026-08');
  });
  it('confere ids contra o manifesto', () => {
    expect(conferirIds(['a', 'b'], ['a', 'b'], ['a'])).toEqual([]);
    expect(conferirIds(['a', 'z'], ['a'], ['a', 'b'])).toEqual(['"z" não está no manifesto.', '"b" não foi devolvido.']);
  });
  it('o mês corrente segue Brasília', () => {
    expect(mesAtualEmBrasilia(new Date('2026-12-01T01:00:00Z'))).toBe('2026-11');
    expect(mesAtualEmBrasilia(new Date('2026-12-01T03:00:00Z'))).toBe('2026-12');
  });
});
