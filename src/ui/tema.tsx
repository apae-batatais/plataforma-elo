'use client';

/**
 * Tema claro ou escuro. Por padrão o Elo segue o computador da pessoa;
 * a escolha feita aqui fica guardada neste navegador (localStorage) e é
 * aplicada em <html data-tema="…"> antes da página aparecer (SCRIPT_TEMA).
 */
import { useEffect, useState } from 'react';
import { IconeComputador, IconeLua, IconeSol } from './icones';

export type Tema = 'sistema' | 'claro' | 'escuro';

import { CHAVE_TEMA as CHAVE } from './tema-script';

const OPCOES: { valor: Tema; rotulo: string; Icone: typeof IconeSol }[] = [
  { valor: 'sistema', rotulo: 'Igual ao computador', Icone: IconeComputador },
  { valor: 'claro', rotulo: 'Claro', Icone: IconeSol },
  { valor: 'escuro', rotulo: 'Escuro', Icone: IconeLua },
];

export function aplicarTema(tema: Tema) {
  const raiz = document.documentElement;
  if (tema === 'sistema') delete raiz.dataset.tema;
  else raiz.dataset.tema = tema;
  try {
    if (tema === 'sistema') localStorage.removeItem(CHAVE);
    else localStorage.setItem(CHAVE, tema);
  } catch {
    // Navegador sem armazenamento: a escolha vale só até recarregar a página.
  }
}

export function SeletorTema({ compacto = false }: { compacto?: boolean }) {
  const [tema, setTema] = useState<Tema>('sistema');
  useEffect(() => {
    const atual = document.documentElement.dataset.tema;
    setTema(atual === 'claro' || atual === 'escuro' ? atual : 'sistema');
  }, []);

  function escolher(novo: Tema) {
    setTema(novo);
    aplicarTema(novo);
  }

  if (compacto) {
    const indice = OPCOES.findIndex((o) => o.valor === tema);
    const proxima = OPCOES[(indice + 1) % OPCOES.length];
    const { Icone, rotulo } = OPCOES[indice];
    return (
      <button
        type="button"
        onClick={() => escolher(proxima.valor)}
        aria-label={`Tema: ${rotulo}. Trocar para ${proxima.rotulo.toLowerCase()}`}
        title={`Tema: ${rotulo}`}
        className="mx-auto mt-1 flex size-11 items-center justify-center rounded-md text-texto-suave hover:bg-superficie-2 hover:text-texto"
      >
        <Icone />
      </button>
    );
  }

  return (
    <div role="radiogroup" aria-label="Tema" className="mt-1 flex rounded-md border border-borda bg-superficie-2 p-0.5">
      {OPCOES.map(({ valor, rotulo, Icone }) => {
        const escolhido = tema === valor;
        return (
          <button
            key={valor}
            type="button"
            role="radio"
            aria-checked={escolhido}
            aria-label={rotulo}
            title={rotulo}
            onClick={() => escolher(valor)}
            className={`flex min-h-11 flex-1 items-center justify-center rounded transition-colors ${
              escolhido ? 'bg-superficie text-texto shadow-sm' : 'text-texto-suave hover:text-texto'
            }`}
          >
            <Icone tamanho={18} />
          </button>
        );
      })}
    </div>
  );
}
