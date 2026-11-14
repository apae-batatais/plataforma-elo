'use client';

/**
 * "Neste painel": faixa de atalhos para as seções de um painel longo. Fica visível ao rolar,
 * leva à seção (rolagem suave, direta com "menos movimento") e marca a seção em foco.
 * Cada seção da página é um <section id="…"> com título; os `id` daqui são os mesmos.
 */
import { useEffect, useState } from 'react';

export interface AtalhoSecao {
  id: string;
  rotulo: string;
}

export function AtalhosSecoes({ secoes }: { secoes: AtalhoSecao[] }) {
  const [emFoco, setEmFoco] = useState(secoes[0]?.id);

  useEffect(() => {
    const elementos = secoes.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => !!e);
    if (elementos.length === 0 || typeof IntersectionObserver === 'undefined') return;
    const visiveis = new Set<string>();
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) visiveis.add(e.target.id);
          else visiveis.delete(e.target.id);
        }
        // A primeira seção (na ordem da página) que está na faixa de leitura.
        const primeira = secoes.find((s) => visiveis.has(s.id));
        if (primeira) setEmFoco(primeira.id);
      },
      { rootMargin: '-20% 0px -65% 0px' },
    );
    elementos.forEach((e) => observador.observe(e));
    return () => observador.disconnect();
  }, [secoes]);

  function ir(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    const alvo = document.getElementById(id);
    if (!alvo) return;
    e.preventDefault();
    const menosMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    alvo.scrollIntoView({ behavior: menosMovimento ? 'auto' : 'smooth', block: 'start' });
    alvo.focus({ preventScroll: true });
    history.replaceState(null, '', `#${id}`);
    setEmFoco(id);
  }

  return (
    <nav aria-label="Neste painel" className="sticky top-14 z-10 -mx-4 border-b border-borda bg-fundo/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-10 lg:px-10 print:hidden">
      <div className="flex items-center gap-2 overflow-x-auto">
        <span className="shrink-0 text-sm font-semibold text-texto-suave">Neste painel</span>
        <ul className="flex gap-2">
          {secoes.map((s) => {
            const aqui = emFoco === s.id;
            return (
              <li key={s.id} className="shrink-0">
                <a
                  href={`#${s.id}`}
                  onClick={(e) => ir(e, s.id)}
                  aria-current={aqui ? 'location' : undefined}
                  className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors ${
                    aqui ? 'border-destaque bg-destaque-suave text-destaque' : 'border-borda bg-superficie text-texto-suave hover:text-texto'
                  }`}
                >
                  {s.rotulo}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
