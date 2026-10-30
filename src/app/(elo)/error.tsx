'use client';

import { estiloBotao } from '@/ui/botao';

/** Erro inesperado: mensagem em português, com o código para localizar nos registros. */
export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="mx-auto max-w-2xl space-y-4 py-6">
      <h1 className="text-[1.75rem] font-bold leading-tight">Algo deu errado</h1>
      <p className="text-texto-suave">
        A plataforma encontrou um erro inesperado e nada foi alterado. Tente de novo; se continuar, avise a administração informando o código abaixo.
      </p>
      {error.digest && <p className="rounded-md bg-superficie-2 px-3 py-2 font-mono text-sm">Código: {error.digest}</p>}
      <button onClick={reset} className={estiloBotao('primario')}>
        Tentar de novo
      </button>
    </section>
  );
}
