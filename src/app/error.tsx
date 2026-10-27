'use client';

/** Erro inesperado: mensagem em português, com o código para localizar nos registros. */
export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">Algo deu errado</h1>
      <p className="text-texto-suave">
        A plataforma encontrou um erro inesperado. Tente de novo; se continuar, avise a administração informando o código
        abaixo.
      </p>
      {error.digest && <p className="font-mono text-sm">Código: {error.digest}</p>}
      <button onClick={reset} className="rounded-md bg-destaque px-4 py-2 font-medium text-white hover:opacity-90">
        Tentar de novo
      </button>
    </section>
  );
}
