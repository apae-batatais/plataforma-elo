/** Folha em caixa (P1): regras puras. Só dados fictícios. */
import { describe, expect, it } from 'vitest';
import { CALENDARIO_PADRAO, calendarioDe, deslocamentoDeCaixa, mesesAquisitivosEmAberto, picoDeCaixa, repartir, validarCalendario, type EntradaCaixa, type LinhaCalendario } from '../dominio/caixa';
import { calcularLinha, componentesZerados, parametrosCom } from '../dominio/folha';

const p = parametrosCom({ reajuste_mes: 1 });
const c = { ...componentesZerados(0), salario_atual: 3000, abono: 120 };
const calc = calcularLinha(c, 200, p, 6);
const ano = (de = 0, ate = 11) => Array.from({ length: 12 }, (_, i) => (i >= de && i <= ate ? { c, calc } : null));
const base = (extra: Partial<EntradaCaixa> = {}): EntradaCaixa => ({ meses: ano(), contrato: 'indeterminado', mesFerias: null, inicio: '2020-01-01', desligamento: null, ano: 2027, ...extra });
const soma = (v: number[]) => Math.round(v.reduce((s, x) => s + x, 0) * 100) / 100;
const linhasCal = (f: (mes: number) => Partial<LinhaCalendario>): LinhaCalendario[] =>
  Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, ferias_coletivas: false, decimo_pct: 0, abono_pct: 0, ...f(i + 1) }));

describe('calendário', () => {
  it('sem linhas vale o padrão: 13º em novembro e dezembro', () => {
    expect(calendarioDe(undefined)).toBe(CALENDARIO_PADRAO);
    expect(CALENDARIO_PADRAO.decimo[10]).toBe(50);
    expect(CALENDARIO_PADRAO.configurado).toBe(false);
  });
  it('13º precisa somar 100%; abono 100% ou nada', () => {
    expect(validarCalendario(linhasCal((m) => ({ decimo_pct: m === 11 ? 100 : 0 })))).toEqual([]);
    expect(validarCalendario(linhasCal((m) => ({ decimo_pct: m === 11 ? 90 : 0 }))).join(' ')).toMatch(/90%/);
    expect(validarCalendario(linhasCal((m) => ({ decimo_pct: m === 11 ? 100 : 0, abono_pct: m === 1 ? 50 : 0 }))).join(' ')).toMatch(/abono/);
    expect(validarCalendario(linhasCal(() => ({ decimo_pct: 100 })).slice(0, 11))).toHaveLength(1);
  });
});

describe('repartir', () => {
  it('divide em centavos exatos só entre meses ativos', () => {
    const r = repartir(100, [0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0], Array(12).fill(true))!;
    expect(soma(r)).toBe(100);
    expect(repartir(100, [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], Array(12).fill(false))).toBeNull();
  });
});

describe('deslocamento do caixa', () => {
  it('o ano soma igual: 13º, 1/3 e abono só mudam de mês (regra 2)', () => {
    const d = deslocamentoDeCaixa(base(), CALENDARIO_PADRAO);
    expect(soma(d.delta)).toBeCloseTo(0, 1);
    expect(soma(d.termino)).toBe(0);
  });
  it('13º sai em novembro e dezembro (regra 3)', () => {
    const d = deslocamentoDeCaixa(base(), CALENDARIO_PADRAO);
    expect(d.delta[10]).toBeCloseTo(d.delta[11], 1);
    expect(d.delta[10]).toBeCloseTo(calc.decimoTerceiro * 5, 1);
    expect(d.delta[5]).toBeCloseTo(-calc.decimoTerceiro, 1);
  });
  it('1/3 de férias vai ao mês de férias da pessoa; senão, às coletivas (regra 4)', () => {
    const sem = deslocamentoDeCaixa(base({ mesFerias: 7 }), calendarioDe(linhasCal((m) => ({ decimo_pct: m === 12 ? 100 : 0 }))));
    const ate = deslocamentoDeCaixa(base(), calendarioDe(linhasCal((m) => ({ decimo_pct: m === 12 ? 100 : 0 }))));
    expect(sem.delta[6] - ate.delta[6]).toBeCloseTo(calc.tercoFerias * 11, 1);
    const col = deslocamentoDeCaixa(base(), calendarioDe(linhasCal((m) => ({ decimo_pct: m === 12 ? 100 : 0, ferias_coletivas: m === 1 || m === 2 }))));
    expect(col.delta[0] - ate.delta[0]).toBeCloseTo((calc.tercoFerias * 12) / 2 - calc.tercoFerias, 1);
  });
  it('abono segue abono_pct (regra 5)', () => {
    const cal = calendarioDe(linhasCal((m) => ({ decimo_pct: m === 12 ? 100 : 0, abono_pct: m === 3 ? 100 : 0 })));
    const d = deslocamentoDeCaixa(base(), cal);
    const sem = deslocamentoDeCaixa(base({ meses: ano().map((m) => (m ? { ...m, c: { ...c, abono: 0 } } : m)) }), cal);
    expect(d.delta[2] - sem.delta[2]).toBeCloseTo(120 * 11, 1);
  });
  it('prazo determinado: verbas do término no mês do desligamento, sem multa nem aviso (regra 6)', () => {
    const d = deslocamentoDeCaixa(base({ meses: ano(0, 5), contrato: 'determinado', desligamento: '2027-06-30', inicio: '2026-01-01' }), CALENDARIO_PADRAO);
    expect(d.termino[5]).toBeGreaterThan(0);
    expect(d.termino.filter((x, i) => i !== 5 && x !== 0)).toEqual([]);
    expect(d.delta[10]).toBe(0); // não há 13º depois do desligamento
    expect(soma(d.delta)).toBeCloseTo(0, 1);
    expect(d.delta[5]).toBeGreaterThan(0); // o 13º ainda não pago sai no mês do término
  });
  it('prazo indeterminado nunca gera verba de término na previsão', () => {
    const d = deslocamentoDeCaixa(base({ meses: ano(0, 5), desligamento: '2027-06-30' }), CALENDARIO_PADRAO);
    expect(soma(d.termino)).toBe(0);
    expect(soma(d.delta.map(Math.abs))).toBe(0);
  });
  it('meses aquisitivos em aberto contam fração de 15 dias como mês', () => {
    expect(mesesAquisitivosEmAberto('2026-01-01', '2027-06-30')).toBe(6);
    expect(mesesAquisitivosEmAberto('2026-01-20', '2027-06-30')).toBe(5);
  });
  it('pico: o maior mês e a média', () => {
    expect(picoDeCaixa([1, 2, 3, 6, 0, 0, 0, 0, 0, 0, 0, 0])).toEqual({ mes: 4, valor: 6, media: 1 });
  });
});
