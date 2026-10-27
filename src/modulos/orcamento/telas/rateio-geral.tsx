'use client';

import { useActionState, useMemo, useState } from 'react';
import type { GradeRateio } from '../aplicacao/folha';
import { somaRateio, validarRateio, type LinhaRateio } from '../dominio/folha';
import { percentual } from './formato';

type Acao = (estado: { erro?: string }, f: FormData) => Promise<{ erro?: string }>;

const celula = 'w-20 rounded border border-borda bg-superficie px-1.5 py-1 text-right tabular-nums';

/** Grade postos × centros de custo para revisar e corrigir vários rateios de uma vez. */
export function RateioGeral({ grade, acao, soPendentes }: { grade: GradeRateio; acao: Acao; soPendentes: boolean }) {
  const [estado, enviar, enviando] = useActionState(acao, {});
  const original = useMemo(() => new Map(grade.postos.map((p) => [p.id, p.rateio])), [grade]);
  const [rateios, setRateios] = useState<Map<string, LinhaRateio[]>>(() => new Map(original));
  const usados = useMemo(() => {
    const s = new Set<string>();
    grade.postos.forEach((p) => p.rateio.forEach((l) => s.add(l.centro)));
    return s;
  }, [grade]);
  const [colunas, setColunas] = useState<string[]>(() => grade.centros.filter((c) => usados.has(c.codigo)).map((c) => c.codigo));
  const [novaColuna, setNovaColuna] = useState('');
  const [filtro, setFiltro] = useState(soPendentes ? 'pendentes' : '');
  const [vigencia, setVigencia] = useState(`${grade.ano}-01`);

  const nome = new Map(grade.centros.map((c) => [c.codigo, c.nome]));
  const valor = (posto: string, centro: string) => rateios.get(posto)?.find((l) => l.centro === centro)?.percentual ?? 0;
  const alterar = (posto: string, centro: string, v: number) => {
    const atual = (rateios.get(posto) ?? []).filter((l) => l.centro !== centro);
    const novo = v > 0 ? [...atual, { centro, percentual: v }] : atual;
    setRateios(new Map(rateios).set(posto, novo));
  };
  const mudou = (posto: string) => {
    const a = [...(original.get(posto) ?? [])].sort((x, y) => x.centro.localeCompare(y.centro));
    const b = [...(rateios.get(posto) ?? [])].sort((x, y) => x.centro.localeCompare(y.centro));
    return JSON.stringify(a) !== JSON.stringify(b);
  };
  const alterados = grade.postos.filter((p) => mudou(p.id));
  const comErro = alterados.filter((p) => validarRateio(rateios.get(p.id) ?? []).length > 0);
  const visiveis = grade.postos.filter((p) => {
    if (filtro === 'pendentes') return validarRateio(original.get(p.id) ?? []).length > 0 || mudou(p.id);
    if (filtro === 'alterados') return mudou(p.id);
    return true;
  });

  const dados = JSON.stringify(alterados.map((p) => ({ postoId: p.id, rateio: rateios.get(p.id) ?? [] })));

  return (
    <form action={enviar} className="space-y-4">
      <input type="hidden" name="dados" value={dados} />
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          Mostrar
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)} className="mt-1 block rounded-md border border-borda bg-superficie px-3 py-2">
            <option value="">Todos os postos ({grade.postos.length})</option>
            <option value="pendentes">Sem rateio ou fora de 100%</option>
            <option value="alterados">Alterados agora ({alterados.length})</option>
          </select>
        </label>
        <label className="text-sm">
          Acrescentar coluna
          <span className="mt-1 flex gap-2">
            <select value={novaColuna} onChange={(e) => setNovaColuna(e.target.value)} className="rounded-md border border-borda bg-superficie px-3 py-2">
              <option value="">Centro de custo…</option>
              {grade.centros
                .filter((c) => !colunas.includes(c.codigo))
                .map((c) => (
                  <option key={c.codigo} value={c.codigo}>
                    {c.area} › {c.nome}
                  </option>
                ))}
            </select>
            <button
              type="button"
              disabled={!novaColuna}
              onClick={() => {
                setColunas([...colunas, novaColuna]);
                setNovaColuna('');
              }}
              className="rounded-md border border-borda px-3 py-2 text-sm hover:bg-destaque-suave disabled:opacity-50"
            >
              Acrescentar
            </button>
          </span>
        </label>
      </div>

      <div className="max-h-[70vh] overflow-auto rounded-lg border border-borda bg-superficie">
        <table className="text-left text-sm">
          <thead className="sticky top-0 z-10 bg-superficie text-texto-suave shadow-[0_1px_0_var(--borda)]">
            <tr>
              <th scope="col" className="sticky left-0 z-20 min-w-56 bg-superficie px-3 py-2 font-medium">Posto</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Soma</th>
              {colunas.map((c) => (
                <th key={c} scope="col" className="max-w-32 px-2 py-2 align-bottom text-xs font-medium">
                  {nome.get(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visiveis.length === 0 && (
              <tr>
                <td colSpan={colunas.length + 2} className="px-3 py-4">
                  Nenhum posto pendente. Todos os rateios somam 100%.
                </td>
              </tr>
            )}
            {visiveis.map((p) => {
              const soma = somaRateio(rateios.get(p.id) ?? []);
              const ok = soma === 100;
              return (
                <tr key={p.id} className={`border-t border-borda ${mudou(p.id) ? 'bg-destaque-suave' : ''}`}>
                  <th scope="row" className="sticky left-0 bg-inherit px-3 py-1.5 font-normal">
                    <span className="block font-medium">{p.rotulo}</span>
                    <span className="block text-xs text-texto-suave">{p.cargo}</span>
                  </th>
                  <td className={`px-3 py-1.5 text-right font-semibold tabular-nums ${ok ? '' : 'text-aviso'}`}>{percentual(soma)}</td>
                  {colunas.map((c) => (
                    <td key={c} className="px-2 py-1.5">
                      <input
                        aria-label={`${p.rotulo}: percentual em ${nome.get(c)}`}
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={valor(p.id, c) || ''}
                        onChange={(e) => alterar(p.id, c, e.target.value === '' ? 0 : Number(e.target.value))}
                        className={celula}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="text-sm">
          Os rateios alterados valem a partir de
          <input
            type="month"
            name="vigencia"
            value={vigencia}
            onChange={(e) => setVigencia(e.target.value)}
            required
            className="mt-1 block rounded-md border border-borda bg-superficie px-3 py-2"
          />
        </label>
        <button
          disabled={alterados.length === 0 || comErro.length > 0 || enviando}
          className="rounded-md bg-destaque px-5 py-2 font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando ? 'Salvando…' : `Salvar ${alterados.length} ${alterados.length === 1 ? 'rateio' : 'rateios'}`}
        </button>
        <p role="status" className={`text-sm ${comErro.length ? 'text-aviso' : 'text-texto-suave'}`}>
          {comErro.length
            ? `${comErro.length} ${comErro.length === 1 ? 'posto alterado não soma' : 'postos alterados não somam'} 100%. Ajuste antes de salvar.`
            : alterados.length
              ? 'Tudo certo para salvar.'
              : 'Altere os percentuais na grade.'}
        </p>
      </div>
      {estado.erro && (
        <p role="alert" className="rounded-md bg-aviso-fundo p-3 text-sm text-aviso">
          {estado.erro}
        </p>
      )}
    </form>
  );
}
