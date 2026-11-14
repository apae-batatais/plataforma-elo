/** Só a primeira letra em maiúscula ("novembro de 2026" → "Novembro de 2026"); o resto não muda. */
export function maiusculaInicial(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase('pt-BR') + texto.slice(1);
}
