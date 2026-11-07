/** Regras puras dos itens do calendário da Comunicação. */
import type { TipoPeca } from './pedido';

export type TipoData = 'exata' | 'periodo';

export interface ItemCalendarioEntrada {
  tema: string;
  tipoData: TipoData;
  inicio: string;
  fim: string;
  tipos: TipoPeca[];
}

/** Devolve as mensagens de erro do item (lista vazia = item válido). */
export function conferirItemCalendario(i: ItemCalendarioEntrada): string[] {
  const erros: string[] = [];
  if (!i.tema.trim()) erros.push('Informe o tema.');
  if (i.tipoData === 'exata' && i.inicio !== i.fim) erros.push('Data exata tem início e fim no mesmo dia.');
  if (i.tipoData === 'periodo' && i.fim < i.inicio) erros.push('O fim do período não pode ser antes do início.');
  if (i.tipos.length === 0) erros.push('Escolha pelo menos um tipo de peça sugerido.');
  return erros;
}

/** Itens que aparecem para escolha: ativos e ainda não encerrados, do mais próximo ao mais distante. */
export function itensParaEscolha<T extends { ativo: boolean; inicio: string; fim: string }>(itens: T[], hoje: string): T[] {
  return itens.filter((i) => i.ativo && i.fim >= hoje).sort((a, b) => a.inicio.localeCompare(b.inicio));
}
