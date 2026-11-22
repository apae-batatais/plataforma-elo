import { describe, expect, it } from 'vitest';
import { alcanceMedioPorTipo, dentroDoPrazoDeBusca, horaEmBrasilia, tituloDoAlcance } from '../dominio/resultado';

describe('regras do resultado', () => {
  it('hora de Brasília e prazo de 90 dias', () => {
    expect(horaEmBrasilia(new Date('2026-11-21T06:30:00Z'))).toBe(3);
    const agora = new Date('2026-11-21T06:00:00Z');
    expect(dentroDoPrazoDeBusca('2026-08-23T06:00:00Z', agora)).toBe(true);
    expect(dentroDoPrazoDeBusca('2026-08-22T06:00:00Z', agora)).toBe(false);
    expect(dentroDoPrazoDeBusca(null, agora)).toBe(false);
  });
  it('média por tipo, maior primeiro, e título em forma de conclusão', () => {
    const m = alcanceMedioPorTipo([
      { tipo: 'post', alcance: 100 },
      { tipo: 'post', alcance: 200 },
      { tipo: 'reel', alcance: 900 },
      { tipo: 'reel', alcance: null },
    ]);
    expect(m.map((x) => [x.tipo, x.alcanceMedio, x.postagens])).toEqual([['reel', 900, 1], ['post', 150, 2]]);
    expect(tituloDoAlcance(m)).toBe('Reel alcança mais que post, em média');
    expect(tituloDoAlcance([])).toBe('Alcance médio por tipo de peça');
  });
});
