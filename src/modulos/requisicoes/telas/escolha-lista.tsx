'use client';

/**
 * Escolha de quais opções podem usar um tipo (áreas).
 * "Todas" marcado = sem restrição; desmarcado, a pessoa marca as permitidas.
 */
import { useState } from 'react';

export function EscolhaLista({
  legenda,
  nome,
  campoTodas,
  opcoes,
  marcados,
  rotuloTodas,
}: {
  legenda: string;
  nome: string;
  campoTodas: string;
  opcoes: { valor: string; rotulo: string }[];
  marcados: string[];
  rotuloTodas: string;
}) {
  const [todas, setTodas] = useState(marcados.length === 0);
  return (
    <fieldset className="min-w-0 text-sm">
      <legend className="font-semibold">{legenda}</legend>
      <label className="mt-2 flex items-center gap-2">
        <input type="checkbox" name={campoTodas} value="sim" checked={todas} onChange={(e) => setTodas(e.target.checked)} />
        {rotuloTodas}
      </label>
      {!todas && (
        <div className="mt-2 grid max-h-48 gap-1 overflow-y-auto rounded-md border border-borda p-2 sm:grid-cols-2">
          {opcoes.map((o) => (
            <label key={o.valor} className="flex items-center gap-2">
              <input type="checkbox" name={nome} value={o.valor} defaultChecked={marcados.includes(o.valor)} />
              <span className="truncate">{o.rotulo}</span>
            </label>
          ))}
          {opcoes.length === 0 && <span className="text-texto-suave">Nenhuma opção cadastrada.</span>}
        </div>
      )}
    </fieldset>
  );
}
