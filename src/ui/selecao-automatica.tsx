'use client';

/**
 * Lista de escolha que salva sozinha: ao trocar a opção, envia o formulário
 * em que está. Mostra "Salvando…" enquanto grava. Use dentro de um <form>.
 */
import { useFormStatus } from 'react-dom';

export function SelecaoAutomatica({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { pending } = useFormStatus();
  return (
    <span className="inline-flex items-center gap-2">
      <select
        {...props}
        disabled={pending || props.disabled}
        onChange={(e) => {
          props.onChange?.(e);
          e.currentTarget.form?.requestSubmit();
        }}
        className={className}
      >
        {children}
      </select>
      <span aria-live="polite" className="text-xs text-texto-suave">
        {pending ? 'Salvando…' : ''}
      </span>
    </span>
  );
}
