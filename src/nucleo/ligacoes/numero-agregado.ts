/**
 * Número agregado protegido (ADR-023): todo número calculado sobre pessoas só sai daqui, com o mínimo de
 * 5 pessoas (decisão da Diretoria, 13/11/2026). A regra é aplicada na origem; nenhum app consumidor a refaz.
 * A resposta tem só `valor`, `base` e `motivo`: nunca nome, iniciais, nascimento nem id de pessoa.
 */
export const MINIMO_DE_PESSOAS = 5;

export type MotivoSemNumero = 'poucos_casos' | 'sem_dados';

export interface NumeroAgregado {
  /** O número; `null` quando não pode aparecer (veja `motivo`). */
  valor: number | null;
  /** Quantas pessoas entraram na conta. */
  base: number;
  motivo: MotivoSemNumero | null;
}

/**
 * @param tipo `contagem`: base 0 mostra 0 (não identifica ninguém); `media` e `percentual`: base 0 é "sem dados".
 * Base de 1 a 4 nunca mostra o valor, nem arredondado nem em faixa.
 */
export function numeroAgregado(entrada: { valor: number | null; base: number; tipo: 'contagem' | 'media' | 'percentual' }): NumeroAgregado {
  const { valor, base, tipo } = entrada;
  if (base <= 0) return tipo === 'contagem' ? { valor: 0, base: 0, motivo: null } : { valor: null, base: 0, motivo: 'sem_dados' };
  if (base < MINIMO_DE_PESSOAS || valor === null) return { valor: null, base, motivo: 'poucos_casos' };
  return { valor, base, motivo: null };
}
