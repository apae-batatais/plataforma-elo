'use client';

import { somaRateio, type LinhaRateio } from '../dominio/folha';
import { percentual, reais } from './formato';

const campo = 'w-full rounded-md border border-borda bg-superficie px-2 py-1.5 disabled:opacity-70';
const OPACIDADES = [1, 0.7, 0.5, 0.85, 0.6, 0.4];

/**
 * Grid de rateio de um posto: uma linha por centro de custo, com percentual e
 * os valores calculados. A barra mostra a fatia de cada centro e fica
 * completa (sem sobra nem excesso) só quando a soma é 100%.
 */
export function GridRateio({
  linhas,
  onChange,
  centros,
  custoMensal,
  somenteLeitura,
  onDividir,
}: {
  linhas: LinhaRateio[];
  onChange: (l: LinhaRateio[]) => void;
  centros: { codigo: string; nome: string; area: string }[];
  custoMensal: number;
  somenteLeitura?: boolean;
  onDividir: () => void;
}) {
  const soma = somaRateio(linhas);
  const diferenca = Math.round((100 - soma) * 100) / 100;
  const nome = new Map(centros.map((c) => [c.codigo, c.nome]));
  const areas = [...new Set(centros.map((c) => c.area))];
  const alterar = (i: number, mudanca: Partial<LinhaRateio>) => onChange(linhas.map((l, j) => (j === i ? { ...l, ...mudanca } : l)));

  return (
    <div className="mt-4 space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="text-texto-suave">
            <tr>
              <th scope="col" className="pb-2 pr-3 font-medium">Centro de custo</th>
              <th scope="col" className="w-28 pb-2 pr-3 font-medium">Percentual</th>
              <th scope="col" className="pb-2 pr-3 text-right font-medium">Valor mensal</th>
              <th scope="col" className="pb-2 pr-3 text-right font-medium">Valor anual</th>
              <th scope="col" className="w-10 pb-2"><span className="sr-only">Remover</span></th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 && (
              <tr>
                <td colSpan={5} className="py-3 text-texto-suave">Nenhum centro de custo. Adicione pelo menos um.</td>
              </tr>
            )}
            {linhas.map((l, i) => (
              <tr key={i} className="border-t border-borda">
                <td className="py-2 pr-3">
                  <select
                    aria-label={`Centro de custo da linha ${i + 1}`}
                    value={l.centro}
                    onChange={(e) => alterar(i, { centro: e.target.value })}
                    disabled={somenteLeitura}
                    className={campo}
                  >
                    <option value="">Escolha…</option>
                    {areas.map((a) => (
                      <optgroup key={a} label={a}>
                        {centros
                          .filter((c) => c.area === a)
                          .map((c) => (
                            <option key={c.codigo} value={c.codigo} disabled={c.codigo !== l.centro && linhas.some((x) => x.centro === c.codigo)}>
                              {c.nome}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-1">
                    <input
                      aria-label={`Percentual de ${nome.get(l.centro) ?? `linha ${i + 1}`}`}
                      type="number"
                      min="0.01"
                      max="100"
                      step="0.01"
                      value={Number.isFinite(l.percentual) && l.percentual !== 0 ? l.percentual : ''}
                      onChange={(e) => alterar(i, { percentual: e.target.value === '' ? 0 : Number(e.target.value) })}
                      disabled={somenteLeitura}
                      className={`${campo} text-right tabular-nums`}
                    />
                    <span aria-hidden="true">%</span>
                  </div>
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{reais((custoMensal * (l.percentual || 0)) / 100)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{reais((custoMensal * 12 * (l.percentual || 0)) / 100)}</td>
                <td className="py-2 text-right">
                  {!somenteLeitura && (
                    <button
                      type="button"
                      onClick={() => onChange(linhas.filter((_, j) => j !== i))}
                      aria-label={`Remover ${nome.get(l.centro) ?? `linha ${i + 1}`}`}
                      className="rounded px-2 py-1 text-texto-suave hover:bg-aviso-fundo hover:text-aviso"
                    >
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-borda font-semibold">
              <th scope="row" className="py-2 pr-3">Total</th>
              <td className={`py-2 pr-3 text-right tabular-nums ${diferenca === 0 ? '' : 'text-aviso'}`}>{percentual(soma)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{reais((custoMensal * soma) / 100)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{reais((custoMensal * 12 * soma) / 100)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div>
        <div
          role="img"
          aria-label={`Rateio somando ${percentual(soma)}`}
          className="relative flex h-3 overflow-hidden rounded-full bg-borda"
        >
          {linhas.map((l, i) => (
            <div
              key={i}
              title={`${nome.get(l.centro) ?? 'Sem centro'}: ${percentual(l.percentual || 0)}`}
              className={soma > 100 ? 'bg-aviso' : 'bg-destaque'}
              style={{ width: `${(Math.min(l.percentual || 0, 100) / Math.max(soma, 100)) * 100}%`, opacity: OPACIDADES[i % OPACIDADES.length] }}
            />
          ))}
        </div>
        <p role="status" className={`mt-2 text-sm ${diferenca === 0 ? 'text-texto' : 'text-aviso'}`}>
          {linhas.length === 0
            ? 'Adicione os centros de custo deste posto.'
            : diferenca === 0
              ? '100% distribuído.'
              : diferenca > 0
                ? `Faltam ${percentual(diferenca)} para fechar 100%.`
                : `Passou ${percentual(-diferenca)} de 100%. Reduza algum percentual.`}
        </p>
      </div>

      {!somenteLeitura && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onChange([...linhas, { centro: '', percentual: diferenca > 0 ? diferenca : 0 }])}
            className="rounded-md border border-borda px-3 py-1.5 text-sm hover:bg-destaque-suave"
          >
            Adicionar centro de custo
          </button>
          <button
            type="button"
            onClick={onDividir}
            disabled={linhas.filter((l) => l.centro).length === 0}
            className="rounded-md border border-borda px-3 py-1.5 text-sm hover:bg-destaque-suave disabled:opacity-50"
          >
            Dividir igualmente
          </button>
        </div>
      )}
    </div>
  );
}
