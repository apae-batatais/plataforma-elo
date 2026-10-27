/**
 * Campos de formulário: rótulo sempre visível, dica abaixo do rótulo
 * (não dentro do campo) e marca de obrigatório.
 */
import type { ReactNode } from 'react';

export const estiloEntrada =
  'mt-1.5 block w-full min-h-10 rounded-md border border-borda-forte bg-superficie px-3 py-2 text-texto placeholder:text-texto-suave/70 disabled:bg-superficie-2 disabled:text-texto-suave';

export function Campo({
  rotulo,
  dica,
  obrigatorio,
  children,
  className = '',
}: {
  rotulo: ReactNode;
  dica?: ReactNode;
  obrigatorio?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="font-semibold text-texto">
        {rotulo}
        {obrigatorio && (
          <span className="ml-0.5 text-erro" aria-hidden="true">
            *
          </span>
        )}
      </span>
      {dica && <span className="mt-0.5 block font-normal text-texto-suave">{dica}</span>}
      {children}
    </label>
  );
}
