import { describe, expect, it } from 'vitest';
import {
  ativoNoMes, calcularLinha, componentesZerados, distribuir, dividirIgualmente, parametrosCom, resumirEstudo,
  situacaoRateio, somaRateio, validarParametros, validarRateio, vigenteNoMes,
} from '../dominio/folha';

const p = parametrosCom({});

describe('colunas calculadas da aba Estudo (regra 1)', () => {
  it('reproduz as fórmulas da planilha', () => {
    const c = { ...componentesZerados(5), salario_atual: 2155, alimentacao: 340 };
    expect(calcularLinha(c, 200, p)).toEqual({
      valorHora: 10.78, // Salário atual ÷ carga horária
      salarioBase: 2262.75, // Salário atual × 1,05
      valorHoraBase: 11.31,
      horaAtividade: 0,
      tercoFerias: 62.85, // (Salário base ÷ 3) ÷ 12
      decimoTerceiro: 188.56, // Salário base ÷ 12
      fgts: 201.13, // 8% de (base + adicional + hora atividade + insalubridade + 1/3 + 13º)
      total: 3055.3, // soma de Salário base até FGTS
    });
  });

  it('hora atividade é 5% do salário base para quem recebe; entra no FGTS', () => {
    const c = { ...componentesZerados(5), salario_atual: 3000, hora_atividade: true, adicional_salarial: 100, insalubridade: 300, alimentacao: 340 };
    const l = calcularLinha(c, 150, p);
    expect(l.horaAtividade).toBe(157.5);
    expect(l.fgts).toBe(324.6);
    expect(l.total).toBe(4722.1);
  });

  it('reajuste vale a partir do mês definido nos parâmetros (regra 9)', () => {
    const c = { ...componentesZerados(5), salario_atual: 1000 };
    const maio = { ...p, reajuste_mes: 5 };
    expect(calcularLinha(c, 200, maio, 4).salarioBase).toBe(1000);
    expect(calcularLinha(c, 200, maio, 5).salarioBase).toBe(1050);
  });
});

describe('resumo no formato da aba Estudo', () => {
  const a = { ...componentesZerados(5), salario_atual: 2155, alimentacao: 340 };
  const b = { ...componentesZerados(5), salario_atual: 3000, hora_atividade: true, adicional_salarial: 100, insalubridade: 300, alimentacao: 340, plano_saude: 200, bolsa_estudo: 50, indenizacoes: 10 };
  const itens = [a, b].map((c) => ({ c, calc: calcularLinha(c, 200, p) }));
  const r = resumirEstudo(itens, p);

  it('remuneração salarial: vencimentos (base + adicional + hora atividade), insalubridade, férias e 13º', () => {
    expect(r.salarial.linhas.map((l) => l.valor)).toEqual([5670.25, 300, 0, 150.35, 451.06]);
    expect(r.salarial.total).toBe(6571.66); // soma dos valores de cada pessoa, já em centavos
  });

  it('benefícios incluem plano de saúde e bolsa estudo (erros da planilha corrigidos)', () => {
    expect(r.beneficios.total).toBe(930);
  });

  it('encargos sobre a remuneração salarial; aposentadoria especial só de quem tem insalubridade', () => {
    expect(r.encargos.linhas[3].valor).toBe(207); // 6% de (3150 + 300)
    expect(r.encargos.total).toBeCloseTo(2461.08, 1);
    expect(r.indenizacoes).toBe(10);
    expect(r.totalGeral).toBeCloseTo(9972.75, 1);
  });

  it('Total CEBAS = INSS + terceiros + FAP + aposentadoria especial; remuneração + FGTS = total geral − CEBAS', () => {
    expect(r.quadros.totalCebas).toBeCloseTo(1935.35, 1);
    expect(r.quadros.totalRemuneracaoMaisFgts).toBeCloseTo(r.totalGeral - r.quadros.totalCebas, 2);
    expect(r.quadros.totalSemEncargos).toBe(r.subtotalRemuneracao);
  });

  it('peso de lotação divide o resumo proporcionalmente', () => {
    const metade = resumirEstudo(itens.map((x) => ({ ...x, peso: 0.5 })), p);
    expect(metade.totalGeral).toBeCloseTo(r.totalGeral / 2, 1);
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
