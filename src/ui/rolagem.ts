/** Ainda há coluna escondida à direita? (função pura, com teste) */
export function temMaisColunasADireita(rolagemEsquerda: number, larguraVisivel: number, larguraTotal: number): boolean {
  return larguraTotal - (rolagemEsquerda + larguraVisivel) > 1;
}
