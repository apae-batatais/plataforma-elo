import { describe, expect, it } from 'vitest';
import { entregasQueCabem, faixaDoMes, minutosEstimados } from '../../.github/scripts/consumo.mjs';

const run = (name: string, inicio: string, fim: string, conclusion = 'success') => ({
  name, conclusion, created_at: inicio, run_started_at: inicio, updated_at: fim,
});

describe('consumo de minutos', () => {
  it('conta no mínimo 1 minuto por execução, arredonda para cima e ignora as puladas e as de antes', () => {
    const r = minutosEstimados(
      [
        run('Tipo do PR', '2026-12-02T10:00:00Z', '2026-12-02T10:00:09Z'),
        run('Verificar', '2026-12-02T10:00:00Z', '2026-12-02T10:02:01Z'),
        run('Fluxo', '2026-12-02T10:00:00Z', '2026-12-02T10:00:01Z', 'skipped'),
        run('Verificar', '2026-11-30T10:00:00Z', '2026-11-30T10:09:00Z'),
      ],
      '2026-12-01',
    );
    expect(r).toEqual({ total: 4, porAutomacao: { 'Tipo do PR': 1, Verificar: 3 } });
  });

  it('faixas: normal até 70%, aviso acima de 70%, pausa acima de 85%', () => {
    expect(faixaDoMes(1400)).toBe('normal');
    expect(faixaDoMes(1401)).toBe('aviso');
    expect(faixaDoMes(1700)).toBe('aviso');
    expect(faixaDoMes(1701)).toBe('pausa');
  });

  it('quantas entregas ainda cabem até a pausa', () => {
    expect(entregasQueCabem(1000, 50)).toBe(14); // (1700 - 1000) / 50
    expect(entregasQueCabem(1800, 50)).toBe(0);
    expect(entregasQueCabem(0, 0)).toBe(0);
  });
});
