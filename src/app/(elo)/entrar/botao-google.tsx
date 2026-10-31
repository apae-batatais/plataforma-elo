'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Aviso } from '@/ui/aviso';
import { entrarComGoogle } from '../acoes-sessao';

interface GoogleId {
  accounts: {
    id: {
      initialize(opcoes: { client_id: string; hd?: string; callback: (r: { credential: string }) => void }): void;
      renderButton(el: HTMLElement, opcoes: Record<string, unknown>): void;
    };
  };
}

/** Botão "Fazer login com o Google", restrito ao domínio institucional. */
export function BotaoGoogle({
  clientId,
  dominio,
  acao = entrarComGoogle,
  destino = '/',
}: {
  clientId: string;
  dominio: string;
  /** Confere o login no servidor (padrão: entrada na instituição; a Rede usa a própria). */
  acao?: (credencial: string) => Promise<{ erro?: string }>;
  destino?: string;
}) {
  const lugar = useRef<HTMLDivElement>(null);
  const [erro, setErro] = useState<string>();
  const router = useRouter();

  useEffect(() => {
    const iniciar = () => {
      const google = (window as unknown as { google?: GoogleId }).google;
      if (!google || !lugar.current) return;
      google.accounts.id.initialize({
        client_id: clientId,
        hd: dominio,
        callback: async ({ credential }) => {
          setErro(undefined);
          try {
            const r = await acao(credential);
            if (r.erro) setErro(r.erro);
            else {
              router.push(destino);
              router.refresh();
            }
          } catch {
            setErro('Não foi possível entrar agora. Tente de novo em alguns instantes; se continuar, avise a administração da plataforma.');
          }
        },
      });
      google.accounts.id.renderButton(lugar.current, { theme: 'outline', size: 'large', text: 'signin_with', locale: 'pt-BR' });
    };
    const existente = document.querySelector<HTMLScriptElement>('script[data-google-gsi]');
    if (existente) {
      iniciar();
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.dataset.googleGsi = '1';
    s.onload = iniciar;
    document.head.appendChild(s);
  }, [clientId, dominio, router, acao, destino]);

  return (
    <div className="space-y-3">
      <div ref={lugar} />
      {erro && (
        <Aviso tipo="erro" titulo="Não foi possível entrar">
          {erro}
        </Aviso>
      )}
    </div>
  );
}
