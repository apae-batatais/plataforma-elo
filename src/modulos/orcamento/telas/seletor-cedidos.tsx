import Link from 'next/link';
import { reais } from './formato';

/**
 * Seletor "Incluir cedidos" (C2): ligado por padrão, vale só na tela (vai no endereço) e nunca é gravado.
 * Só aparece se há cedidos no ano. Mostra em texto o que cada escolha significa.
 */
export function SeletorCedidos({ temCedidos, incluir, total, href }: { temCedidos: boolean; incluir: boolean; total: number; href: (incluir: boolean) => string }) {
  if (!temCedidos) return null;
  const opcao = (valor: boolean, rotulo: string) => (
    <Link
      href={href(valor)}
      aria-current={incluir === valor ? 'true' : undefined}
      className={`rounded-md px-3 py-1 text-sm font-semibold ${incluir === valor ? 'bg-superficie text-texto shadow-[0_1px_2px_rgb(0_0_0/0.12)] ring-1 ring-borda' : 'text-texto-suave hover:text-texto'}`}
    >
      {rotulo}
    </Link>
  );
  return (
    <div className="flex flex-wrap items-center gap-3">
      <nav aria-label="Incluir cedidos" className="inline-flex items-center gap-1 rounded-lg border border-borda bg-superficie-2 p-0.5">
        <span className="px-2 text-sm text-texto-suave">Incluir cedidos</span>
        {opcao(true, 'Sim')}
        {opcao(false, 'Não')}
      </nav>
      <p className="text-sm text-texto-suave">
        {incluir
          ? `Inclui ${reais(total)} de profissionais cedidos (despesa e receita de mesmo valor, sem passar pelo caixa).`
          : 'Só o dinheiro que passa pelo caixa.'}
      </p>
    </div>
  );
}

/** Texto curto com o outro valor de um indicador: "sem cedidos: 58%". */
export const outroValor = (v: number | null | undefined, incluir: boolean, temCedidos: boolean) =>
  temCedidos && incluir && v !== null && v !== undefined ? ` Sem cedidos: ${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%.` : '';
