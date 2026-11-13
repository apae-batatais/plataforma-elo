'use client';

/**
 * Confirmação de ação ("Posto salvo.") que aparece no topo e some sozinha.
 * Lê ?ok= do endereço e limpa o endereço, para não reaparecer ao recarregar.
 * Erros (?erro=) ficam na página até a pessoa agir: não somem sozinhos.
 */
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Aviso } from './aviso';
import { IconeCerto, IconeFechar } from './icones';
import { MARCA_DE_GRAVACAO } from './pisca-regras';

export function Notificacao() {
  const params = useSearchParams();
  const router = useRouter();
  const caminho = usePathname();
  const ok = params.get('ok');
  const erro = params.get('erro');
  const [visivel, setVisivel] = useState<string | null>(null);

  useEffect(() => {
    if (!ok) return;
    setVisivel(ok);
    // Avisa o "pisca onde mudou" (que pode ler depois que o endereço for limpo) de que acabou de gravar.
    try {
      sessionStorage.setItem(MARCA_DE_GRAVACAO, String(Date.now()));
    } catch {
      // sem armazenamento da sessão: não pisca
    }
    const resto = new URLSearchParams(params);
    resto.delete('ok');
    router.replace(resto.size ? `${caminho}?${resto}` : caminho, { scroll: false });
    const t = setTimeout(() => setVisivel(null), 6000);
    return () => clearTimeout(t);
  }, [ok, params, caminho, router]);

  return (
    <>
      {erro && (
        <div className="mb-5">
          <Aviso tipo="erro" titulo="Não foi possível concluir">
            {erro}
          </Aviso>
        </div>
      )}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4 print:hidden">
        {visivel && (
          <div
            role="status"
            className="pointer-events-auto flex max-w-lg items-center gap-3 rounded-lg border border-sucesso/30 bg-superficie px-4 py-3 text-sm font-semibold text-texto shadow-lg shadow-black/10 [animation:entrar-de-cima_.2s_ease-out]"
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-sucesso-fundo text-sucesso">
              <IconeCerto tamanho={16} />
            </span>
            {visivel}
            <button type="button" onClick={() => setVisivel(null)} aria-label="Fechar aviso" className="ml-2 rounded p-1 text-texto-suave hover:bg-superficie-2">
              <IconeFechar tamanho={16} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
