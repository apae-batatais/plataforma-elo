'use client';

import type { ComponentProps, ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { estiloBotao, type Variante } from './botao';

/**
 * Botão de envio de formulário: enquanto o servidor trabalha, mostra o que
 * está acontecendo ("Salvando…") e não aceita um segundo clique.
 */
export function BotaoEnviar({
  children,
  enviando,
  variante = 'primario',
  className = '',
  pendente,
  ...resto
}: ComponentProps<'button'> & { variante?: Variante; enviando?: ReactNode; pendente?: boolean }) {
  const { pending } = useFormStatus();
  const ocupado = pending || pendente;
  return (
    <button type="submit" {...resto} disabled={ocupado || resto.disabled} aria-busy={ocupado || undefined} className={estiloBotao(variante, className)}>
      {ocupado && <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" />}
      {ocupado ? (enviando ?? 'Aguarde…') : children}
    </button>
  );
}
