import { describe, expect, it } from 'vitest';
import {
  ativoNoMes, componentesZerados, custoMensal, distribuir, dividirIgualmente, parametrosCom, salarioPelaTabela,
  situacaoRateio, somaRateio, validarParametros, validarRateio, vigenteNoMes,
} from '../dominio/folha';

const semProvisoes = parametrosCom({ ferias: 0, terco_ferias: 0, decimo_terceiro: 0, abono: 0, fgts: 0, indenizacoes: 0 });

describe('custo do posto (regra 1)', () => {
  it('soma os componentes e aplica as provisões só sobre a parte remuneratória', () => {
    const c = { ...componentesZerados(), salario_base: 2000, insalubridade: 300, alimentacao: 500, plano_saude: 200 };
    const p = parametrosCom({ ferias: 8.33, terco_ferias: 2.78, decimo_terceiro: 8.33, abono: 0, fgts: 8, indenizacoes: 0 });
    const custo = custoMensal(c, p, 1);
    expect(custo.remuneracao).toBe(2300);
    expect(custo.beneficios).toBe(700);
    expect(custo.provisoes).toBe(631.12); // 2300 × 27,44%
    expect(custo.total).toBe(3631.12);
  });

  it('reajuste vale a partir do mês definido, sem mudar os meses anteriores, e não reajusta benefícios (regra 9)', () => {
    const c = { ...componentesZerados(), salario_base: 1000, alimentacao: 500 };
    const p = { ...semProvisoes, reajuste_percentual: 5, reajuste_mes: 5 };
    expect(custoMensal(c, p, 4).total).toBe(1500);
    expect(custoMensal(c, p, 5).total).toBe(1550);
    expect(custoMensal(c, p, 12).total).toBe(1550);
  });
});

describe('salário pela tabela (regra 2)', () => {
  it('proporcional à carga horária da referência do cargo', () => {
    expect(salarioPelaTabela(3000, 30, 40)).toBe(2250);
    expect(salarioPelaTabela(3000, null, 40)).toBe(3000);
  });
});

describe('rateio (regras 3, 6 e 7)', () => {
  it('só aceita soma exatamente 100%', () => {
    expect(validarRateio([{ centro: 'a', percentual: 60 }, { centro: 'b', percentual: 40 }])).toEqual([]);
    expect(validarRateio([{ centro: 'a', percentual: 60 }, { centro: 'b', percentual: 53 }]).join()).toMatch(/113%.*100%/);
    expect(validarRateio([{ centro: 'a', percentual: 50 }]).join()).toMatch(/50%/);
    expect(validarRateio([])).not.toEqual([]);
  });

  it('não aceita centro repetido, percentual zero ou mais de duas casas', () => {
    expect(validarRateio([{ centro: 'a', percentual: 50 }, { centro: 'a', percentual: 50 }]).join()).toMatch(/mais de uma vez/);
    expect(validarRateio([{ centro: 'a', percentual: 100 }, { centro: 'b', percentual: 0 }]).join()).toMatch(/maior que 0/);
    expect(validarRateio([{ centro: 'a', percentual: 33.333 }, { centro: 'b', percentual: 66.667 }]).join()).toMatch(/duas casas/);
  });

  it('soma em centésimos, sem erro de arredondamento', () => {
    expect(somaRateio([{ centro: 'a', percentual: 33.33 }, { centro: 'b', percentual: 33.33 }, { centro: 'c', percentual: 33.34 }])).toBe(100);
  });

  it('dividir igualmente fecha 100% na última linha', () => {
    expect(dividirIgualmente(['a', 'b', 'c'])).toEqual([
      { centro: 'a', percentual: 33.33 }, { centro: 'b', percentual: 33.33 }, { centro: 'c', percentual: 33.34 },
    ]);
    expect(dividirIgualmente(['a', 'b'])).toEqual([{ centro: 'a', percentual: 50 }, { centro: 'b', percentual: 50 }]);
    for (let n = 1; n <= 12; n++) {
      const linhas = dividirIgualmente(Array.from({ length: n }, (_, i) => `c${i}`));
      expect(validarRateio(linhas)).toEqual([]);
    }
  });

  it('situação para os atalhos da lista (regra 4)', () => {
    expect(situacaoRateio(undefined)).toBe('sem_rateio');
    expect(situacaoRateio([{ centro: 'a', percentual: 125 }])).toBe('fora_de_100');
    expect(situacaoRateio([{ centro: 'a', percentual: 100 }])).toBe('ok');
  });
});

describe('valor por centro de custo (regra 5)', () => {
  it('custo × percentual, sem perder nem criar centavos', () => {
    const d = distribuir(1000.01, dividirIgualmente(['a', 'b', 'c']));
    expect([...d.values()].reduce((s, v) => s + Math.round(v * 100), 0)).toBe(100001);
    expect(d.get('a')).toBe(333.3);
    expect(d.get('c')).toBe(333.41);
  });
});

describe('período (regras 8 e 10)', () => {
  it('vaga prevista conta a partir do mês de início; desligado deixa de contar depois do mês da saída', () => {
    const vaga = { inicio: '2027-03-01', desligamento: null };
    expect(ativoNoMes(vaga, 2027, 2)).toBe(false);
    expect(ativoNoMes(vaga, 2027, 3)).toBe(true);
    const saiu = { inicio: '2015-01-10', desligamento: '2027-06-15' };
    expect(ativoNoMes(saiu, 2027, 6)).toBe(true);
    expect(ativoNoMes(saiu, 2027, 7)).toBe(false);
  });

  it('vale o registro mais recente que já começou no mês (histórico preservado)', () => {
    const lista = [
      { vigencia: '2027-01-01', criado_em: '2026-10-01', v: 'jan' },
      { vigencia: '2027-05-01', criado_em: '2026-10-02', v: 'mai' },
      { vigencia: '2027-05-01', criado_em: '2026-10-03', v: 'mai-corrigido' },
    ];
    expect(vigenteNoMes(lista, 2027, 4)?.v).toBe('jan');
    expect(vigenteNoMes(lista, 2027, 5)?.v).toBe('mai-corrigido');
    expect(vigenteNoMes(lista, 2026, 12)).toBeUndefined();
  });
});

describe('parâmetros', () => {
  it('valida faixas', () => {
    expect(validarParametros(parametrosCom({}))).toEqual([]);
    expect(validarParametros(parametrosCom({ reajuste_mes: 13, fgts: -1 }))).toHaveLength(2);
  });
});
