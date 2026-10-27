'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Abas do app, marcando a página atual. */
export function Navegacao({ itens }: { itens: { rotulo: string; href: string }[] }) {
  const atual = usePathname();
  const ativo = (href: string) => (href === '/orcamento' ? atual === href : atual.startsWith(href));
  return (
    <nav aria-label="Seções do Orçamento" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex min-w-max gap-1 border-b border-borda">
        {itens.map((i) => (
          <li key={i.href}>
            <Link
              href={i.href}
              aria-current={ativo(i.href) ? 'page' : undefined}
              className={`block border-b-2 px-3 py-2 text-sm ${
                ativo(i.href) ? 'border-destaque font-semibold text-texto' : 'border-transparent text-texto-suave hover:text-texto'
              }`}
            >
              {i.rotulo}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
