import { describe, expect, it } from 'vitest';
import { acharNumero, suavizar, textoDaContagem } from '@/ui/contagem';
import { VALIDADE_DA_MARCA, chaveGuardada, chegouDeGravacao, deveFicarPiscando } from '@/ui/pisca-regras';

describe('números que contam', () => {
  it('termina exatamente no texto recebido, em qualquer formato', () => {
    const textos = [
      (1234567.89).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      `${(45.5).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`,
      'R$ 3,2 mi',
      'R$ 850 mil',
      'R$ 0,00',
      '7',
      '1.234',
    ];
    for (const t of textos) expect(textoDaContagem(t, 1)).toBe(t);
  });

  it('começa em zero, mantém o formato e as casas decimais, e sobe sem passar do valor', () => {
    expect(textoDaContagem('R$ 1.234,50', 0)).toBe('R$ 0,00');
    expect(textoDaContagem('45,5%', 0)).toBe('0,0%');
    expect(textoDaContagem('12', 0)).toBe('0');
    const meio = acharNumero(textoDaContagem('R$ 1.000,00', 0.5))!;
    expect(meio.valor).toBeGreaterThan(0);
    expect(meio.valor).toBeLessThan(1000);
    expect(meio.casas).toBe(2);
    expect(textoDaContagem('R$ 3,2 mi', 0)).toBe('R$ 0,0 mi');
  });

  it('não conta o que não é número positivo: texto, traço e negativo aparecem direto', () => {
    for (const t of ['—', 'Sem dados', '-R$ 500,00', 'R$ -500,00', '−12']) expect(textoDaContagem(t, 0.3)).toBe(t);
  });

  it('muda de um valor para outro sem recomeçar do zero', () => {
    const t = textoDaContagem('100', 0, 50);
    expect(acharNumero(t)!.valor).toBe(50);
    expect(acharNumero(textoDaContagem('100', 0.5, 50))!.valor).toBeGreaterThan(50);
  });

  it('desacelera e fica entre 0 e 1', () => {
    expect(suavizar(0)).toBe(0);
    expect(suavizar(1)).toBe(1);
    expect(suavizar(0.5)).toBeGreaterThan(0.5);
    expect(suavizar(2)).toBe(1);
    expect(suavizar(-1)).toBe(0);
  });
});

describe('pisca onde mudou', () => {
  const agora = 1_000_000;
  it('só considera que gravou com ?ok= no endereço ou marca recente', () => {
    expect(chegouDeGravacao('?ok=Salvo', null, agora)).toBe(true);
    expect(chegouDeGravacao('?a=1&ok=Salvo', null, agora)).toBe(true);
    expect(chegouDeGravacao('', null, agora)).toBe(false);
    expect(chegouDeGravacao('?erro=x', null, agora)).toBe(false);
    expect(chegouDeGravacao('', String(agora - 1000), agora)).toBe(true);
    expect(chegouDeGravacao('', String(agora - VALIDADE_DA_MARCA - 1), agora)).toBe(false);
    expect(chegouDeGravacao('', 'lixo', agora)).toBe(false);
  });

  it('pisca só se gravou e o conteúdo é diferente do já visto', () => {
    expect(deveFicarPiscando('R$ 10,00', 'R$ 20,00', true)).toBe(true);
    expect(deveFicarPiscando('R$ 10,00', 'R$ 10,00', true)).toBe(false); // o que não mudou
    expect(deveFicarPiscando(null, 'R$ 20,00', true)).toBe(false); // primeira abertura
    expect(deveFicarPiscando('R$ 10,00', 'R$ 20,00', false)).toBe(false); // sem gravação
  });

  it('a chave guardada é por página', () => {
    expect(chaveGuardada('/a', 'x')).not.toBe(chaveGuardada('/b', 'x'));
  });
});
