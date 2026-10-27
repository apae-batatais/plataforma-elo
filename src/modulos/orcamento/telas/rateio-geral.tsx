'use client';

import { useActionState, useMemo, useState } from 'react';
import { Aviso } from '@/ui/aviso';
import { Botao } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { estiloEntrada } from '@/ui/campo';
import type { GradeRateio } from '../aplicacao/folha';
import { somaRateio, validarRateio, type LinhaRateio } from '../dominio/folha';
import { percentual } from './formato';

type Acao = (estado: { erro?: string }, f: FormData) => Promise<{ erro?: string }>;

const celula = 'w-20 rounded-md border border-borda-forte bg-superficie px-2 py-1.5 text-right tabular-nums';

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
        <label className="text-sm font-semibold">
          Mostrar
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)} className={estiloEntrada}>
            <option value="">Todos os postos ({grade.postos.length})</option>
            <option value="pendentes">Sem rateio ou fora de 100%</option>
            <option value="alterados">Alterados agora ({alterados.length})</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          Acrescentar coluna
          <span className="mt-1.5 flex gap-2">
            <select value={novaColuna} onChange={(e) => setNovaColuna(e.target.value)} className={`${estiloEntrada} !mt-0`}>
              <option value="">Centro de custo…</option>
              {grade.centros
                .filter((c) => !colunas.includes(c.codigo))
                .map((c) => (
                  <option key={c.codigo} value={c.codigo}>
                    {c.area} › {c.nome}
                  </option>
                ))}
            </select>
            <Botao
              variante="secundario"
              disabled={!novaColuna}
              onClick={() => {
                setColunas([...colunas, novaColuna]);
                setNovaColuna('');
              }}
            >
              Acrescentar
            </Botao>
          </span>
        </label>
      </div>

      <div className="max-h-[65vh] overflow-auto rounded-xl border border-borda bg-superficie">
        <table className="text-left text-sm">
          <thead className="sticky top-0 z-10 bg-superficie-2 text-texto-suave shadow-[0_1px_0_var(--borda)]">
            <tr>
              <th scope="col" className="sticky left-0 z-20 min-w-56 bg-superficie-2 px-3 py-2 font-semibold">Posto</th>
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

      <div className="sticky bottom-0 z-20 -mx-4 flex flex-wrap items-end gap-4 border-t border-borda bg-superficie/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <label className="text-sm font-semibold">
          Os rateios alterados valem a partir de
          <input type="month" name="vigencia" value={vigencia} onChange={(e) => setVigencia(e.target.value)} required className={estiloEntrada} />
        </label>
        <BotaoEnviar pendente={enviando} disabled={alterados.length === 0 || comErro.length > 0} enviando="Salvando…">
          {alterados.length === 0 ? 'Salvar' : `Salvar ${alterados.length} ${alterados.length === 1 ? 'rateio' : 'rateios'}`}
        </BotaoEnviar>
        <p role="status" className={`pb-2 text-sm ${comErro.length ? 'font-semibold text-aviso' : 'text-texto-suave'}`}>
          {comErro.length
            ? `${comErro.length} ${comErro.length === 1 ? 'posto alterado não soma' : 'postos alterados não somam'} 100%. Ajuste antes de salvar.`
            : alterados.length
              ? 'Tudo certo para salvar.'
              : 'Altere os percentuais na grade; as linhas alteradas ficam destacadas.'}
        </p>
      </div>
      {estado.erro && (
        <Aviso tipo="erro" titulo="Não foi possível salvar">
          {estado.erro}
        </Aviso>
      )}
    </form>
  );
}
