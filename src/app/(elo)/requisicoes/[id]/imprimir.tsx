'use client';

import { Botao, pequeno } from '@/ui/botao';

/** Imprimir ou salvar a ficha em PDF (pelo próprio navegador). */
export function BotaoImprimir() {
  return (
    <Botao type="button" variante="secundario" className={`${pequeno} print:hidden`} onClick={() => window.print()}>
      Imprimir
    </Botao>
  );
}
