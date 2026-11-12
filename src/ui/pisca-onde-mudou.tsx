'use client';

/**
 * Depois de gravar, o trecho que mudou pisca uma vez (identidade visual, "Efeitos de acabamento").
 * Envolva o que uma gravação pode alterar e dê uma `chave` estável (o id do registro, nunca um nome).
 * O último texto visto fica só no navegador da pessoa (sessionStorage) e some ao fechar a aba.
 * Com "menos movimento", vira um destaque fixo e discreto que some depois de 3 segundos.
 */
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MARCA_DE_GRAVACAO, chaveGuardada, chegouDeGravacao, deveFicarPiscando } from './pisca-regras';

type Tag = 'span' | 'div' | 'tr' | 'li' | 'dd';

export function PiscaOndeMudou({ chave, como = 'span', className = '', children }: { chave: string; como?: Tag; className?: string; children: ReactNode }) {
  const caminho = usePathname();
  const ref = useRef<HTMLElement>(null);
  const [piscando, setPiscando] = useState(0);

  // Sem lista de dependências de propósito: confere a cada vez que o conteúdo é redesenhado.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    try {
      const atual = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
      const guardada = chaveGuardada(caminho, chave);
      const visto = sessionStorage.getItem(guardada);
      const gravou = chegouDeGravacao(window.location.search, sessionStorage.getItem(MARCA_DE_GRAVACAO), Date.now());
      if (gravou) sessionStorage.setItem(MARCA_DE_GRAVACAO, String(Date.now()));
      sessionStorage.setItem(guardada, atual);
      if (deveFicarPiscando(visto, atual, gravou)) setPiscando((n) => n + 1);
    } catch {
      // Navegador sem armazenamento da sessão: simplesmente não pisca.
    }
  });

  useEffect(() => {
    if (!piscando) return;
    const t = setTimeout(() => setPiscando(0), 3000);
    return () => clearTimeout(t);
  }, [piscando]);

  const Elemento = como as 'span';
  return (
    <Elemento ref={ref as never} data-pisca={piscando ? 'sim' : undefined} className={`${como === 'span' ? 'inline-block ' : ''}${className}`.trim() || undefined}>
      {children}
    </Elemento>
  );
}
