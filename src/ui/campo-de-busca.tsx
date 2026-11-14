'use client';

/**
 * Campo da busca única, na barra do topo. Formulário de método GET para /busca: o termo vai no endereço
 * (e só ali). Com `atalho`, a tecla "/" leva o foco ao campo quando a pessoa não está digitando em outro.
 */
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useId, useRef } from 'react';
import { IconeBusca } from './icones';

export function CampoDeBusca({ atalho = false, autoFoco = false }: { atalho?: boolean; autoFoco?: boolean }) {
  const id = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const caminho = usePathname();
  const q = useSearchParams().get('q') ?? '';
  const valorDaPagina = caminho === '/busca' ? q : '';

  useEffect(() => {
    if (autoFoco) entrada.current?.focus();
  }, [autoFoco]);

  useEffect(() => {
    if (!atalho) return;
    function aoTeclar(e: KeyboardEvent) {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName))) return;
      e.preventDefault();
      entrada.current?.focus();
    }
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [atalho]);

  return (
    <form action="/busca" method="get" role="search" className="w-full">
      <label htmlFor={id} className="sr-only">
        Buscar no Elo
      </label>
      <div className="relative">
        <IconeBusca className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-texto-suave" tamanho={18} />
        <input
          key={valorDaPagina}
          ref={entrada}
          id={id}
          name="q"
          type="search"
          autoComplete="off"
          defaultValue={valorDaPagina}
          placeholder="Buscar no Elo"
          aria-describedby={`${id}-dica`}
          className="block min-h-11 w-full rounded-md border border-borda-forte bg-superficie py-2 pl-10 pr-3 text-texto placeholder:text-texto-suave/70"
        />
      </div>
      <p id={`${id}-dica`} className="sr-only">
        Projeto, termo, requisição, pedido ou pessoa.{atalho ? ' Atalho: tecla barra.' : ''}
      </p>
    </form>
  );
}
