'use client';

/** Escolha do mês em lista ("setembro de 2026"). Muda a página ao escolher; o botão serve para quem está sem JavaScript. */
import { Botao } from '@/ui/botao';
import { Campo, estiloEntrada } from '@/ui/campo';

export function SeletorMes({ mes, opcoes }: { mes: string; opcoes: { valor: string; rotulo: string }[] }) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-2">
      <Campo rotulo="Mês">
        <select name="mes" defaultValue={mes} onChange={(e) => e.currentTarget.form?.requestSubmit()} className={`${estiloEntrada} !mt-1`}>
          {opcoes.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </select>
      </Campo>
      <Botao type="submit" variante="secundario">
        Ver mês
      </Botao>
    </form>
  );
}
