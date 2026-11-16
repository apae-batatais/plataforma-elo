import { describe, expect, it } from 'vitest';
import {
  NAO_SE_APLICA,
  calcularEscore,
  compararCiclos,
  definirInstrumento,
  dominiosDeMenorPercentual,
  itensSemResposta,
  recusaDeAlteracao,
  recusaDeFechamento,
  recusaDeResposta,
  vencimentoDaReavaliacao,
} from '../index';
import { instrumentoFicticio } from './instrumento-ficticio';

const inst = instrumentoFicticio();

describe('instrumento', () => {
  it('aceita a definição válida e guarda a etiqueta do item', () => {
    expect(inst.itens[0]!.etiqueta).toBe('d1');
    expect(inst.itens[1]!.permiteNaoSeAplica).toBe(false);
  });
  it('recusa item com domínio inexistente, número repetido e domínio sem item', () => {
    const base = { ...inst };
    expect(() => definirInstrumento({ ...base, itens: [{ numero: 1, texto: 'x', dominio: 'Z' }] })).toThrow(/domínio que não existe/);
    expect(() => definirInstrumento({ ...base, itens: [...base.itens, { numero: 1, texto: 'x', dominio: 'A' }] })).toThrow(/mesmo número/);
    expect(() => definirInstrumento({ ...base, dominios: [...base.dominios, { codigo: 'C', nome: 'C' }] })).toThrow(/não tem itens/);
  });
  it('exige faixas contínuas de 0 ao máximo', () => {
    const base = { ...inst };
    expect(() => definirInstrumento({ ...base, faixas: [{ nome: 'x', de: 1, ate: 12 }] })).toThrow(/começar em 0/);
    expect(() =>
      definirInstrumento({
        ...base,
        faixas: [
          { nome: 'x', de: 0, ate: 4 },
          { nome: 'y', de: 6, ate: 12 },
        ],
      }),
    ).toThrow(/vazio/);
    expect(() => definirInstrumento({ ...base, faixas: [{ nome: 'x', de: 0, ate: 10 }] })).toThrow(/terminar em 12/);
  });
  it('depois de usado, não muda sem nova versão', () => {
    const alterado = definirInstrumento({ ...inst, nome: 'Outro nome' });
    expect(recusaDeAlteracao(inst, alterado, true)).toMatch(/nova versão/);
    expect(recusaDeAlteracao(inst, alterado, false)).toBeNull();
    expect(recusaDeAlteracao(inst, { ...alterado, versao: 2 }, true)).toBeNull();
    expect(recusaDeAlteracao(inst, { ...alterado, versao: 3 }, true)).toMatch(/seguinte/);
    expect(recusaDeAlteracao(inst, { ...inst, versao: 1, codigo: 'outro' }, false)).toMatch(/código/);
  });
});

describe('respostas', () => {
  it('aceita só inteiro de 0 a 3', () => {
    for (const v of [0, 1, 2, 3]) expect(recusaDeResposta(inst, 1, v)).toBeNull();
    for (const v of [-1, 4, 1.5, '2', null, NaN]) expect(recusaDeResposta(inst, 1, v)).not.toBeNull();
  });
  it('"não se aplica" só onde o item permite', () => {
    expect(recusaDeResposta(inst, 3, NAO_SE_APLICA)).toBeNull();
    expect(recusaDeResposta(inst, 1, NAO_SE_APLICA)).toMatch(/não aceita/);
  });
  it('recusa item que não existe', () => {
    expect(recusaDeResposta(inst, 9, 1)).toMatch(/não existe/);
  });
  it('lista os itens sem resposta e só fecha completo, com justificativa', () => {
    expect(itensSemResposta(inst, { 1: 0, 2: 1 })).toEqual([3, 4]);
    expect(recusaDeFechamento(inst, { 1: 0, 2: 1 }, 'ok')).toMatch(/3, 4/);
    const todas = { 1: 1, 2: 1, 3: 1, 4: 1 };
    expect(recusaDeFechamento(inst, todas, '   ')).toMatch(/justificativa/);
    expect(recusaDeFechamento(inst, todas, 'Motivo')).toBeNull();
  });
});

describe('escore', () => {
  it('soma por domínio e total e acha a faixa (limites incluídos)', () => {
    const e = calcularEscore(inst, { 1: 3, 2: 2, 3: 2, 4: 2 });
    expect(e.dominios.map((d) => d.pontos)).toEqual([5, 4]);
    expect(e.total).toBe(9);
    expect(e.enquadramento?.nome).toBe('Alta');
    expect(calcularEscore(inst, { 1: 1, 2: 1, 3: 1, 4: 1 }).enquadramento?.nome).toBe('Baixa');
    expect(calcularEscore(inst, { 1: 2, 2: 1, 3: 1, 4: 1 }).enquadramento?.nome).toBe('Média');
  });
  it('"não se aplica" sai do cálculo e do máximo', () => {
    const e = calcularEscore(inst, { 1: 3, 2: 3, 3: NAO_SE_APLICA, 4: 3 });
    expect(e.total).toBe(9);
    expect(e.itensConsiderados).toBe(3);
    expect(e.maximo).toBe(9);
    expect(e.dominios[1]).toMatchObject({ itensConsiderados: 1, maximo: 3, percentual: 100 });
  });
  it('incompleto não tem enquadramento', () => {
    const e = calcularEscore(inst, { 1: 3 });
    expect(e.completo).toBe(false);
    expect(e.enquadramento).toBeNull();
  });
  it('recusa resposta inválida', () => {
    expect(() => calcularEscore(inst, { 1: 7 })).toThrow();
  });
  it('principal barreira: menor percentual, com empate', () => {
    const e = calcularEscore(inst, { 1: 3, 2: 3, 3: 0, 4: 1 });
    expect(dominiosDeMenorPercentual(e).map((d) => d.codigo)).toEqual(['B']);
    const empate = calcularEscore(inst, { 1: 1, 2: 1, 3: 1, 4: 1 });
    expect(dominiosDeMenorPercentual(empate).map((d) => d.codigo)).toEqual(['A', 'B']);
  });
});

describe('comparação entre ciclos', () => {
  const ciclo = (id: string, data: string, v: number, r: number) => ({ id, data, versao: v, respostas: { 1: r, 2: r, 3: r, 4: r } });
  it('ordena por data e mostra a diferença entre o último e o primeiro', () => {
    const c = compararCiclos([inst], [ciclo('b', '2026-06-01', 1, 1), ciclo('a', '2025-06-01', 1, 3)]);
    expect(c.pontos.map((p) => p.id)).toEqual(['a', 'b']);
    expect(c.diferencaDoTotal).toBe(-8);
    expect(c.avisoDeVersoes).toBeNull();
  });
  it('só soma a mesma versão e avisa das outras', () => {
    const v2 = instrumentoFicticio(2);
    const c = compararCiclos([inst, v2], [ciclo('a', '2025-01-01', 1, 3), ciclo('b', '2026-01-01', 2, 1), ciclo('c', '2026-07-01', 2, 2)]);
    expect(c.versao).toBe(2);
    expect(c.pontos).toHaveLength(2);
    expect(c.deOutraVersao).toBe(1);
    expect(c.avisoDeVersoes).toMatch(/outra versão/);
  });
  it('um ciclo só não tem diferença; nenhum ciclo é vazio', () => {
    expect(compararCiclos([inst], [ciclo('a', '2025-01-01', 1, 1)]).diferencaDoTotal).toBeNull();
    expect(compararCiclos([inst], []).pontos).toEqual([]);
  });
  it('recusa quando falta o instrumento da versão', () => {
    expect(() => compararCiclos([inst], [ciclo('a', '2025-01-01', 5, 1)])).toThrow(/versão 5/);
  });
  it('reavaliação vence 12 meses depois', () => {
    expect(vencimentoDaReavaliacao('2026-03-15')).toBe('2027-03-15');
    expect(vencimentoDaReavaliacao('2024-02-29')).toBe('2025-02-28');
  });
});
