import { describe, expect, it } from 'vitest';
import { dataCurta, limitesDoMes, mesValido, nomeDoMes, quandoCai, semanasDoMes, somarMeses } from '../telas/mes';

describe('contas do calendário da tela', () => {
  it('valida e navega entre meses, inclusive na virada do ano', () => {
    expect(mesValido('2026-11')).toBe('2026-11');
    expect(mesValido('2026-13')).toBeNull();
    expect(mesValido(undefined)).toBeNull();
    expect(somarMeses('2026-12', 1)).toBe('2027-01');
    expect(somarMeses('2026-01', -1)).toBe('2025-12');
    expect(nomeDoMes('2026-11')).toBe('novembro de 2026');
  });

  it('limites do mês, com ano bissexto', () => {
    expect(limitesDoMes('2026-11')).toEqual({ inicio: '2026-11-01', fim: '2026-11-30' });
    expect(limitesDoMes('2028-02').fim).toBe('2028-02-29');
  });

  it('semanas de domingo a sábado cobrindo o mês todo', () => {
    const s = semanasDoMes('2026-11'); // 1º de novembro de 2026 é domingo
    expect(s).toHaveLength(5);
    expect(s.every((w) => w.length === 7)).toBe(true);
    expect(s[0][0]).toEqual({ dia: '2026-11-01', doMes: true });
    expect(s[4][6]).toEqual({ dia: '2026-12-05', doMes: false });
    const outro = semanasDoMes('2026-10'); // 1º de outubro é quinta
    expect(outro[0][0]).toEqual({ dia: '2026-09-27', doMes: false });
    expect(outro.flat().filter((d) => d.doMes)).toHaveLength(31);
  });

  it('formata datas para a tela', () => {
    expect(dataCurta('2026-11-21')).toBe('21/11/2026');
    expect(quandoCai({ inicio: '2026-11-21', fim: '2026-11-21' })).toBe('21/11/2026');
    expect(quandoCai({ inicio: '2026-11-16', fim: '2026-12-18' })).toBe('16/11/2026 a 18/12/2026');
  });
});
