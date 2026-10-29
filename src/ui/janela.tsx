'use client';

/**
 * Janela (modal) com um formulário dentro: o botão abre, o "×" ou Esc fecha.
 * Depois de salvar, a página recarrega e a janela fecha sozinha.
 * Com rotulo={null} não há botão: use abrirAoCarregar (ex.: editar pelo endereço ?editar=).
 */
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Botao, type Variante } from './botao';
import { IconeFechar } from './icones';

export function JanelaFormulario({
  rotulo,
  titulo,
  descricao,
  children,
  variante = 'primario',
  rotuloAcessivel,
  className = '',
  abrirAoCarregar = false,
  larga = false,
  voltarPara,
}: {
  rotulo: ReactNode;
  titulo: ReactNode;
  descricao?: ReactNode;
  children: ReactNode;
  variante?: Variante;
  /** Nome do botão para leitores de tela, quando o rótulo é só um ícone. */
  rotuloAcessivel?: string;
  className?: string;
  /** Abre já ao carregar (ex.: ao voltar para editar um item com erro). */
  abrirAoCarregar?: boolean;
  larga?: boolean;
  /** Ao fechar, volta para este endereço (ex.: tira o "?editar=" da página). */
  voltarPara?: string;
}) {
  const router = useRouter();
  const janela = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  useEffect(() => {
    if (abrirAoCarregar && janela.current && !janela.current.open) janela.current.showModal();
  }, [abrirAoCarregar]);

  return (
    <>
      {rotulo !== null && (
        <Botao variante={variante} className={className} aria-label={rotuloAcessivel} title={rotuloAcessivel} onClick={() => janela.current?.showModal()}>
          {rotulo}
        </Botao>
      )}
      <dialog
        ref={janela}
        onClose={() => voltarPara && router.replace(voltarPara, { scroll: false })}
        aria-labelledby={idTitulo}
        className={`m-auto max-h-[calc(100dvh-2rem)] ${larga ? 'w-[min(44rem,calc(100vw-2rem))]' : 'w-[min(30rem,calc(100vw-2rem))]'} whitespace-normal rounded-xl border border-borda bg-superficie p-0 text-left font-normal text-texto shadow-2xl backdrop:bg-black/40`}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-borda bg-superficie px-5 py-4">
          <div className="min-w-0">
            <h2 id={idTitulo} className="text-lg font-bold">
              {titulo}
            </h2>
            {descricao && <p className="mt-0.5 text-sm text-texto-suave">{descricao}</p>}
          </div>
          <button type="button" onClick={() => janela.current?.close()} aria-label="Fechar" className="rounded-md p-1.5 text-texto-suave hover:bg-superficie-2 hover:text-texto">
            <IconeFechar tamanho={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </dialog>
    </>
  );
}
