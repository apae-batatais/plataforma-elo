'use client';

/**
 * Casca da plataforma: barra lateral com tudo o que a pessoa pode acessar
 * (um único lugar de navegação), área do usuário e, no celular, menu que
 * abre por cima da página.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';
import {
  IconeChave, IconeFechar, IconeInicio, IconeMenu, IconeOrcamento, IconePessoas, IconePlanilha, IconeSair, IconeServicos,
} from './icones';

const ICONES = {
  inicio: IconeInicio,
  pessoas: IconePessoas,
  orcamento: IconeOrcamento,
  acessos: IconeChave,
  servicos: IconeServicos,
  planilhas: IconePlanilha,
} as const;

export type NomeIcone = keyof typeof ICONES;

export interface ItemNavegacao {
  rotulo: string;
  href: string;
  icone: NomeIcone;
  filhos?: { rotulo: string; href: string }[];
}

export interface GrupoNavegacao {
  titulo?: string;
  itens: ItemNavegacao[];
}

export interface UsuarioCasca {
  nome: string;
  email: string;
  perfis: string[];
}

function ativo(caminho: string, href: string, exato = false) {
  if (href === '/' || exato) return caminho === href;
  return caminho === href || caminho.startsWith(`${href}/`);
}

function Navegacao({ grupos, aoNavegar }: { grupos: GrupoNavegacao[]; aoNavegar?: () => void }) {
  const caminho = usePathname();
  return (
    <nav aria-label="Navegação principal" className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {grupos.map((g, i) => (
        <div key={g.titulo ?? i}>
          {g.titulo && <p className="mb-1.5 px-3 text-xs font-semibold text-lateral-suave">{g.titulo}</p>}
          <ul className="space-y-0.5">
            {g.itens.map((item) => {
              const Icone = ICONES[item.icone];
              const dentro = ativo(caminho, item.href);
              const aqui = item.filhos ? caminho === item.href : dentro;
              return (
                <li key={item.href}>
                  <Link
                    href={item.filhos?.[0]?.href ?? item.href}
                    onClick={aoNavegar}
                    aria-current={aqui ? 'page' : undefined}
                    className={`relative flex items-center gap-3 rounded-md px-3 py-2 text-[0.95rem] ${
                      dentro ? 'bg-lateral-ativo font-semibold text-white' : 'text-lateral-texto hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {dentro && <span className="absolute inset-y-1.5 left-0 w-1 rounded-r bg-marca" aria-hidden="true" />}
                    <Icone />
                    {item.rotulo}
                  </Link>
                  {item.filhos && dentro && (
                    <ul className="mb-1 ml-[1.375rem] mt-0.5 space-y-0.5 border-l border-white/15 pl-3">
                      {item.filhos.map((f) => {
                        const filhoAtivo = ativo(caminho, f.href, f.href === item.href);
                        return (
                          <li key={f.href}>
                            <Link
                              href={f.href}
                              onClick={aoNavegar}
                              aria-current={filhoAtivo ? 'page' : undefined}
                              className={`block rounded-md px-3 py-1.5 text-sm ${
                                filhoAtivo ? 'font-semibold text-marca' : 'text-lateral-texto hover:bg-white/5 hover:text-white'
                              }`}
                            >
                              {f.rotulo}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Marca() {
  return (
    <Link href="/" className="flex items-center gap-3 rounded-md px-2 py-1 text-white">
      <span className="flex size-9 items-center justify-center rounded-lg bg-marca text-[0.95rem] font-bold text-lateral" aria-hidden="true">
        A
      </span>
      <span className="leading-tight">
        <span className="block font-bold">APAE Batatais</span>
        <span className="block text-xs text-lateral-suave">Plataforma de gestão</span>
      </span>
    </Link>
  );
}

function AreaUsuario({ usuario, sair }: { usuario: UsuarioCasca; sair: () => Promise<void> }) {
  const iniciais = usuario.nome
    .replace(/\(.*?\)/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <div className="border-t border-white/10 p-3">
      <div className="flex items-center gap-3 rounded-md px-2 py-2">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white" aria-hidden="true">
          {iniciais}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{usuario.nome}</p>
          <p className="truncate text-xs text-lateral-suave" title={usuario.perfis.join(', ')}>
            {usuario.perfis.join(', ') || 'Sem perfil'}
          </p>
        </div>
        <form action={sair}>
          <button aria-label="Sair da plataforma" title="Sair" className="rounded-md p-2 text-lateral-texto hover:bg-white/10 hover:text-white">
            <IconeSair />
          </button>
        </form>
      </div>
    </div>
  );
}

export function Casca({
  grupos,
  usuario,
  sair,
  faixa,
  children,
}: {
  grupos: GrupoNavegacao[];
  usuario: UsuarioCasca;
  sair: () => Promise<void>;
  faixa?: ReactNode;
  children: ReactNode;
}) {
  const gaveta = useRef<HTMLDialogElement>(null);
  const caminho = usePathname();
  useEffect(() => gaveta.current?.close(), [caminho]);

  return (
    <div className="min-h-screen lg:pl-72">
      <a href="#conteudo" className="sr-only z-50 rounded bg-marca px-4 py-2 font-semibold text-lateral focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Pular para o conteúdo
      </a>

      {/* Computador: barra lateral fixa */}
      <aside className="fixed inset-y-0 left-0 hidden w-72 flex-col bg-lateral lg:flex">
        <div className="px-4 pb-2 pt-5">
          <Marca />
        </div>
        <Navegacao grupos={grupos} />
        <AreaUsuario usuario={usuario} sair={sair} />
      </aside>

      {/* Celular: barra superior + menu */}
      <div className="sticky top-0 z-30 flex items-center justify-between bg-lateral px-3 py-2 lg:hidden">
        <Marca />
        <button
          type="button"
          onClick={() => gaveta.current?.showModal()}
          aria-label="Abrir menu"
          className="rounded-md p-2 text-white hover:bg-white/10"
        >
          <IconeMenu tamanho={24} />
        </button>
      </div>
      <dialog
        ref={gaveta}
        aria-label="Menu"
        className="m-0 h-dvh max-h-dvh w-[min(20rem,88vw)] max-w-none bg-lateral p-0 backdrop:bg-black/50 lg:hidden"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-3 pb-2 pt-4">
            <Marca />
            <button type="button" onClick={() => gaveta.current?.close()} aria-label="Fechar menu" className="rounded-md p-2 text-white hover:bg-white/10">
              <IconeFechar tamanho={22} />
            </button>
          </div>
          <Navegacao grupos={grupos} aoNavegar={() => gaveta.current?.close()} />
          <AreaUsuario usuario={usuario} sair={sair} />
        </div>
      </dialog>

      {faixa}
      <main id="conteudo" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        {children}
      </main>
    </div>
  );
}
