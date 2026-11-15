/**
 * Formatação de números para a tela (moeda, porcentagem, número).
 *
 * Fica fora de `graficos.tsx` (que é 'use client') para poder ser chamada também nas páginas
 * que rodam no servidor: função de módulo 'use client' chamada no servidor quebra a página.
 */

export type Formato = 'moeda' | 'pct' | 'numero';

export function formatarValor(v: number, formato: Formato, curto = false): string {
  if (formato === 'pct') return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  if (formato === 'numero') return v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  if (!curto) return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const a = Math.abs(v);
  if (a >= 1e6) return `R$ ${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (a >= 1e3) return `R$ ${(v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`;
  return `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
}
