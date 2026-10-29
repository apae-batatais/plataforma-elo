/**
 * Estrutura comum das páginas: trilha (onde estou), título, descrição e as
 * ações principais sempre no mesmo lugar, à direita do título.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { IconeSeta } from './icones';

export interface Trilha {
  rotulo: string;
  href?: string;
}

export function CabecalhoPagina({
  trilha = [],
  titulo,
  descricao,
  acoes,
}: {
  trilha?: Trilha[];
  titulo: ReactNode;
  descricao?: ReactNode;
  acoes?: ReactNode;
}) {
  return (
    <header className="mb-6 space-y-3">
      {trilha.length > 0 && (
        <nav aria-label="Você está em">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-texto-suave">
            {trilha.map((t, i) => (
              <li key={t.rotulo} className="flex items-center gap-1">
                {i > 0 && <IconeSeta tamanho={14} />}
                {t.href ? (
                  <Link href={t.href} className="rounded hover:text-destaque hover:underline">
                    {t.rotulo}
                  </Link>
                ) : (
                  <span aria-current="page">{t.rotulo}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          <h1 className="text-[1.6rem] font-bold leading-tight tracking-tight text-texto">{titulo}</h1>
          {descricao && <div className="mt-1 text-[0.95rem] text-texto-suave">{descricao}</div>}
        </div>
        {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
      </div>
    </header>
  );
}

/** Bloco de conteúdo com título opcional. */
export function Secao({
  titulo,
  descricao,
  acoes,
  children,
  className = '',
  id,
}: {
  titulo?: ReactNode;
  descricao?: ReactNode;
  acoes?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section aria-labelledby={titulo && id ? id : undefined} className={`rounded-xl border border-borda bg-superficie ${className}`}>
      {(titulo || acoes) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-borda px-5 py-4">
          <div className="min-w-0">
            {titulo && (
              <h2 id={id} className="text-lg font-bold text-texto">
                {titulo}
              </h2>
            )}
            {descricao && <p className="mt-0.5 text-sm text-texto-suave">{descricao}</p>}
          </div>
          {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

/** Tela vazia: diz o que falta e oferece o próximo passo. */
export function EstadoVazio({ titulo, children, acao }: { titulo: ReactNode; children?: ReactNode; acao?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-borda-forte bg-superficie-2 px-6 py-10 text-center">
      <p className="text-lg font-semibold">{titulo}</p>
      {children && <div className="mx-auto mt-1 max-w-prose text-texto-suave">{children}</div>}
      {acao && <div className="mt-4 flex justify-center">{acao}</div>}
    </div>
  );
}

/** Etiqueta curta de situação. */
export function Etiqueta({ tipo = 'neutro', children }: { tipo?: 'neutro' | 'sucesso' | 'atencao' | 'erro' | 'info'; children: ReactNode }) {
  const cores = {
    neutro: 'bg-superficie-2 text-texto-suave border-borda',
    sucesso: 'bg-sucesso-fundo text-sucesso border-transparent',
    atencao: 'bg-aviso-fundo text-aviso border-transparent',
    erro: 'bg-erro-fundo text-erro border-transparent',
    info: 'bg-destaque-suave text-destaque border-transparent',
  }[tipo];
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cores}`}>{children}</span>;
}

/** Classes de tabela de dados, para manter todas iguais. */
export const tabela = {
  moldura: 'overflow-x-auto rounded-xl border border-borda bg-superficie',
  tabela: 'w-full border-collapse text-left text-sm',
  cabeca: 'border-b border-borda bg-superficie-2 text-texto-suave',
  th: 'px-4 py-3 text-[0.8rem] font-semibold',
  td: 'px-4 py-3 align-top',
  linha: 'border-b border-borda last:border-0 hover:bg-superficie-2',
  numero: 'text-right tabular-nums whitespace-nowrap',
};
