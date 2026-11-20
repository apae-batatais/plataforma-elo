/**
 * Regras puras da aplicação de instrumentos (issue #62, entrega 2): iniciais da pessoa e
 * conversão das respostas entre o que a planilha guarda (texto) e o que o motor usa.
 */
import { NAO_SE_APLICA, type Resposta, type Respostas } from '@/capacidades/motor-avaliacao';

const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

/** Iniciais para mostrar no lugar do nome ("Maria Aparecida da Silva" → "MAS"). */
export function iniciaisDoNome(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .filter((parte) => parte && !PARTICULAS.has(parte.toLowerCase()))
    .map((parte) => parte[0]!.toLocaleUpperCase('pt-BR'))
    .join('');
}

export function respostaParaTexto(r: Resposta): string {
  return r === NAO_SE_APLICA ? NAO_SE_APLICA : String(r);
}

export function textoParaResposta(t: string): Resposta | undefined {
  if (t === NAO_SE_APLICA) return NAO_SE_APLICA;
  const n = Number(t);
  return t.trim() !== '' && Number.isInteger(n) ? n : undefined;
}

/** Respostas guardadas (item + valor) em `Respostas` do motor. */
export function montarRespostas(linhas: { item: number; valor: string }[]): Respostas {
  const r: Respostas = {};
  for (const l of linhas) {
    const v = textoParaResposta(l.valor);
    if (v !== undefined) r[l.item] = v;
  }
  return r;
}
