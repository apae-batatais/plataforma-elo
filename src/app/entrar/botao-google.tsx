'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
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
export function BotaoGoogle({ clientId, dominio }: { clientId: string; dominio: string }) {
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
          const r = await entrarComGoogle(credential);
          if (r.erro) setErro(r.erro);
          else router.push('/');
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
  }, [clientId, dominio, router]);

  return (
    <div className="space-y-3">
      <div ref={lugar} />
      {erro && (
        <p role="alert" className="rounded-md bg-aviso-fundo p-3 text-sm text-aviso">
          {erro}
        </p>
      )}
    </div>
  );
}
