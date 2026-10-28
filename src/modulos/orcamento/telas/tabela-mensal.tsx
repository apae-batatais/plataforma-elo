'use client';

/**
 * Tabela mês a mês em árvore: Receita › fonte › item e Despesa › grupo › item.
 * Cada linha com filhos abre e fecha; o resultado fica sempre visível no fim.
 */
import { Fragment, useState } from 'react';
import type { NoArvore } from '../aplicacao/previsao';
import { MESES, reais } from './formato';

const inteiro = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });

function todosOsIds(n: NoArvore): string[] {
  return n.filhos?.length ? [n.id, ...n.filhos.flatMap(todosOsIds)] : [];
}

const ESTILO_NIVEL = [
  'bg-superficie font-bold',
  'bg-superficie-2/60 font-semibold',
  'bg-superficie font-normal text-texto',
];

export function TabelaMensal({ ano, receita, despesa, resultado }: { ano: number; receita: NoArvore; despesa: NoArvore; resultado: { mensal: number[]; anual: number } }) {
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const todos = [...todosOsIds(receita), ...todosOsIds(despesa)];
  const alternar = (id: string) => {
    const s = new Set(abertos);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setAbertos(s);
  };

  const linhas = (n: NoArvore, nivel: number): React.ReactNode => {
    const temFilhos = Boolean(n.filhos?.length);
    const aberto = abertos.has(n.id);
    return (
      <Fragment key={n.id}>
        <tr className={`border-b border-borda ${ESTILO_NIVEL[Math.min(nivel, 2)]}`}>
          <th scope="row" className="sticky left-0 z-[1] min-w-56 max-w-72 bg-inherit py-2 pr-3 text-left" style={{ paddingLeft: `${0.75 + nivel * 1.25}rem` }}>
            <span className="flex items-start gap-1.5">
              {temFilhos ? (
                <button
                  type="button"
                  onClick={() => alternar(n.id)}
                  aria-expanded={aberto}
                  aria-label={`${aberto ? 'Fechar' : 'Abrir'} ${n.nome}`}
                  className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border border-borda-forte bg-superficie text-xs leading-none hover:bg-destaque-suave"
                >
                  <span aria-hidden="true" className={`transition-transform ${aberto ? 'rotate-90' : ''}`}>
                    ▸
                  </span>
                </button>
              ) : (
                <span className="size-5 shrink-0" aria-hidden="true" />
              )}
              <span className="min-w-0">
                <span className="block">{n.nome}</span>
                {n.detalhe && <span className="block text-xs font-normal text-texto-suave">{n.detalhe}</span>}
              </span>
            </span>
          </th>
          {n.mensal.map((v, k) => (
            <td key={k} className="whitespace-nowrap px-2.5 py-2 text-right tabular-nums">
              {v ? inteiro(v) : <span className="text-texto-suave">–</span>}
            </td>
          ))}
          <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">{reais(n.anual)}</td>
        </tr>
        {temFilhos && aberto && n.filhos!.map((f) => linhas(f, nivel + 1))}
      </Fragment>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-texto-suave">Clique em ▸ para abrir: Receita por fonte e item; Despesa por grupo de gasto e item.</p>
        <div className="flex gap-2 text-sm">
          <button type="button" onClick={() => setAbertos(new Set([receita.id, despesa.id]))} className="rounded-md border border-borda-forte px-3 py-1 font-semibold hover:bg-superficie-2">
            Abrir grupos
          </button>
          <button type="button" onClick={() => setAbertos(new Set(todos))} className="rounded-md border border-borda-forte px-3 py-1 font-semibold hover:bg-superficie-2">
            Abrir tudo
          </button>
          <button type="button" onClick={() => setAbertos(new Set())} className="rounded-md border border-borda-forte px-3 py-1 font-semibold hover:bg-superficie-2">
            Fechar tudo
          </button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-borda bg-superficie">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">Receita, despesa e resultado por mês em {ano}, com abertura por fonte, grupo e item</caption>
          <thead className="border-b border-borda bg-superficie-2 text-texto-suave">
            <tr>
              <th scope="col" className="sticky left-0 z-[1] bg-superficie-2 px-3 py-2.5 text-[0.8rem] font-semibold">
                <span className="sr-only">Linha</span>
              </th>
              {MESES.map((m) => (
                <th key={m} scope="col" className="px-2.5 py-2.5 text-right text-[0.8rem] font-semibold">
                  {m.slice(0, 3)}
                </th>
              ))}
              <th scope="col" className="px-4 py-2.5 text-right text-[0.8rem] font-semibold">
                Ano
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas(receita, 0)}
            {linhas(despesa, 0)}
          </tbody>
          <tfoot className="border-t-2 border-borda-forte">
            <tr className="bg-superficie font-bold">
              <th scope="row" className="sticky left-0 z-[1] bg-superficie py-2.5 pl-3 pr-3 text-left">
                <span className="flex items-center gap-1.5">
                  <span className="size-5" aria-hidden="true" />
                  Resultado
                </span>
              </th>
              {resultado.mensal.map((v, k) => (
                <td key={k} className={`whitespace-nowrap px-2.5 py-2.5 text-right tabular-nums ${v < 0 ? 'text-erro' : ''}`}>
                  {inteiro(v)}
                </td>
              ))}
              <td className={`whitespace-nowrap px-4 py-2.5 text-right tabular-nums ${resultado.anual < 0 ? 'text-erro' : ''}`}>{reais(resultado.anual)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-texto-suave">Valores mensais em reais, sem centavos. Resultado negativo em vermelho. A folha de pagamento abre por serviço.</p>
    </div>
  );
}
