/**
 * 1D.2: regras puras da conferência, do fim do ano, da reserva e dos sinais. Só números inventados.
 */
import { describe, expect, it } from 'vitest';
import { conferirRecursoLivre, conferirTermo } from '../dominio/conferencia';
import { cenarioPrevisao, cenarioRepetir, folga, mesesQueFaltam, pontoDePartida } from '../dominio/fim-do-ano';
import {
  classificarExecucao, classificarFimDoAno, classificarFolha, classificarGasto, classificarLivre, classificarReserva, conferirFaixas,
  conferirPedidoDeUso, desatualizado, FAIXAS_DE_FABRICA, mesesDeLivre, minimoDaReserva, ordenarSinais, percentualDoMinimo, politicaVigente,
  pontosDeGasto, recomposicaoVencida,
} from '../dominio/reserva';

describe('conferência dos termos (C1 a C4)', () => {
  const base = { mes: '2026-09', saldoMes: 1500, saldoAnterior: 1000, receita: 800, despesa: 300, realizadoInformado: true };
  it('C1: confere quando saldo = anterior + entradas − saídas', () => {
    const r = conferirTermo(base);
    expect(r).toMatchObject({ situacao: 'confere', diferenca: 0, entradas: 800, saidas: 300 });
  });
  it('C2: diferença diferente de zero é alerta, em centavos exatos', () => {
    const r = conferirTermo({ ...base, saldoMes: 1500.1, receita: 800.05 });
    expect(r.situacao).toBe('diferenca');
    expect(r.diferenca).toBe(0.05);
  });
  it('C3: sem dado não calcula e diz o que falta, nunca zero', () => {
    const r = conferirTermo({ ...base, saldoAnterior: null, realizadoInformado: false });
    expect(r.situacao).toBe('sem_dado');
    expect(r.diferenca).toBeNull();
    expect(r.faltam).toEqual([{ o: 'saldo', mes: '2026-08' }, { o: 'realizado', mes: '2026-09' }]);
  });
  it('mês de janeiro olha dezembro do ano anterior', () => {
    expect(conferirTermo({ ...base, mes: '2026-01', saldoAnterior: null }).faltam).toEqual([{ o: 'saldo', mes: '2025-12' }]);
  });
});

describe('conferência do recurso livre (C6 e C7)', () => {
  it('diferença = variação do saldo − resultado do recurso livre', () => {
    const r = conferirRecursoLivre({ mes: '2026-09', saldoMes: 5000, saldoAnterior: 4000, receitaLivre: 1500, despesaLivre: 400, realizadoInformado: true });
    expect(r).toMatchObject({ situacao: 'diferenca', variacao: 1000, resultadoLivre: 1100, diferenca: -100 });
  });
  it('zero confere; falta de saldo é sem dado', () => {
    expect(conferirRecursoLivre({ mes: '2026-09', saldoMes: 5100, saldoAnterior: 4000, receitaLivre: 1500, despesaLivre: 400, realizadoInformado: true }).situacao).toBe('confere');
    const r = conferirRecursoLivre({ mes: '2026-09', saldoMes: null, saldoAnterior: 4000, receitaLivre: 0, despesaLivre: 0, realizadoInformado: true });
    expect(r).toMatchObject({ situacao: 'sem_dado', diferenca: null, variacao: null });
  });
});

describe('fim do ano (F1 a F5)', () => {
  const linhas = [
    { mes: '2025-10', tipo: 'receita' as const, valor: 1000, naoRecorrente: false },
    { mes: '2025-10', tipo: 'despesa' as const, valor: 400, naoRecorrente: false },
    { mes: '2025-11', tipo: 'receita' as const, valor: 5000, naoRecorrente: true },
    { mes: '2025-12', tipo: 'despesa' as const, valor: 100, naoRecorrente: false },
    { mes: '2025-09', tipo: 'receita' as const, valor: 9999, naoRecorrente: false },
  ];
  const informados = new Set(['2025-09', '2025-10', '2025-11', '2025-12']);
  it('F1: ponto de partida é o último mês do ano com saldo', () => {
    expect(pontoDePartida(['2025-12', '2026-03', '2026-09'], 2026)).toBe('2026-09');
    expect(pontoDePartida(['2025-12'], 2026)).toBeNull();
  });
  it('meses que faltam: depois do ponto de partida até dezembro', () => {
    expect(mesesQueFaltam('2026-09', 2025)).toEqual(['2025-10', '2025-11', '2025-12']);
    expect(mesesQueFaltam('2026-12', 2025)).toEqual([]);
  });
  it('F2: repetir o ano anterior, com e sem não recorrentes (o mês do ponto de partida não entra)', () => {
    const e = { saldoPartida: 10000, partida: '2026-09', anoReferencia: 2025, linhasLivres: linhas, mesesInformados: informados };
    expect(cenarioRepetir({ ...e, comNaoRecorrentes: true }).saldoDezembro).toBe(10000 + 600 + 5000 - 100);
    expect(cenarioRepetir({ ...e, comNaoRecorrentes: false }).saldoDezembro).toBe(10000 + 600 - 100);
  });
  it('F4: ano de referência sem os meses informados é "sem dado" e lista os meses; nunca zero', () => {
    const r = cenarioRepetir({ saldoPartida: 10000, partida: '2026-09', anoReferencia: 2025, linhasLivres: linhas, mesesInformados: new Set(['2025-10']), comNaoRecorrentes: true });
    expect(r.saldoDezembro).toBeNull();
    expect(r.faltam).toEqual(['2025-11', '2025-12']);
  });
  it('F3: pela Previsão soma o resultado livre previsto dos meses que faltam', () => {
    const receita = Array(12).fill(1000);
    const despesa = Array(12).fill(900);
    expect(cenarioPrevisao({ saldoPartida: 500, partida: '2026-09', receitaLivre: receita, despesaLivre: despesa }).saldoDezembro).toBe(800);
  });
  it('F5: folga desconta a reserva; negativa quer dizer usar a reserva', () => {
    expect(folga(1000, 400)).toBe(600);
    expect(folga(300, 400)).toBe(-100);
    expect(folga(null, 400)).toBeNull();
  });
});

describe('reserva (R1, R2, R4, R5)', () => {
  it('R1: mínimo = N × RH e encargos do ano ÷ 12, em centavos', () => {
    expect(minimoDaReserva(5580000, 2)).toBe(930000);
    expect(minimoDaReserva(100, 1)).toBe(8.33);
    expect(percentualDoMinimo(558000, 930000)).toBe(60);
    expect(percentualDoMinimo(10, 0)).toBeNull();
  });
  it('R2: vale a mais recente aprovada com vigência até o mês; proposta e recusada não valem', () => {
    const l = [
      { vigencia: '2026-01', situacao: 'aprovada', id: 'a' },
      { vigencia: '2026-06', situacao: 'proposta', id: 'b' },
      { vigencia: '2026-05', situacao: 'aprovada', id: 'c' },
      { vigencia: '2026-08', situacao: 'recusada', id: 'd' },
      { vigencia: '2026-12', situacao: 'aprovada', id: 'e' },
    ];
    expect(politicaVigente(l, '2026-09')?.id).toBe('c');
    expect(politicaVigente(l, '2026-02')?.id).toBe('a');
    expect(politicaVigente(l, '2025-12')).toBeNull();
  });
  it('faixas inválidas são recusadas', () => {
    expect(conferirFaixas(FAIXAS_DE_FABRICA)).toEqual([]);
    expect(conferirFaixas({ ...FAIXAS_DE_FABRICA, meses_minimo: 0 })).not.toEqual([]);
    expect(conferirFaixas({ ...FAIXAS_DE_FABRICA, folha_atencao: 50 })).not.toEqual([]);
    expect(conferirFaixas({ ...FAIXAS_DE_FABRICA, reserva_atencao: 130 })).not.toEqual([]);
    expect(conferirFaixas({ ...FAIXAS_DE_FABRICA, livre_ok: Number.NaN })).not.toEqual([]);
  });
  it('R4: pedido de uso confere valor, saldo, motivo e prazo', () => {
    const ok = { valor: 100, motivo: 'Atraso de repasse', prazo: '2027-03', mesPedido: '2026-11', saldoReserva: 500 };
    expect(conferirPedidoDeUso(ok)).toEqual([]);
    expect(conferirPedidoDeUso({ ...ok, valor: 0 })).not.toEqual([]);
    expect(conferirPedidoDeUso({ ...ok, valor: 500.01 })).not.toEqual([]);
    expect(conferirPedidoDeUso({ ...ok, valor: 500 })).toEqual([]);
    expect(conferirPedidoDeUso({ ...ok, saldoReserva: null })).not.toEqual([]);
    expect(conferirPedidoDeUso({ ...ok, motivo: '  ' })).not.toEqual([]);
    expect(conferirPedidoDeUso({ ...ok, prazo: '2026-10' })).not.toEqual([]);
    expect(conferirPedidoDeUso({ ...ok, prazo: '' })).not.toEqual([]);
  });
  it('R5: vencida só se aprovada e o mês atual passou do prazo', () => {
    expect(recomposicaoVencida({ situacao: 'aprovado', prazo_recomposicao: '2026-10' }, '2026-11')).toBe(true);
    expect(recomposicaoVencida({ situacao: 'aprovado', prazo_recomposicao: '2026-11' }, '2026-11')).toBe(false);
    expect(recomposicaoVencida({ situacao: 'recomposto', prazo_recomposicao: '2026-01' }, '2026-11')).toBe(false);
    expect(recomposicaoVencida({ situacao: 'pedido', prazo_recomposicao: '2026-01' }, '2026-11')).toBe(false);
  });
});

describe('sinais (S1 a S10)', () => {
  const f = FAIXAS_DE_FABRICA;
  it('S9: valor exatamente na fronteira conta como a situação melhor', () => {
    expect(classificarLivre(3, f)).toBe('ok');
    expect(classificarLivre(2.9, f)).toBe('atencao');
    expect(classificarLivre(1, f)).toBe('atencao');
    expect(classificarLivre(0.9, f)).toBe('critico');
    expect(classificarFimDoAno(100000, f)).toBe('ok');
    expect(classificarFimDoAno(99999.99, f)).toBe('atencao');
    expect(classificarFimDoAno(0, f)).toBe('atencao');
    expect(classificarFimDoAno(-0.01, f)).toBe('critico');
    expect(classificarFolha(60, f)).toBe('ok');
    expect(classificarFolha(65, f)).toBe('atencao');
    expect(classificarFolha(65.1, f)).toBe('critico');
    expect(classificarGasto(0, f)).toBe('ok');
    expect(classificarGasto(10, f)).toBe('atencao');
    expect(classificarGasto(10.1, f)).toBe('critico');
    expect(classificarReserva(120, f)).toBe('ok');
    expect(classificarReserva(100, f)).toBe('atencao');
    expect(classificarReserva(99.9, f)).toBe('critico');
  });
  it('execução: atenção vai até −5% da receita prevista', () => {
    expect(classificarExecucao(0, 100000, f)).toBe('ok');
    expect(classificarExecucao(-5000, 100000, f)).toBe('atencao');
    expect(classificarExecucao(-5000.01, 100000, f)).toBe('critico');
  });
  it('dado ausente nunca vira zero: sem dado', () => {
    for (const fn of [classificarLivre, classificarFimDoAno, classificarFolha, classificarGasto, classificarReserva]) expect(fn(null, f)).toBe('sem_dado');
    expect(classificarExecucao(null, 1000, f)).toBe('sem_dado');
  });
  it('S1: ordem do mais grave para o mais tranquilo, empate mantém a ordem', () => {
    const l = [{ n: 1, situacao: 'ok' as const }, { n: 2, situacao: 'sem_dado' as const }, { n: 3, situacao: 'critico' as const }, { n: 4, situacao: 'atencao' as const }, { n: 5, situacao: 'ok' as const }];
    expect(ordenarSinais(l).map((x) => x.n)).toEqual([3, 4, 1, 5, 2]);
  });
  it('S2: meses de livre = saldo ÷ gasto médio mensal; sem gasto ou sem saldo é sem dado', () => {
    expect(mesesDeLivre(300000, 900000, 3)).toBe(1);
    expect(mesesDeLivre(null, 900000, 3)).toBeNull();
    expect(mesesDeLivre(300000, 0, 3)).toBeNull();
    expect(mesesDeLivre(300000, 900000, 0)).toBeNull();
  });
  it('S6: pontos = variação da despesa − variação da receita; ano anterior zerado é sem dado', () => {
    expect(pontosDeGasto(120, 100, 105, 100)).toBe(15);
    expect(pontosDeGasto(120, 0, 105, 100)).toBeNull();
    expect(pontosDeGasto(120, 100, 105, 0)).toBeNull();
  });
  it('S10: mais velho que o mês anterior ao atual é desatualizado', () => {
    expect(desatualizado('2026-10', '2026-11')).toBe(false);
    expect(desatualizado('2026-09', '2026-11')).toBe(true);
    expect(desatualizado(null, '2026-11')).toBe(false);
  });
});
