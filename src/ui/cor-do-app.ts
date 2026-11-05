/**
 * App de um endereço (primeiro trecho do caminho, ex.: "/orcamento/folha" → "orcamento").
 * Vai no atributo data-app, que troca a cor de destaque pela do app (globals.css).
 */
export function appDoCaminho(caminho: string): string | undefined {
  return caminho.split(/[/?#]/)[1] || undefined;
}
