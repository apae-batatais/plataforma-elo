'use client';

/** Ficha do chamado de TI. */
import { useEffect, useState } from 'react';
import { Campo, estiloEntrada } from '@/ui/campo';
import {
  CATEGORIAS_TI,
  URGENCIAS,
  type CategoriaTi,
  type DetalhesTi,
  type Urgencia,
} from '../dominio/requisicao';
import type { PropsFicha } from './ficha';

export function FichaTi({ inicial, aoMudar }: PropsFicha) {
  const detTi = (inicial?.detalhes ?? {}) as Partial<DetalhesTi>;
  const [ti, setTi] = useState({
    categoria: detTi.categoria ?? '',
    equipamento: detTi.equipamento ?? '',
    patrimonio: detTi.patrimonio ?? '',
    local: detTi.local ?? '',
    problema: detTi.problema ?? '',
    urgencia: detTi.urgencia ?? '',
    contato: detTi.contato ?? '',
  });

  useEffect(() => {
    aoMudar({ itens: [], detalhes: { ...ti, categoria: ti.categoria || undefined, urgencia: ti.urgencia || undefined } });
  }, [ti, aoMudar]);

  return (
    <section className="space-y-4 rounded-cartao border border-borda bg-superficie p-5">
      <h2 className="text-lg font-bold">Chamado de TI</h2>
      <fieldset className="min-w-0 text-sm">
        <legend className="font-semibold">
          Do que é o chamado <span className="text-erro">*</span>
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {Object.entries(CATEGORIAS_TI).map(([v, r]) => (
            <label
              key={v}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 ${ti.categoria === v ? 'border-destaque bg-destaque-suave' : 'border-borda'}`}
            >
              <input type="radio" name="categoria-ti" checked={ti.categoria === v} onChange={() => setTi({ ...ti, categoria: v as CategoriaTi })} />
              {r}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo rotulo="Equipamento ou sistema" dica="Ex.: notebook da recepção, sistema da secretaria." className="sm:col-span-2">
          <input value={ti.equipamento} onChange={(e) => setTi({ ...ti, equipamento: e.target.value })} className={estiloEntrada} />
        </Campo>
        <Campo rotulo="Nº de patrimônio" dica="A etiqueta do equipamento, se houver.">
          <input value={ti.patrimonio} onChange={(e) => setTi({ ...ti, patrimonio: e.target.value })} className={estiloEntrada} />
        </Campo>
        <Campo rotulo="Onde está" obrigatorio dica="Sala, setor ou unidade." className="sm:col-span-2">
          <input value={ti.local} onChange={(e) => setTi({ ...ti, local: e.target.value })} className={estiloEntrada} />
        </Campo>
        <Campo rotulo="Contato" dica="Ramal ou telefone para o técnico falar com você.">
          <input value={ti.contato} onChange={(e) => setTi({ ...ti, contato: e.target.value })} className={estiloEntrada} />
        </Campo>
      </div>
      <Campo rotulo="O que está acontecendo" obrigatorio dica="Desde quando, o que aparece na tela, o que já foi tentado.">
        <textarea value={ti.problema} onChange={(e) => setTi({ ...ti, problema: e.target.value })} rows={4} className={estiloEntrada} />
      </Campo>
      <fieldset className="min-w-0 text-sm">
        <legend className="font-semibold">
          Urgência <span className="text-erro">*</span>
        </legend>
        <div className="mt-2 space-y-1.5">
          {Object.entries(URGENCIAS).map(([v, r]) => (
            <label key={v} className="flex items-center gap-2">
              <input type="radio" name="urgencia-ti" checked={ti.urgencia === v} onChange={() => setTi({ ...ti, urgencia: v as Urgencia })} />
              {r}
            </label>
          ))}
        </div>
      </fieldset>
    </section>
  );
}
