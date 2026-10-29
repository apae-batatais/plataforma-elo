'use client';

/**
 * Ações sem volta (desativar acesso, retirar perfil, registrar desligamento)
 * pedem confirmação numa janela que explica a consequência.
 */
import { useId, useRef, type ReactNode } from 'react';
import { Botao, type Variante } from './botao';
import { BotaoEnviar } from './botao-enviar';

export function FormularioConfirmado({
  acao,
  campos,
  rotulo,
  titulo,
  mensagem,
  confirmar,
  variante = 'perigo',
  pequeno,
  perigoso = true,
  rotuloAcessivel,
  children,
}: {
  acao: (f: FormData) => void | Promise<void>;
  campos?: Record<string, string | number>;
  rotulo: ReactNode;
  titulo: string;
  mensagem: ReactNode;
  confirmar: string;
  variante?: Variante;
  pequeno?: boolean;
  /** A confirmação é uma ação sem volta (botão vermelho)? */
  perigoso?: boolean;
  /** Nome do botão para leitores de tela, quando o rótulo é só um ícone. */
  rotuloAcessivel?: string;
  /** Campos visíveis do formulário (ex.: data), mostrados dentro da janela. */
  children?: ReactNode;
}) {
  const janela = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  return (
    <>
      <Botao
        variante={variante}
        className={pequeno && !variante.startsWith('icone') ? '!min-h-8 !px-3 !py-1 !text-sm' : ''}
        aria-label={rotuloAcessivel}
        title={rotuloAcessivel}
        onClick={() => janela.current?.showModal()}
      >
        {rotulo}
      </Botao>
      <dialog
        ref={janela}
        aria-labelledby={idTitulo}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] whitespace-normal rounded-xl border border-borda bg-superficie p-0 text-left font-normal text-texto shadow-2xl backdrop:bg-black/40"
      >
        <form action={acao} className="space-y-4 p-6">
          {Object.entries(campos ?? {}).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <h2 id={idTitulo} className="text-lg font-bold">
            {titulo}
          </h2>
          <div className="text-texto-suave">{mensagem}</div>
          {children}
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Botao variante="secundario" onClick={() => janela.current?.close()}>
              Cancelar
            </Botao>
            <BotaoEnviar variante={perigoso ? 'perigo' : 'primario'} enviando="Registrando…">
              {confirmar}
            </BotaoEnviar>
          </div>
        </form>
      </dialog>
    </>
  );
}
