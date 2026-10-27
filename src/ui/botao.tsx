import Link from 'next/link';
import type { ComponentProps } from 'react';

export type Variante = 'primario' | 'secundario' | 'perigo' | 'fantasma';

const BASE =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-[0.95rem] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55';

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-destaque text-sobre-destaque hover:bg-destaque-forte',
  secundario: 'border border-borda-forte bg-superficie text-texto hover:bg-destaque-suave',
  perigo: 'border border-erro bg-superficie text-erro hover:bg-erro-fundo',
  fantasma: 'text-destaque hover:bg-destaque-suave',
};

export const estiloBotao = (variante: Variante = 'primario', extra = '') => `${BASE} ${VARIANTES[variante]} ${extra}`;

export function Botao({ variante = 'primario', className = '', ...resto }: ComponentProps<'button'> & { variante?: Variante }) {
  return <button type="button" {...resto} className={estiloBotao(variante, className)} />;
}

export function LinkBotao({ variante = 'primario', className = '', ...resto }: ComponentProps<typeof Link> & { variante?: Variante }) {
  return <Link {...resto} className={estiloBotao(variante, className)} />;
}
