/**
 * Conta dos números que sobem (peça `NumeroQueConta`). Funções puras, sem tela:
 * recebem o texto final já formatado (pelo servidor) e devolvem o texto de cada instante.
 */

/** Primeiro número do texto, no formato brasileiro (1.234,50), sem sinal de menos. */
const NUMERO = /\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/;

export interface NumeroNoTexto {
  inicio: number;
  fim: number;
  valor: number;
  casas: number;
}

/** Acha o número do texto. Devolve null se não houver, ou se for negativo (negativo aparece direto). */
export function acharNumero(texto: string): NumeroNoTexto | null {
  const m = NUMERO.exec(texto);
  if (!m) return null;
  if (/[-−]/.test(texto.slice(0, m.index))) return null;
  const [inteiro, decimais = ''] = m[0].replace(/\./g, '').split(',');
  return { inicio: m.index, fim: m.index + m[0].length, valor: Number(`${inteiro}.${decimais || '0'}`), casas: decimais.length };
}

/** Desaceleração: rápido no começo, devagar no fim. */
export const suavizar = (p: number) => 1 - (1 - Math.min(Math.max(p, 0), 1)) ** 3;

/**
 * Texto do instante `progresso` (0 a 1), indo de `de` até o valor do texto final.
 * Com progresso 1 devolve exatamente o texto final (nunca arredondado de outro jeito).
 */
export function textoDaContagem(texto: string, progresso: number, de = 0): string {
  const n = acharNumero(texto);
  if (!n || progresso >= 1) return texto;
  const atual = de + (n.valor - de) * suavizar(progresso);
  const f = atual.toLocaleString('pt-BR', { minimumFractionDigits: n.casas, maximumFractionDigits: n.casas });
  return texto.slice(0, n.inicio) + f + texto.slice(n.fim);
}
