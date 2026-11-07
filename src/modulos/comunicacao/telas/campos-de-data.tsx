'use client';

/** Como a data cai (exata ou período) e as datas: o fim só aparece quando é período. */
import { useState } from 'react';
import { Campo, estiloEntrada } from '@/ui/campo';

export function CamposDeData({ tipoData, inicio, fim }: { tipoData: 'exata' | 'periodo'; inicio?: string; fim?: string }) {
  const [tipo, setTipo] = useState(tipoData);
  return (
    <>
      <fieldset>
        <legend className="text-sm font-semibold">Como a data cai</legend>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
          {(
            [
              ['exata', 'Data exata', 'Um dia só.'],
              ['periodo', 'Período', 'Do início ao fim.'],
            ] as const
          ).map(([v, r, d]) => (
            <label key={v} className="flex min-h-11 items-start gap-2 rounded-lg border border-borda px-3 py-2.5 text-sm">
              <input type="radio" name="tipo_data" value={v} checked={tipo === v} onChange={() => setTipo(v)} className="mt-0.5" />
              <span>
                <span className="font-semibold">{r}</span>
                <span className="block text-texto-suave">{d}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo={tipo === 'periodo' ? 'Início do período' : 'Data'} obrigatorio>
          <input type="date" name="inicio" required defaultValue={inicio} className={estiloEntrada} />
        </Campo>
        {tipo === 'periodo' && (
          <Campo rotulo="Fim do período" obrigatorio>
            <input type="date" name="fim" required defaultValue={fim} className={estiloEntrada} />
          </Campo>
        )}
      </div>
    </>
  );
}
