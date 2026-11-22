'use client';

import Link from 'next/link';
import { Botao, estiloBotao } from '@/ui/botao';

/** Barra acima do manual (não sai no papel): salvar em PDF pela impressão do navegador e voltar à Ajuda. */
export function BarraManual() {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 print:hidden">
      <Botao type="button" autoFocus className="max-sm:w-full" onClick={() => window.print()}>
        Salvar como PDF
      </Botao>
      <Link href="/ajuda" className={estiloBotao('secundario')}>
        Voltar à Ajuda
      </Link>
      <p className="text-sm text-texto-suave">Na janela que abrir, escolha “Salvar como PDF” em Destino.</p>
    </div>
  );
}
