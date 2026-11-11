import { describe, expect, it } from 'vitest';
import {
  anoUsaRealizado, chaveLinha, compararAnos, conferirLinha, diferencaPercentual, mesInformavel, mesPendente, naturezaSugerida, totaisDoMes,
} from '../dominio/realizado';

const ok = { tipo: 'despesa', servico: 'escola', grupoId: 'g1', fonteId: 'f1', natureza: 'custeio', valor: 10, naoRecorrente: false, motivo: null } as const;

describe('regras do realizado (domínio)', () => {
  it('R3: valor negativo não é aceito; zero é', () => {
    expect(conferirLinha({ ...ok, valor: -1 })[0]).toMatch(/negativo/);
    expect(conferirLinha({ ...ok, valor: 0 })).toEqual([]);
  });
  it('R4: natureza precisa combinar com o tipo; sugestão pelo grupo', () => {
    expect(conferirLinha({ ...ok, natureza: 'ressarcimento' })).not.toEqual([]);
    expect(conferirLinha({ ...ok, tipo: 'receita', servico: null, grupoId: null, natureza: 'ressarcimento' })).toEqual([]);
    expect(naturezaSugerida('despesa', true)).toBe('rh');
    expect(naturezaSugerida('despesa', false)).toBe('custeio');
    expect(naturezaSugerida('receita', false)).toBe('receita_comum');
  });
  it('despesa exige serviço e grupo; receita não tem nenhum dos dois', () => {
    expect(conferirLinha({ ...ok, servico: null }).join(' ')).toMatch(/serviço/);
    expect(conferirLinha({ ...ok, grupoId: null }).join(' ')).toMatch(/grupo/);
    expect(conferirLinha({ ...ok, tipo: 'receita', natureza: 'receita_comum' }).join(' ')).toMatch(/Receita não tem/);
  });
  it('R6: não recorrente exige motivo', () => {
    expect(conferirLinha({ ...ok, naoRecorrente: true }).join(' ')).toMatch(/motivo/);
    expect(conferirLinha({ ...ok, naoRecorrente: true, motivo: 'Reforma da quadra' })).toEqual([]);
  });
  it('R1: a chave distingue natureza e fonte', () => {
    const a = { mes: '2026-09', tipo: 'despesa', servico: 's', grupoId: 'g', fonteId: 'f', natureza: 'rh' };
    expect(chaveLinha(a)).not.toBe(chaveLinha({ ...a, natureza: 'encargos' }));
    expect(chaveLinha(a)).toBe(chaveLinha({ ...a }));
  });
  it('mês informável: não futuro e dentro dos últimos 24 meses', () => {
    expect(mesInformavel('2026-11', '2026-11')).toBe(true);
    expect(mesInformavel('2026-12', '2026-11')).toBe(false);
    expect(mesInformavel('2024-12', '2026-11')).toBe(true);
    expect(mesInformavel('2024-11', '2026-11')).toBe(false);
    expect(mesInformavel('2026-13', '2026-11')).toBe(false);
  });
  it('R7: totais em centavos exatos', () => {
    const t = totaisDoMes([{ tipo: 'despesa', valor: 0.1 }, { tipo: 'despesa', valor: 0.2 }, { tipo: 'receita', valor: 1 }]);
    expect(t).toEqual({ despesa: 0.3, receita: 1, resultado: 0.7 });
  });
  it('diferença percentual para o previsto', () => {
    expect(diferencaPercentual(110, 100)).toBe(10);
    expect(diferencaPercentual(5, 0)).toBeNull();
  });
  it('R11: pendência é o mês anterior sem linhas', () => {
    expect(mesPendente(new Set(), '2026-11')).toBe('2026-10');
    expect(mesPendente(new Set(['2026-10']), '2026-11')).toBeNull();
  });
  it('R12: mês não informado é "sem dado", nunca zero', () => {
    const r = compararAnos({ '01': 10, '02': 0 }, { '01': 4 });
    expect(r[0]).toMatchObject({ atual: 10, anterior: 4, diferenca: 6 });
    expect(r[1]).toMatchObject({ atual: 0, anterior: null, diferenca: null });
    expect(r[2]).toMatchObject({ atual: null, anterior: null, diferenca: null });
  });
  it('R13: ano com realizado usa o realizado', () => {
    expect(anoUsaRealizado(new Set([2026]), 2026)).toBe(true);
    expect(anoUsaRealizado(new Set([2026]), 2025)).toBe(false);
  });
});
