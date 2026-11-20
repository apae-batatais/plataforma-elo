'use client';

import Link from 'next/link';
import { Botao, estiloBotao, pequeno } from '@/ui/botao';

/** Barra acima da ficha (não sai no papel): voltar e imprimir. */
export function BarraImpressao({ voltar, rotuloVoltar = 'Voltar' }: { voltar: string; rotuloVoltar?: string }) {
  return (
    <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center gap-3 print:hidden">
      <Link href={voltar} className={estiloBotao('secundario', pequeno)}>
        {rotuloVoltar}
      </Link>
      <Botao type="button" className={pequeno} onClick={() => window.print()}>
        Imprimir ou salvar em PDF
      </Botao>
      <p className="text-sm text-texto-suave">Na janela de impressão, escolha a impressora ou “Salvar como PDF”.</p>
    </div>
  );
}
