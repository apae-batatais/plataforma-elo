import { describe, expect, it } from 'vitest';
import { DURACAO_MS, facilitar, interpolarValores, partidaNaBase } from '@/ui/movimento';

describe('movimento dos gráficos', () => {
  it('dura entre 0,2 e 0,6 segundo', () => {
    expect(DURACAO_MS).toBeGreaterThanOrEqual(200);
    expect(DURACAO_MS).toBeLessThanOrEqual(600);
  });

  it('a facilitação vai de 0 a 1, sem passar dos limites', () => {
    expect(facilitar(0)).toBe(0);
    expect(facilitar(1)).toBe(1);
    expect(facilitar(-3)).toBe(0);
    expect(facilitar(7)).toBe(1);
    expect(facilitar(0.5)).toBeGreaterThan(0.5);
  });

  it('começa na posição antiga, passa pelo meio e termina exato no valor novo', () => {
    const de = { A: [0, 100] };
    const para = { A: [100, 200] };
    expect(interpolarValores(de, para, 0).A).toEqual([0, 100]);
    const meio = interpolarValores(de, para, 0.5).A;
    expect(meio[0]).toBeGreaterThan(0);
    expect(meio[0]).toBeLessThan(100);
    expect(meio[1]).toBeGreaterThan(100);
    expect(meio[1]).toBeLessThan(200);
    expect(interpolarValores(de, para, 1)).toEqual(para);
    expect(interpolarValores(de, para, 1.4)).toEqual(para);
  });

  it('série que entra parte da base; série que sai não aparece', () => {
    const r0 = interpolarValores({ A: [10], B: [5] }, { A: [10], C: [40] }, 0, 0);
    expect(r0.C).toEqual([0]);
    expect(r0.B).toBeUndefined();
    expect(interpolarValores({}, { C: [40, 50] }, 0, 8).C).toEqual([8, 8]);
  });

  it('ao abrir, tudo parte da linha de base', () => {
    expect(partidaNaBase({ A: [5, 9], B: [1] }, 2)).toEqual({ A: [2, 2], B: [2] });
  });

  it('com "menos movimento", devolve o valor final direto', () => {
    const para = { A: [100, 200] };
    expect(interpolarValores({ A: [0, 0] }, para, 0, 0, true)).toEqual(para);
  });
});
