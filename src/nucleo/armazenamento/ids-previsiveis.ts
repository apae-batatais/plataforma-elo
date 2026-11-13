import { createHash } from 'node:crypto';

/**
 * Identificadores previsíveis para a demonstração.
 *
 * Na demonstração os dados ficam na memória de cada cópia do servidor, e a Netlify roda várias
 * cópias. Com identificadores sorteados, cada cópia monta os dados fictícios com ids diferentes, e
 * um link aberto por outra cópia dá 404. Aqui o id sai de (instituição, aba, posição na aba): a
 * mesma ordem de inclusão dá os mesmos ids em todas as cópias. Nunca usar com dados reais.
 */
export function idsPrevisiveis(semente: string): (aba: string) => string {
  const contagem = new Map<string, number>();
  return (aba) => {
    const n = (contagem.get(aba) ?? 0) + 1;
    contagem.set(aba, n);
    const h = createHash('sha256').update(`${semente}\u0000${aba}\u0000${n}`).digest('hex');
    // Formato de UUID (versão 8, "personalizado"), para caber onde já se espera um id.
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-8${h.slice(13, 16)}-${((parseInt(h[16], 16) & 0x3) | 0x8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
  };
}
