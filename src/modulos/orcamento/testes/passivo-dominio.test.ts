/** Passivo trabalhista (P2): regras puras. Só números inventados. */
import { describe, expect, it } from 'vitest';
import {
  anosCompletos, calcularFerias, calcularPassivo, decimoProporcional, diasDeAviso, mesesTrabalhados, saldoDoFgts, somarMeses,
  validarFeriasTiradas, validarParametrosPassivo, validarSaldoFgts, type ParametrosPassivo,
} from '../dominio/passivo';

const PARAMS: ParametrosPassivo = { aviso_dias_base: 30, aviso_dias_por_ano: 3, aviso_dias_max: 90, multa_fgts: 40 };
const PADRAO = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 50, 50];

describe('datas', () => {
  it('soma meses limitando o dia', () => {
    expect(somarMeses('2024-01-31', 1)).toBe('2024-02-29');
    expect(somarMeses('2020-03-15', 12)).toBe('2021-03-15');
  });
  it('conta fração de 15 dias como mês e anos completos', () => {
    expect(mesesTrabalhados('2026-01-01', '2026-03-14')).toBe(2);
    expect(mesesTrabalhados('2026-01-01', '2026-03-15')).toBe(3);
    expect(anosCompletos('2020-03-15', '2023-03-14')).toBe(2);
    expect(anosCompletos('2020-03-15', '2023-03-15')).toBe(3);
  });
});

describe('férias (regras 2 a 4)', () => {
  it('proporcional: meses em aberto ÷ 12 de 30 dias mais 1/3', () => {
    const f = calcularFerias('2026-01-01', '2026-06-30', 3000, []);
    expect(f.mesesProporcionais).toBe(6);
    expect(f.valorProporcionais).toBe(2000); // 3000/30*15*4/3
    expect(f.valorVencidas).toBe(0);
    expect(f.emDobro).toBe(false);
  });
  it('período vencido dentro do prazo, sem dobro', () => {
    const f = calcularFerias('2025-01-01', '2026-03-01', 3000, []);
    expect(f.diasVencidos).toBe(30);
    expect(f.valorVencidas).toBe(4000);
    expect(f.emDobro).toBe(false);
  });
  it('período vencido além do prazo conta em dobro', () => {
    const f = calcularFerias('2023-01-01', '2026-03-01', 3000, []);
    expect(f.emDobro).toBe(true);
    expect(f.diasVencidos).toBe(90);
  });
  it('dias gozados abatem os períodos mais antigos primeiro', () => {
    const f = calcularFerias('2024-01-01', '2026-03-01', 3000, [{ inicio: '2025-02-01', dias: 30 }]);
    expect(f.diasVencidos).toBe(30);
    expect(f.emDobro).toBe(false); // o período pendente é o 2º, ainda no prazo
  });
});

describe('13º, aviso e FGTS (regras 5 a 8)', () => {
  it('13º: desconta a parcela já paga pelo calendário', () => {
    expect(decimoProporcional('2020-01-01', '2026-06-30', 1200, PADRAO)).toBe(600);
    expect(decimoProporcional('2020-01-01', '2026-12-20', 1200, PADRAO)).toBe(600);
    expect(decimoProporcional('2020-01-01', '2026-11-10', 1200, PADRAO)).toBe(1000);
  });
  it('13º de quem entrou no ano conta só os meses trabalhados', () => {
    expect(decimoProporcional('2026-04-01', '2026-06-30', 1200, PADRAO)).toBe(300);
  });
  it('aviso: 30 + 3 por ano, no máximo 90', () => {
    expect(diasDeAviso(0, PARAMS)).toBe(30);
    expect(diasDeAviso(5, PARAMS)).toBe(45);
    expect(diasDeAviso(40, PARAMS)).toBe(90);
  });
  it('saldo estimado soma 8% da base de cada mês; com extrato usa o extrato mais os meses seguintes', () => {
    const base = () => 1000;
    expect(saldoDoFgts('2026-01-10', '2026-03-31', { baseDoMes: base, aliquota: 8 })).toBe(240);
    expect(saldoDoFgts('2026-01-10', '2026-03-31', { baseDoMes: base, aliquota: 8, extrato: { referencia: '2026-02-15', valor: 500 } })).toBe(580);
  });
  it('passivo da pessoa soma férias, 13º, aviso e multa', () => {
    const r = calcularPassivo({
      inicio: '2026-01-01', ate: '2026-06-30', remuneracao: 3000, gozadas: [], decimoCalendario: PADRAO,
      fgts: { baseDoMes: () => 3000, aliquota: 8 }, parametros: PARAMS,
    });
    expect(r.valorFerias).toBe(2000);
    expect(r.decimo).toBe(1500);
    expect(r.aviso).toBe(3000);
    expect(r.saldoFgts).toBe(1440);
    expect(r.multaFgts).toBe(576);
    expect(r.total).toBe(7076);
  });
});

describe('validações (regras 12)', () => {
  it('recusa valor negativo e data antes da admissão', () => {
    expect(validarFeriasTiradas({ inicio: '2020-01-01', dias: 10 }, '2021-01-01')).toHaveLength(1);
    expect(validarFeriasTiradas({ inicio: '2022-01-01', dias: 31 }, '2021-01-01')).toHaveLength(1);
    expect(validarSaldoFgts({ referencia: '2022-01-01', valor: -1 }, '2021-01-01')).toHaveLength(1);
    expect(validarSaldoFgts({ referencia: '2022-01-01', valor: 10 }, '2021-01-01')).toEqual([]);
  });
  it('limites dos parâmetros do passivo', () => {
    expect(validarParametrosPassivo(PARAMS)).toEqual([]);
    expect(validarParametrosPassivo({ ...PARAMS, aviso_dias_base: 1.5, multa_fgts: 120 })).toHaveLength(2);
  });
});
