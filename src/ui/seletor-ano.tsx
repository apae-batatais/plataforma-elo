import Link from 'next/link';

/**
 * Escolha do exercício (ano) no cabeçalho das telas: um controle segmentado,
 * o mesmo em todas as telas. O ano escolhido fica marcado com aria-current.
 */
export function SeletorAno({ anos, atual, href }: { anos: readonly number[]; atual: number; href: (ano: number) => string }) {
  if (anos.length < 2) return null;
  const ordenados = [...anos].sort((a, b) => a - b);
  return (
    <nav aria-label="Exercício" className="inline-flex rounded-lg border border-borda bg-superficie-2 p-0.5">
      {ordenados.map((a) => (
        <Link
          key={a}
          href={href(a)}
          aria-current={a === atual ? 'page' : undefined}
          className={`rounded-md px-3 py-1 text-sm font-semibold tabular-nums ${
            a === atual ? 'bg-superficie text-texto shadow-[0_1px_2px_rgb(0_0_0/0.12)] ring-1 ring-borda' : 'text-texto-suave hover:text-texto'
          }`}
        >
          {a}
        </Link>
      ))}
    </nav>
  );
}
