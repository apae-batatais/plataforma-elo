/** Conferência de CPF e CNPJ (dígitos verificadores). Grava-se só dígitos. */

export const soDigitos = (v: string) => v.replace(/\D/g, '');

function digito(base: number[], pesos: number[]): number {
  const soma = base.reduce((s, n, i) => s + n * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cpfValido(v: string): boolean {
  const d = soDigitos(v);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const n = [...d].map(Number);
  const d1 = digito(n.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = digito(n.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return n[9] === d1 && n[10] === d2;
}

export function cnpjValido(v: string): boolean {
  const d = soDigitos(v);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const n = [...d].map(Number);
  const d1 = digito(n.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = digito(n.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return n[12] === d1 && n[13] === d2;
}

export function formatarDocumento(d: string): string {
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return d;
}
