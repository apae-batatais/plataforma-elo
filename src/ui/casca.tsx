'use client';

/**
 * Casca da plataforma: barra lateral com tudo o que a pessoa pode acessar
 * (um único lugar de navegação), área do usuário e, no celular, menu que
 * abre por cima da página.
 */
import { MarcaElo, NOME_PLATAFORMA } from './marca';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MenuUsuario } from './menu-usuario';
import { agruparItens, chaveDoGrupo, grupoAberto, type EscolhaDeGrupos } from './grupos-do-menu';
import { appDoCaminho } from './cor-do-app';
import { CampoDeBusca } from './campo-de-busca';
import { ICONES, IconeBusca, IconeFechar, IconeMenu, IconeRecolher, IconeSeta, type NomeIcone } from './icones';

export type { NomeIcone };

export interface ItemNavegacao {
  rotulo: string;
  href: string;
  icone: NomeIcone;
  filhos?: { rotulo: string; href: string; secao?: string }[];
  /** Família de apps (ex.: Avaliações): o item vira um grupo que abre e fecha, com um app em cada filho (terceiro nível do menu). */
  apps?: ItemNavegacao[];
  /** Marca de pendência ao lado do nome (ex.: "Atualizar"). */
  alerta?: string;
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

/** Telas de um app, em grupos que abrem e fecham (só o da tela atual vem aberto; a escolha fica lembrada). */
function TelasDoApp({ item, caminho, aoNavegar }: { item: ItemNavegacao; caminho: string; aoNavegar?: () => void }) {
  const filhos = item.filhos ?? [];
  const [escolhas, setEscolhas] = useState<EscolhaDeGrupos>({});
  const grupos = agruparItens(filhos);
  useEffect(() => {
    const lidas: EscolhaDeGrupos = {};
    try {
      for (const g of agruparItens(filhos)) {
        if (!g.titulo) continue;
        const v = localStorage.getItem(chaveDoGrupo(item.href, g.titulo));
        if (v) lidas[g.titulo] = v === 'aberto';
      }
    } catch {
      // Navegador sem armazenamento: a escolha vale só até recarregar.
    }
    setEscolhas(lidas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.href]);

  // Só o item mais específico fica marcado (ex.: Despesas, e não também Previsão).
  const maisLongo = filhos.filter((x) => ativo(caminho, x.href, x.href === item.href)).sort((a, b) => b.href.length - a.href.length)[0];
  const grupoAtual = maisLongo ? filhos.find((f) => f.href === maisLongo.href)?.secao : undefined;

  function alternar(titulo: string) {
    const novo = !grupoAberto(titulo, grupoAtual, escolhas);
    setEscolhas((e) => ({ ...e, [titulo]: novo }));
    try {
      localStorage.setItem(chaveDoGrupo(item.href, titulo), novo ? 'aberto' : 'fechado');
    } catch {
      // Sem armazenamento, vale até recarregar.
    }
  }

  const lista = (itens: typeof filhos, id?: string) => (
    <ul id={id} className="mb-1 ml-[1.375rem] mt-0.5 space-y-0.5 border-l border-borda pl-3">
      {itens.map((f) => {
        const filhoAtivo = maisLongo?.href === f.href;
        return (
          <li key={f.href}>
            <Link
              href={f.href}
              onClick={aoNavegar}
              aria-current={filhoAtivo ? 'page' : undefined}
              className={`relative block min-h-9 rounded-md px-3 py-1.5 text-sm ${
                filhoAtivo ? 'bg-destaque-suave font-semibold text-texto' : 'text-texto-suave hover:bg-superficie-2 hover:text-texto'
              }`}
            >
              {filhoAtivo && <span className="absolute inset-y-1 -left-[0.8125rem] w-0.5 rounded bg-destaque" aria-hidden="true" />}
              {f.rotulo}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="mt-1">
      {grupos.map((g, i) => {
        if (!g.titulo) return <div key={i}>{lista(g.itens)}</div>;
        const aberto = grupoAberto(g.titulo, grupoAtual, escolhas);
        const id = `grupo-${item.href.replace(/\W+/g, '-')}-${i}`;
        return (
          <div key={g.titulo} className="mt-1 first:mt-0">
            <button
              type="button"
              onClick={() => alternar(g.titulo!)}
              aria-expanded={aberto}
              aria-controls={id}
              className="ml-3 flex min-h-9 w-[calc(100%-0.75rem)] items-center gap-1.5 rounded-md px-2 text-left text-sm font-medium text-texto hover:bg-superficie-2"
            >
              <IconeSeta tamanho={14} className={`shrink-0 text-texto-suave transition-transform duration-200 ${aberto ? 'rotate-90' : ''}`} />
              {g.titulo}
            </button>
            {aberto && lista(g.itens, id)}
          </div>
        );
      })}
    </div>
  );
}

/** Um app no menu (também dentro de uma família): link com ícone e, se a tela atual é dele, as telas dele. */
function ItemDeApp({ item, caminho, aoNavegar, recolhido, marcado }: { item: ItemNavegacao; caminho: string; aoNavegar?: () => void; recolhido: boolean; marcado?: boolean }) {
  const Icone = ICONES[item.icone];
  const dentro = marcado ?? ativo(caminho, item.href);
  const aqui = item.filhos ? caminho === item.href : dentro;
  return (
    <li data-app={appDoCaminho(item.href)}>
      <Link
        href={item.filhos?.[0]?.href ?? item.href}
        onClick={aoNavegar}
        aria-current={aqui ? 'page' : undefined}
        title={recolhido ? item.rotulo : undefined}
        className={`relative flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-[0.95rem] transition-colors ${recolhido ? 'justify-center' : ''} ${
          dentro ? 'bg-destaque-suave font-bold text-texto' : 'font-semibold text-texto-suave hover:bg-superficie-2 hover:text-texto'
        }`}
      >
        {dentro && <span className="absolute inset-y-1.5 left-0 w-1 rounded-r bg-destaque" aria-hidden="true" />}
        <span className={dentro ? 'text-destaque' : ''}>
          <Icone />
        </span>
        <span className={recolhido ? 'sr-only' : ''}>{item.rotulo}</span>
        {item.alerta && (
          <span
            className={
              recolhido
                ? 'absolute right-1.5 top-1.5 size-2.5 rounded-full bg-aviso'
                : 'ml-auto rounded-full bg-aviso-fundo px-2 py-0.5 text-[0.75rem] font-bold text-aviso'
            }
          >
            <span className={recolhido ? 'sr-only' : ''}>{item.alerta}</span>
          </span>
        )}
      </Link>
      {item.filhos && dentro && !recolhido && <TelasDoApp item={item} caminho={caminho} aoNavegar={aoNavegar} />}
    </li>
  );
}

/** Família de apps: botão que abre e fecha (a da tela atual sempre vem aberta; a escolha fica lembrada) com os apps dentro. */
function FamiliaDeApps({ item, caminho, aoNavegar }: { item: ItemNavegacao; caminho: string; aoNavegar?: () => void }) {
  const apps = item.apps ?? [];
  const chave = `elo-menu-familia:${item.rotulo}`;
  const [escolha, setEscolha] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    try {
      const v = localStorage.getItem(chave);
      setEscolha(v ? v === 'aberto' : undefined);
    } catch {
      // Navegador sem armazenamento: a escolha vale só até recarregar.
    }
  }, [chave]);
  const appAtual = apps.find((a) => ativo(caminho, a.href));
  const aberto = appAtual ? true : (escolha ?? false);
  const Icone = ICONES[item.icone];
  const id = `familia-${item.rotulo.replace(/\W+/g, '-')}`;
  function alternar() {
    setEscolha(!aberto);
    try {
      localStorage.setItem(chave, !aberto ? 'aberto' : 'fechado');
    } catch {
      // Sem armazenamento, vale até recarregar.
    }
  }
  return (
    <li data-app={appAtual ? appDoCaminho(appAtual.href) : undefined}>
      <button
        type="button"
        onClick={alternar}
        aria-expanded={aberto}
        aria-controls={id}
        className={`relative flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-[0.95rem] transition-colors ${
          appAtual ? 'font-bold text-texto' : 'font-semibold text-texto-suave hover:bg-superficie-2 hover:text-texto'
        }`}
      >
        <span className={appAtual ? 'text-destaque' : ''}>
          <Icone />
        </span>
        <span>{item.rotulo}</span>
        {apps.some((a) => a.alerta) && <span className="size-2.5 rounded-full bg-aviso" aria-hidden="true" />}
        <IconeSeta tamanho={14} className={`ml-auto shrink-0 text-texto-suave transition-transform duration-200 ${aberto ? 'rotate-90' : ''}`} />
      </button>
      {aberto && (
        <ul id={id} className="mb-1 ml-[1.375rem] mt-0.5 space-y-0.5 border-l border-borda pl-2">
          {apps.map((a) => (
            <ItemDeApp key={a.href} item={a} caminho={caminho} aoNavegar={aoNavegar} recolhido={false} />
          ))}
        </ul>
      )}
    </li>
  );
}

function Navegacao({ grupos, aoNavegar, recolhido = false }: { grupos: GrupoNavegacao[]; aoNavegar?: () => void; recolhido?: boolean }) {
  const caminho = usePathname();
  return (
    <nav aria-label="Navegação principal" className={`flex-1 space-y-4 overflow-y-auto py-3 ${recolhido ? 'px-2' : 'px-3'}`}>
      {grupos.map((g, i) => (
        <div key={g.titulo ?? i}>
          {g.titulo && <p className={`mb-1.5 px-3 text-xs font-semibold tracking-wide text-texto-suave ${recolhido ? 'sr-only' : ''}`}>{g.titulo}</p>}
          <ul className="space-y-0.5">
            {g.itens.map((item) =>
              item.apps && !recolhido ? (
                <FamiliaDeApps key={item.rotulo} item={item} caminho={caminho} aoNavegar={aoNavegar} />
              ) : item.apps ? (
                // Menu recolhido (só ícones): a família é um ícone que leva à primeira tela do primeiro app.
                <ItemDeApp key={item.rotulo} item={{ ...item, apps: undefined, alerta: item.apps.find((a) => a.alerta)?.alerta }} marcado={item.apps.some((a) => ativo(caminho, a.href))} caminho={caminho} aoNavegar={aoNavegar} recolhido />
              ) : (
                <ItemDeApp key={item.href} item={item} caminho={caminho} aoNavegar={aoNavegar} recolhido={recolhido} />
              ),
            )}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Marca({ instituicao, soSimbolo = false }: { instituicao: string; soSimbolo?: boolean }) {
  return (
    <Link href="/" className="block rounded-md px-1.5 py-1" aria-label={`${NOME_PLATAFORMA}, ${instituicao}: início`}>
      <MarcaElo instituicao={instituicao} tom="tema" soSimbolo={soSimbolo} />
    </Link>
  );
}

export function Casca({
  grupos,
  usuario,
  sair,
  faixa,
  instituicao,
  comBusca = true,
  children,
}: {
  instituicao: string;
  grupos: GrupoNavegacao[];
  usuario: UsuarioCasca;
  sair: () => Promise<void>;
  faixa?: ReactNode;
  /** Campo da busca única na barra do topo (some enquanto a estrutura não está pronta). */
  comBusca?: boolean;
  children: ReactNode;
}) {
  const gaveta = useRef<HTMLDialogElement>(null);
  const caminho = usePathname();
  useEffect(() => {
    gaveta.current?.close();
    setBuscaAberta(false);
  }, [caminho]);
  const [recolhido, setRecolhido] = useState(false);
  const [buscaAberta, setBuscaAberta] = useState(false);
  useEffect(() => {
    try {
      setRecolhido(localStorage.getItem('elo-menu') === 'recolhido');
    } catch {
      // Navegador sem armazenamento: o menu começa aberto.
    }
  }, []);
  function alternarMenu() {
    const novo = !recolhido;
    setRecolhido(novo);
    try {
      localStorage.setItem('elo-menu', novo ? 'recolhido' : 'aberto');
    } catch {
      // Sem armazenamento, a escolha vale só até recarregar a página.
    }
  }

  return (
    <div data-app={appDoCaminho(caminho)} className={`min-h-screen transition-[padding] duration-200 print:!p-0 ${recolhido ? 'lg:pl-20' : 'lg:pl-72'}`}>
      <a href="#conteudo" className="sr-only z-50 rounded bg-primario px-4 py-2 font-semibold text-sobre-primario focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Pular para o conteúdo
      </a>

      {/* Computador: barra lateral fixa, que pode ser recolhida para mostrar só os ícones */}
      <aside className={`fixed inset-y-0 left-0 z-20 hidden flex-col print:!hidden border-r border-borda bg-superficie transition-[width] duration-200 lg:flex ${recolhido ? 'w-20' : 'w-72'}`}>
        <div className={`flex items-center pb-2 pt-5 ${recolhido ? 'flex-col gap-2 px-2' : 'justify-between gap-2 px-4'}`}>
          <Marca instituicao={instituicao} soSimbolo={recolhido} />
          <button
            type="button"
            onClick={alternarMenu}
            aria-label={recolhido ? 'Abrir o menu' : 'Recolher o menu'}
            aria-expanded={!recolhido}
            title={recolhido ? 'Abrir o menu' : 'Recolher o menu'}
            className="flex size-11 shrink-0 items-center justify-center rounded-md text-texto-suave hover:bg-superficie-2 hover:text-texto"
          >
            <IconeRecolher className={recolhido ? 'rotate-180' : ''} />
          </button>
        </div>
        <Navegacao grupos={grupos} recolhido={recolhido} />
        <MenuUsuario usuario={usuario} sair={sair} recolhido={recolhido} />
      </aside>

      {/* Celular: barra superior + menu */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-borda bg-superficie px-3 py-2 lg:hidden print:hidden">
        <Marca instituicao={instituicao} />
        <div className="flex items-center">
          {comBusca && (
            <button
              type="button"
              onClick={() => setBuscaAberta((a) => !a)}
              aria-label="Buscar no Elo"
              aria-expanded={buscaAberta}
              className="flex size-11 items-center justify-center rounded-md text-texto hover:bg-superficie-2"
            >
              <IconeBusca tamanho={22} />
            </button>
          )}
          <button
            type="button"
            onClick={() => gaveta.current?.showModal()}
            aria-label="Abrir menu"
            className="flex size-11 items-center justify-center rounded-md text-texto hover:bg-superficie-2"
          >
            <IconeMenu tamanho={24} />
          </button>
        </div>
      </div>
      {comBusca && buscaAberta && (
        <div className="border-b border-borda bg-superficie px-3 pb-3 lg:hidden print:hidden">
          <CampoDeBusca autoFoco />
        </div>
      )}
      <dialog
        ref={gaveta}
        aria-label="Menu"
        className="m-0 h-dvh max-h-dvh w-[min(20rem,88vw)] max-w-none bg-superficie p-0 text-texto backdrop:bg-black/50 backdrop:backdrop-blur-sm lg:hidden"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-3 pb-2 pt-4">
            <Marca instituicao={instituicao} />
            <button type="button" onClick={() => gaveta.current?.close()} aria-label="Fechar menu" className="flex size-11 items-center justify-center rounded-md text-texto hover:bg-superficie-2">
              <IconeFechar tamanho={22} />
            </button>
          </div>
          <Navegacao grupos={grupos} aoNavegar={() => gaveta.current?.close()} />
          <MenuUsuario usuario={usuario} sair={sair} />
        </div>
      </dialog>

      {faixa}
      {comBusca && (
        <div className="sticky top-0 z-10 hidden border-b border-borda bg-superficie/95 px-10 py-2 backdrop-blur lg:block print:hidden">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-md">
              <CampoDeBusca atalho />
            </div>
          </div>
        </div>
      )}
      <main id="conteudo" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8 print:max-w-none print:p-0">
        {children}
      </main>
    </div>
  );
}
