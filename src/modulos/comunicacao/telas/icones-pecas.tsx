/** Ícones de traço dos tipos de peça (24×24, decorativos: o nome ao lado dá o sentido). */
import type { ReactNode } from 'react';
import type { TipoPeca } from '../dominio/pedido';

const DESENHOS: Record<TipoPeca, ReactNode> = {
  post_instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <circle cx="9" cy="9" r="1.6" />
      <path d="M20.5 15.5 15 10 5 20" />
    </>
  ),
  reel_instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="M3.5 8h17M8 3.5 10 8M13.5 3.5l2 4.5" />
      <path d="m10 11.5 4.5 2.75L10 17z" />
    </>
  ),
  release: (
    <>
      <path d="M5 4h11l3 3v13H5z" />
      <path d="M8.5 9.5h7M8.5 13h7M8.5 16.5h4" />
    </>
  ),
  artigo: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="m13.5 6.5 4 4M12 20h8" />
    </>
  ),
  entrevista: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
    </>
  ),
};

export function IconePeca({ tipo, tamanho = 24 }: { tipo: TipoPeca; tamanho?: number }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {DESENHOS[tipo]}
    </svg>
  );
}
