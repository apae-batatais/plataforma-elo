'use client';

/**
 * Menu do usuário, no rodapé da barra lateral: uma linha com as iniciais e o nome;
 * ao abrir (por cima), mostra nome e perfis, tema, versão e "Sair da plataforma".
 * Fecha com Esc (devolvendo o foco ao botão), ao clicar fora e ao sair.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { NOME_PLATAFORMA, textoVersao } from './marca';
import { IconeMaisOpcoes, IconeSair } from './icones';
import { SeletorTema } from './tema';

export interface UsuarioMenu {
  nome: string;
  perfis: string[];
}

export function iniciaisDoNome(nome: string): string {
  return nome
    .replace(/\(.*?\)/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export function MenuUsuario({ usuario, sair, recolhido = false }: { usuario: UsuarioMenu; sair: () => Promise<void>; recolhido?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!aberto) return;
    function fora(e: PointerEvent) {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setAberto(false);
        botao.current?.focus();
      }
    }
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', fora);
      document.removeEventListener('keydown', tecla);
    };
  }, [aberto]);

  const perfis = usuario.perfis.join(', ') || 'Sem perfil';
  return (
    <div ref={raiz} className="relative border-t border-borda p-3">
      {aberto && (
        <div id={id} role="group" aria-label="Menu do usuário" className="absolute inset-x-3 bottom-full mb-1 space-y-3 rounded-cartao border border-borda bg-superficie p-3 shadow-lg">
          <div className="min-w-0">
            <p className="break-words text-sm font-semibold text-texto">{usuario.nome}</p>
            <p className="text-xs text-texto-suave">{perfis}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-texto-suave">Tema</p>
            <SeletorTema />
          </div>
          <p className="text-[0.75rem] text-texto-suave">
            {NOME_PLATAFORMA} · {textoVersao()}
          </p>
          <form action={sair}>
            <button className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-sm font-semibold text-texto hover:bg-superficie-2">
              <IconeSair />
              Sair da plataforma
            </button>
          </form>
        </div>
      )}
      <button
        ref={botao}
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-controls={aberto ? id : undefined}
        aria-label={recolhido ? `Menu do usuário: ${usuario.nome}` : undefined}
        title={recolhido ? usuario.nome : undefined}
        className={`flex min-h-11 w-full items-center gap-3 rounded-md px-2 py-1 text-left hover:bg-superficie-2 ${recolhido ? 'justify-center' : ''}`}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-superficie-2 text-sm font-semibold text-texto" aria-hidden="true">
          {iniciaisDoNome(usuario.nome)}
        </span>
        {!recolhido && (
          <>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-texto">{usuario.nome}</span>
            <IconeMaisOpcoes className="shrink-0 text-texto-suave" />
          </>
        )}
      </button>
    </div>
  );
}
