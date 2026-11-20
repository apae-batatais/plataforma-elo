/** Regras puras do Painel de execução e dos Recursos livres (1C.2). */
import { describe, expect, it } from 'vitest';
import { diasEmAberto, execucaoPercentual, fimDoMes, mesesComparaveis, periodoDaExecucao, saldoDoTermo, somar, variacaoPercentual } from '../dominio/execucao';

describe('execução (R2)', () => {
  it('é realizado ÷ previsto; sem previsto não é 0% nem infinito', () => {
    expect(execucaoPercentual(90, 120)).toBe(75);
    expect(execucaoPercentual(50, 0)).toBeNull();
    expect(execucaoPercentual(0, 100)).toBe(0);
  });
  it('soma em centavos exatos', () => {
    expect(somar([0.1, 0.2])).toBe(0.3);
  });
});

describe('período (R3)', () => {
  it('padrão: de janeiro ao último mês informado; mês do meio sem dado fica fora das contas', () => {
    const p = periodoDaExecucao(2025, new Set(['2025-01', '2025-02', '2025-04']));
    expect(p.meses).toHaveLength(4);
    expect(p.semDado).toEqual(['2025-03']);
    expect(p.contam).toEqual(['2025-01', '2025-02', '2025-04']);
  });
  it('sem nenhum mês informado o período é vazio; outro ano não conta', () => {
    expect(periodoDaExecucao(2025, new Set()).meses).toEqual([]);
    expect(periodoDaExecucao(2025, new Set(['2024-05'])).meses).toEqual([]);
  });
  it('um mês escolhido vale sozinho', () => {
    const p = periodoDaExecucao(2025, new Set(['2025-01', '2025-02']), '2025-02');
    expect(p.meses).toEqual(['2025-02']);
    expect(p.contam).toEqual(['2025-02']);
    expect(periodoDaExecucao(2025, new Set(['2025-01']), '2025-06').semDado).toEqual(['2025-06']);
  });
});

describe('adiantamentos (R5)', () => {
  it('baixa do mais antigo para o mais novo', () => {
    const s = saldoDoTermo([{ mes: '2025-03', valor: 500 }, { mes: '2025-01', valor: 1000 }], 1200);
    expect(s).toMatchObject({ adiantado: 1500, ressarcido: 1200, emAberto: 300, ressarcidoAMais: false, maisAntigoMes: '2025-03' });
  });
  it('quitado: sem mês em aberto', () => {
    expect(saldoDoTermo([{ mes: '2025-01', valor: 100 }], 100).maisAntigoMes).toBeNull();
  });
  it('ressarcido a mais aparece como saldo negativo, nunca some', () => {
    const s = saldoDoTermo([{ mes: '2025-01', valor: 100 }], 150);
    expect(s).toMatchObject({ emAberto: -50, ressarcidoAMais: true, maisAntigoMes: null });
  });
  it('sem ressarcimento, o mais antigo é o primeiro mês', () => {
    expect(saldoDoTermo([{ mes: '2025-02', valor: 10 }, { mes: '2025-01', valor: 10 }], 0).maisAntigoMes).toBe('2025-01');
  });
  it('conta os dias a partir do fim do mês', () => {
    expect(fimDoMes('2025-02')).toBe('2025-02-28');
    expect(diasEmAberto('2025-01', '2025-04-01')).toBe(60);
    expect(diasEmAberto('2025-01', '2025-01-10')).toBe(0);
  });
});

describe('comparação com o ano anterior (R6)', () => {
  it('só os meses informados nos dois anos', () => {
    const r = mesesComparaveis({ '01': 1, '02': 2 }, { '02': 5, '03': 6 });
    expect(r.filter((m) => m.atual !== null).map((m) => m.mes)).toEqual([2]);
  });
  it('variação sem base é nula', () => {
    expect(variacaoPercentual(120, 100)).toBe(20);
    expect(variacaoPercentual(5, 0)).toBeNull();
  });
});
