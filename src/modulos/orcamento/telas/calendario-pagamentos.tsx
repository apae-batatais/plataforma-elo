'use client';

/**
 * Calendário de pagamentos da instituição: em que meses saem o 13º, o abono e as férias coletivas.
 * Mostra a soma ao vivo; só salva quando 13º (e abono, se usado) somam 100%.
 */
import { useState } from 'react';
import { Aviso } from '@/ui/aviso';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import type { LinhaCalendario } from '../dominio/caixa';
import { MESES } from './formato';

const texto = (v: number) => (v ? String(v).replace('.', ',') : '');
const numero = (t: string) => (t.trim() === '' ? 0 : Number(t.replace(',', '.')));

export function CalendarioPagamentos({
  linhas, vigenciaInicial, podeEditar, acao,
}: {
  linhas: LinhaCalendario[];
  vigenciaInicial: string;
  podeEditar: boolean;
  acao: (f: FormData) => Promise<void>;
}) {
  const [valores, setValores] = useState(linhas.map((l) => ({ coletivas: l.ferias_coletivas, decimo: texto(l.decimo_pct), abono: texto(l.abono_pct) })));
  const soma = (k: 'decimo' | 'abono') => Math.round(valores.reduce((s, v) => s + numero(v[k]), 0) * 100) / 100;
  const d = soma('decimo');
  const a = soma('abono');
  const ok = d === 100 && (a === 100 || a === 0);
  const mudar = (i: number, parte: Partial<(typeof valores)[number]>) => setValores(valores.map((v, k) => (k === i ? { ...v, ...parte } : v)));

  return (
    <form action={acao} className="space-y-4">
      <fieldset disabled={!podeEditar} className="min-w-0 space-y-4">
        <legend className="sr-only">Calendário de pagamentos</legend>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] text-sm">
            <thead>
              <tr className="text-left text-texto-suave">
                <th scope="col" className="py-2 pr-4 font-semibold">Mês</th>
                <th scope="col" className="px-2 py-2 font-semibold">Férias coletivas</th>
                <th scope="col" className="px-2 py-2 font-semibold">% do 13º</th>
                <th scope="col" className="px-2 py-2 font-semibold">% do abono</th>
              </tr>
            </thead>
            <tbody>
              {MESES.map((nome, i) => (
                <tr key={nome} className="border-t border-borda">
                  <th scope="row" className="py-1.5 pr-4 text-left font-normal">{nome}</th>
                  <td className="px-2 py-1.5">
                    <label className="flex min-h-11 items-center gap-2">
                      <input type="checkbox" name={`coletivas${i + 1}`} checked={valores[i].coletivas} onChange={(e) => mudar(i, { coletivas: e.target.checked })} className="size-4 accent-[var(--destaque)]" />
                      <span className="sr-only">Férias coletivas em {nome}</span>
                    </label>
                  </td>
                  <td className="px-2 py-1.5">
                    <input name={`decimo${i + 1}`} aria-label={`Percentual do 13º em ${nome}`} inputMode="decimal" value={valores[i].decimo} onChange={(e) => mudar(i, { decimo: e.target.value })} className={`${estiloEntrada} w-24 text-right tabular-nums`} />
                  </td>
                  <td className="px-2 py-1.5">
                    <input name={`abono${i + 1}`} aria-label={`Percentual do abono em ${nome}`} inputMode="decimal" value={valores[i].abono} onChange={(e) => mudar(i, { abono: e.target.value })} className={`${estiloEntrada} w-24 text-right tabular-nums`} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-borda-forte font-semibold">
                <th scope="row" className="py-2 pr-4 text-left">Soma</th>
                <td />
                <td className="px-2 py-2 tabular-nums" aria-live="polite">{d.toLocaleString('pt-BR')}%</td>
                <td className="px-2 py-2 tabular-nums">{a.toLocaleString('pt-BR')}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-sm text-texto-suave">A soma de todos os meses deve ser 100%. No abono, deixe tudo em branco para pagar 1/12 em cada mês.</p>
        {!ok && podeEditar && <Aviso tipo="atencao">O 13º precisa somar 100% (hoje {d.toLocaleString('pt-BR')}%) e o abono, 100% ou nada.</Aviso>}
        {podeEditar && (
          <div className="flex flex-wrap items-end gap-4">
            <Campo rotulo="Vale a partir de" dica="Os meses anteriores não mudam.">
              <input name="vigencia" type="month" required defaultValue={vigenciaInicial} className={estiloEntrada} />
            </Campo>
            <BotaoEnviar enviando="Gravando…" disabled={!ok}>Salvar calendário</BotaoEnviar>
          </div>
        )}
      </fieldset>
    </form>
  );
}
