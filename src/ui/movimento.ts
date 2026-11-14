/**
 * Conta do movimento dos gráficos (funções puras, com teste). O gancho que usa estas contas
 * está em `use-valores-animados.ts`. Duração dentro do limite de 0,2 a 0,6 s da identidade visual.
 */
export const DURACAO_MS = 400;

/** Entre 0 e 1, começando rápido e chegando devagar. */
export function facilitar(t: number): number {
  const x = Math.min(Math.max(t, 0), 1);
  return 1 - (1 - x) ** 3;
}

export type ValoresPorSerie = Record<string, number[]>;

/**
 * Valores no instante `t` (0 a 1) entre `de` e `para`. Série nova (ou ponto novo) parte de `base`;
 * série que saiu não aparece. Em `t >= 1`, ou com "menos movimento", devolve exatamente `para`.
 */
export function interpolarValores(de: ValoresPorSerie, para: ValoresPorSerie, t: number, base = 0, menosMovimento = false): ValoresPorSerie {
  if (menosMovimento || t >= 1) return para;
  const k = facilitar(t);
  const saida: ValoresPorSerie = {};
  for (const [nome, alvo] of Object.entries(para)) {
    const antes = de[nome] ?? [];
    saida[nome] = alvo.map((v, i) => {
      const inicio = antes[i] ?? base;
      return inicio + (v - inicio) * k;
    });
  }
  return saida;
}

/** Ponto de partida de um gráfico que está abrindo: tudo na linha de base. */
export function partidaNaBase(para: ValoresPorSerie, base = 0): ValoresPorSerie {
  return Object.fromEntries(Object.entries(para).map(([nome, v]) => [nome, v.map(() => base)]));
}
