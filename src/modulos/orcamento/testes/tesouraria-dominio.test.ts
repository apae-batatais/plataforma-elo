/**
 * Regras puras da tesouraria (Entrega 1D.1): mês de Brasília, valor em reais,
 * conferência da conta, totais por classe e pendências. Dados FICTÍCIOS.
 */
import { describe, expect, it } from 'vitest';
import {
  classeNoMes, conferirConta, contasSemSaldo, lerValorEmReais, mesAnterior, mesAtualBrasilia, mesValido, totaisPorClasse,
  type DadosConta,
} from '../dominio/tesouraria';

describe('meses', () => {
  it('usa o mês de Brasília (UTC−3), mesmo quando já é outro mês em UTC', () => {
    expect(mesAtualBrasilia(new Date('2026-10-01T01:00:00Z'))).toBe('2026-09');
    expect(mesAtualBrasilia(new Date('2026-10-01T03:00:00Z'))).toBe('2026-10');
  });
  it('volta um mês, virando o ano', () => {
    expect(mesAnterior('2026-01')).toBe('2025-12');
    expect(mesAnterior('2026-10')).toBe('2026-09');
  });
  it('confere o formato AAAA-MM', () => {
    expect(mesValido('2026-13')).toBe(false);
    expect(mesValido('2026-00')).toBe(false);
    expect(mesValido('2026-9')).toBe(false);
    expect(mesValido('2026-09')).toBe(true);
  });
});

describe('lerValorEmReais', () => {
  it('lê o formato brasileiro', () => {
    expect(lerValorEmReais('1.234,56')).toBe(1234.56);
    expect(lerValorEmReais('-150,00')).toBe(-150);
    expect(lerValorEmReais('R$ 2.000')).toBe(2000);
    expect(lerValorEmReais('0')).toBe(0);
  });
  it('campo vazio quer dizer não informado', () => {
    expect(lerValorEmReais('')).toBeNull();
    expect(lerValorEmReais('   ')).toBeNull();
  });
  it('recusa o que não é número', () => {
    expect(lerValorEmReais('abc')).toBe('invalido');
    expect(lerValorEmReais('1,2,3')).toBe('invalido');
  });
  it('arredonda em centavos', () => {
    expect(lerValorEmReais('1,005')).toBe(1.01);
    expect(lerValorEmReais('-1,005')).toBe(-1.01);
  });
});

describe('conferirConta', () => {
  const fontes = [
    { id: 'f-restrita', uso: 'restrita' as const, ativo: true },
    { id: 'f-livre', uso: 'livre' as const, ativo: true },
    { id: 'f-excluida', uso: 'restrita' as const, ativo: false },
  ];
  const base: DadosConta = {
    banco: 'Banco Fictício A', agencia: '0001', conta: '12345-6', tipo: 'movimento', classe: 'livre_disponivel',
    fonteId: null, unidade: null,
  };

  it('aceita conta completa', () => {
    expect(conferirConta(base, fontes)).toEqual([]);
  });
  it('conta vinculada precisa da fonte', () => {
    expect(conferirConta({ ...base, classe: 'vinculada' }, fontes)).toEqual([
      'Conta vinculada precisa da fonte (termo) de onde vem o recurso.',
    ]);
  });
  it('conta vinculada não aceita fonte livre', () => {
    expect(conferirConta({ ...base, classe: 'vinculada', fonteId: 'f-livre' }, fontes)).toEqual([
      'A fonte de uma conta vinculada precisa ter uso restrito.',
    ]);
  });
  it('conta vinculada não aceita fonte excluída', () => {
    expect(conferirConta({ ...base, classe: 'vinculada', fonteId: 'f-excluida' }, fontes)).toEqual([
      'A fonte escolhida foi excluída.',
    ]);
  });
  it('conta vinculada aceita fonte restrita', () => {
    expect(conferirConta({ ...base, classe: 'vinculada', fonteId: 'f-restrita' }, fontes)).toEqual([]);
  });
  it('reserva não tem fonte', () => {
    expect(conferirConta({ ...base, classe: 'reserva', fonteId: 'f-restrita' }, fontes)).toEqual(['Só conta vinculada tem fonte.']);
  });
  it('caixa dispensa agência e número da conta', () => {
    expect(conferirConta({ ...base, tipo: 'caixa', banco: 'Caixa da sede', agencia: '', conta: '' }, fontes)).toEqual([]);
  });
  it('movimento sem banco devolve só o banco', () => {
    expect(conferirConta({ ...base, banco: ' ' }, fontes)).toEqual(['Informe o banco.']);
  });
  it('devolve as mensagens na ordem', () => {
    expect(conferirConta({ ...base, banco: '', agencia: '', conta: '' }, fontes)).toEqual([
      'Informe o banco.', 'Informe a agência.', 'Informe o número da conta.',
    ]);
  });
  it('exige tipo e classe', () => {
    const vazio = { ...base, tipo: '' as never, classe: '' as never };
    expect(conferirConta(vazio, fontes)).toEqual(['Escolha o tipo da conta.', 'Escolha a classe da conta.']);
  });
});

describe('totaisPorClasse', () => {
  const contas = [
    { id: 'a', classe: 'livre_disponivel' as const },
    { id: 'b', classe: 'livre_disponivel' as const },
    { id: 'c', classe: 'reserva' as const },
    { id: 'd', classe: 'vinculada' as const },
  ];
  it('soma saldos e ajustes ativos do mês, fechando em centavos', () => {
    const saldos = [
      { conta_id: 'a', mes: '2026-09', saldo: 1000.1 },
      { conta_id: 'b', mes: '2026-09', saldo: 2000.2 },
      { conta_id: 'c', mes: '2026-09', saldo: 500 },
      { conta_id: 'a', mes: '2026-08', saldo: 9999 },
    ];
    const ajustes = [
      { conta_id: 'a', mes: '2026-09', valor: -300, ativo: true },
      { conta_id: 'a', mes: '2026-09', valor: 700, ativo: false },
      { conta_id: 'a', mes: '2026-08', valor: 50, ativo: true },
    ];
    expect(totaisPorClasse(contas, saldos, ajustes, '2026-09')).toEqual({
      livre_disponivel: 2700.3, reserva: 500, vinculada: 0,
    });
  });
  it('conta sem saldo entra com zero mais os ajustes dela', () => {
    const ajustes = [{ conta_id: 'd', mes: '2026-09', valor: 120.5, ativo: true }];
    expect(totaisPorClasse(contas, [], ajustes, '2026-09').vinculada).toBe(120.5);
  });
  it('conta excluída com saldo no mês ainda entra', () => {
    const ativasSo = [{ id: 'a', classe: 'livre_disponivel' as const }];
    const saldos = [
      { conta_id: 'a', mes: '2026-08', saldo: 100 },
      { conta_id: 'x', mes: '2026-08', saldo: 40 },
    ];
    const todas = [...ativasSo, { id: 'x', classe: 'livre_disponivel' as const }];
    expect(totaisPorClasse(todas, saldos, [], '2026-08').livre_disponivel).toBe(140);
  });
});

describe('contasSemSaldo', () => {
  it('devolve só as ativas sem linha naquele mês', () => {
    const ativas = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const saldos = [
      { conta_id: 'a', mes: '2026-09' },
      { conta_id: 'b', mes: '2026-08' },
      { conta_id: 'z', mes: '2026-09' },
    ];
    expect(contasSemSaldo(ativas, saldos, '2026-09')).toEqual(['b', 'c']);
  });
});

describe('classeNoMes', () => {
  const conta = { id: 'a', classe: 'vinculada' as const };
  const m = (a_partir_de: string, classe_anterior: 'livre_disponivel' | 'reserva' | 'vinculada', conta_id = 'a') => ({ conta_id, classe_anterior, a_partir_de });
  it('sem mudança vale a classe da conta', () => {
    expect(classeNoMes(conta, [], '2026-05')).toBe('vinculada');
    expect(classeNoMes(conta, [m('2026-03', 'reserva', 'outra')], '2026-01')).toBe('vinculada');
  });
  it('com uma mudança: antes vale a anterior; no mês e depois vale a atual', () => {
    const l = [m('2026-06', 'reserva')];
    expect(classeNoMes(conta, l, '2026-05')).toBe('reserva');
    expect(classeNoMes(conta, l, '2026-06')).toBe('vinculada');
    expect(classeNoMes(conta, l, '2026-07')).toBe('vinculada');
  });
  it('com duas mudanças: vale a anterior da primeira que ainda não começou', () => {
    // livre até 2026-03, reserva de 2026-04 a 2026-08, vinculada de 2026-09 em diante
    const l = [m('2026-09', 'reserva'), m('2026-04', 'livre_disponivel')];
    expect(classeNoMes(conta, l, '2026-03')).toBe('livre_disponivel');
    expect(classeNoMes(conta, l, '2026-04')).toBe('reserva');
    expect(classeNoMes(conta, l, '2026-08')).toBe('reserva');
    expect(classeNoMes(conta, l, '2026-09')).toBe('vinculada');
    expect(classeNoMes(conta, l, '2026-12')).toBe('vinculada');
  });
});

describe('totaisPorClasse com mudança de classe', () => {
  it('soma o mês anterior na classe antiga e o mês da mudança na nova', () => {
    const contas = [{ id: 'a', classe: 'reserva' as const }];
    const mudancas = [{ conta_id: 'a', classe_anterior: 'livre_disponivel' as const, a_partir_de: '2026-09' }];
    const saldos = [
      { conta_id: 'a', mes: '2026-08', saldo: 100 },
      { conta_id: 'a', mes: '2026-09', saldo: 150 },
    ];
    expect(totaisPorClasse(contas, saldos, [], '2026-08', mudancas)).toEqual({ livre_disponivel: 100, reserva: 0, vinculada: 0 });
    expect(totaisPorClasse(contas, saldos, [], '2026-09', mudancas)).toEqual({ livre_disponivel: 0, reserva: 150, vinculada: 0 });
  });
});
