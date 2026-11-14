'use client';

/**
 * Grade de dados com filtro e classificação em cada coluna.
 *
 * - Clique no título da coluna para classificar (crescente → decrescente → sem ordem).
 * - A linha de filtros fica logo abaixo dos títulos. Texto: "contém", sem
 *   diferença de acento ou maiúscula. Números: aceita ">1000", "<500", "=12"
 *   ou um trecho do número.
 * - Colunas marcadas com `somar` mostram o total das linhas filtradas no rodapé.
 * As células podem trazer conteúdo pronto (etiquetas, botões); o filtro e a
 * ordem usam o `valor` simples de cada coluna.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PiscaOndeMudou } from './pisca-onde-mudou';
import { temMaisColunasADireita } from './rolagem';

export type Valor = string | number | null;

export interface ColunaDados {
  chave: string;
  rotulo: string;
  tipo?: 'texto' | 'numero' | 'moeda';
  /** Soma no rodapé (só números). */
  somar?: boolean;
  /** Sem filtro nem classificação (ex.: ações). */
  fixa?: boolean;
  largura?: string;
  /** Coluna calculada pelo app: fundo levemente destacado. */
  calculada?: boolean;
  /** Começa escondida; a pessoa mostra pelo botão "Colunas". */
  secundaria?: boolean;
}

export interface LinhaDados {
  id: string;
  valores: Record<string, Valor>;
  /** Conteúdo pronto de células (no lugar do valor simples). */
  celulas?: Record<string, ReactNode>;
  destaque?: boolean;
}

const normal = (t: unknown) =>
  String(t ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatar = (v: Valor, tipo: ColunaDados['tipo']) =>
  v === null || v === '' ? '—' : typeof v === 'number' ? (tipo === 'moeda' ? reais(v) : v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })) : v;

function passaFiltro(v: Valor, filtro: string, tipo: ColunaDados['tipo']): boolean {
  const f = filtro.trim();
  if (!f) return true;
  if ((tipo === 'numero' || tipo === 'moeda') && /^[<>=]/.test(f)) {
    const n = Number(f.slice(1).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''));
    if (!Number.isFinite(n) || typeof v !== 'number') return false;
    return f[0] === '>' ? v > n : f[0] === '<' ? v < n : v === n;
  }
  return normal(formatar(v, tipo)).includes(normal(f)) || normal(v).includes(normal(f));
}

export function TabelaDados({
  colunas,
  linhas,
  legenda,
  vazio = 'Nenhum registro.',
  totalRotulo = 'Total',
  grande = false,
}: {
  colunas: ColunaDados[];
  linhas: LinhaDados[];
  legenda: string;
  vazio?: ReactNode;
  totalRotulo?: string;
  /** Muitas linhas e colunas: altura limitada, títulos e total fixos, primeira coluna fixa. */
  grande?: boolean;
}) {
  const [ordem, setOrdem] = useState<{ chave: string; sentido: 1 | -1 } | null>(null);
  const [filtros, setFiltros] = useState<Record<string, string>>({});
  const [verFiltros, setVerFiltros] = useState(false);
  const rolagem = useRef<HTMLDivElement>(null);
  const [maisADireita, setMaisADireita] = useState(false);
  useEffect(() => {
    const el = rolagem.current;
    if (!el) return;
    const conferir = () => setMaisADireita(temMaisColunasADireita(el.scrollLeft, el.clientWidth, el.scrollWidth));
    conferir();
    el.addEventListener('scroll', conferir, { passive: true });
    const observador = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(conferir);
    observador?.observe(el);
    const tabela = el.querySelector('table');
    if (tabela) observador?.observe(tabela);
    return () => {
      el.removeEventListener('scroll', conferir);
      observador?.disconnect();
    };
  }, []);
  const [ocultas, setOcultas] = useState<Set<string>>(() => new Set(colunas.filter((c) => c.secundaria).map((c) => c.chave)));
  const visiveisColunas = colunas.filter((c) => !ocultas.has(c.chave));
  const opcionais = colunas.filter((c) => !c.fixa);
  const ativos = Object.values(filtros).filter((f) => f.trim()).length;

  const visiveis = useMemo(() => {
    const tipo = new Map(colunas.map((c) => [c.chave, c.tipo]));
    let r = linhas.filter((l) => Object.entries(filtros).every(([k, f]) => passaFiltro(l.valores[k] ?? null, f, tipo.get(k))));
    if (ordem) {
      r = [...r].sort((a, b) => {
        const x = a.valores[ordem.chave];
        const y = b.valores[ordem.chave];
        if (x === null || x === '') return 1;
        if (y === null || y === '') return -1;
        const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR', { numeric: true });
        return c * ordem.sentido;
      });
    }
    return r;
  }, [linhas, filtros, ordem, colunas]);

  const temSoma = colunas.some((c) => c.somar);
  const classificar = (chave: string) =>
    setOrdem((o) => (!o || o.chave !== chave ? { chave, sentido: 1 } : o.sentido === 1 ? { chave, sentido: -1 } : null));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-texto-suave" aria-live="polite">
          {visiveis.length === linhas.length ? `${linhas.length} ${linhas.length === 1 ? 'registro' : 'registros'}` : `${visiveis.length} de ${linhas.length} registros`}
        </p>
        <div className="flex flex-wrap gap-1">
          {opcionais.length > 3 && (
            <details className="relative">
              <summary className="cursor-pointer list-none rounded-md border border-borda-forte px-2.5 py-1 font-semibold hover:bg-superficie-2">
                Colunas{ocultas.size > 0 ? ` (${ocultas.size} ocultas)` : ''}
              </summary>
              <div className="absolute right-0 z-20 mt-1 w-60 rounded-lg border border-borda bg-superficie p-2 shadow-lg">
                {opcionais.map((c) => (
                  <label key={c.chave} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-superficie-2">
                    <input
                      type="checkbox"
                      checked={!ocultas.has(c.chave)}
                      onChange={(e) => {
                        const n = new Set(ocultas);
                        if (e.target.checked) n.delete(c.chave);
                        else n.add(c.chave);
                        setOcultas(n);
                      }}
                    />
                    {c.rotulo}
                  </label>
                ))}
              </div>
            </details>
          )}
          {ativos > 0 && (
            <button type="button" onClick={() => setFiltros({})} className="rounded-md px-2.5 py-1 font-semibold text-destaque hover:bg-destaque-suave">
              Limpar filtros ({ativos})
            </button>
          )}
          <button
            type="button"
            aria-pressed={verFiltros}
            onClick={() => setVerFiltros((v) => !v)}
            className={`rounded-md border px-2.5 py-1 font-semibold ${verFiltros ? 'border-destaque bg-destaque-suave text-destaque' : 'border-borda-forte hover:bg-superficie-2'}`}
          >
            Filtrar colunas
          </button>
        </div>
      </div>
      <div className="relative">
      <div ref={rolagem} className={`relative overflow-auto rounded-cartao border border-borda bg-superficie ${grande ? 'max-h-[75vh]' : ''}`}>
        <table className={`border-separate border-spacing-0 text-left text-sm ${grande ? 'w-max min-w-full' : 'w-full'}`}>
          <caption className="sr-only">{legenda}. Clique no título de uma coluna para classificar.</caption>
          <thead className={`bg-superficie-2 text-texto-suave ${grande ? 'sticky top-0 z-20' : ''}`}>
            <tr>
              {visiveisColunas.map((c, ci) => {
                const ativa = ordem?.chave === c.chave;
                const alinhar = c.tipo === 'numero' || c.tipo === 'moeda' ? 'text-right' : 'text-left';
                return (
                  <th
                    key={c.chave}
                    scope="col"
                    aria-sort={ativa ? (ordem!.sentido === 1 ? 'ascending' : 'descending') : undefined}
                    title={c.calculada ? 'Calculado pelo app' : undefined}
                    className={`border-b border-borda px-3 py-2 text-[0.8rem] font-semibold ${grande ? 'whitespace-nowrap' : ''} ${alinhar} ${c.largura ?? ''} ${c.calculada ? 'bg-destaque-suave text-destaque' : ''} ${ci === 0 ? 'sticky left-0 z-30 border-r bg-superficie-2' : ''} ${
                      // A primeira coluna costuma ser o nome do registro: largura mínima para não quebrar em várias linhas.
                      ci === 0 && !grande && !c.largura && (c.tipo ?? 'texto') === 'texto' ? 'min-w-36 sm:min-w-52' : ''
                    }`}
                  >
                    {c.fixa ? (
                      <span className={c.rotulo ? '' : 'sr-only'}>{c.rotulo || 'Ações'}</span>
                    ) : (
                      <button type="button" onClick={() => classificar(c.chave)} className={`inline-flex items-center gap-1 rounded hover:text-texto ${ativa ? 'text-texto' : ''}`}>
                        {c.rotulo}
                        <span aria-hidden="true" className={`text-[0.7rem] ${ativa ? '' : 'opacity-30'}`}>
                          {ativa ? (ordem!.sentido === 1 ? '▲' : '▼') : '↕'}
                        </span>
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
            {verFiltros && (
              <tr className="border-t border-borda">
                {visiveisColunas.map((c, ci) => (
                  <th key={c.chave} scope="col" className={`border-b border-borda px-2 py-1.5 font-normal ${ci === 0 ? 'sticky left-0 z-30 border-r bg-superficie-2' : ''}`}>
                    {!c.fixa && (
                      <input
                        value={filtros[c.chave] ?? ''}
                        onChange={(e) => setFiltros({ ...filtros, [c.chave]: e.target.value })}
                        placeholder={c.tipo === 'numero' || c.tipo === 'moeda' ? '>, < ou trecho' : 'contém…'}
                        aria-label={`Filtrar ${c.rotulo}`}
                        className="w-full min-w-16 rounded border border-borda-forte bg-superficie px-2 py-1 text-xs text-texto placeholder:text-texto-suave/70"
                      />
                    )}
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {visiveis.length === 0 ? (
              <tr>
                <td colSpan={visiveisColunas.length} className="px-4 py-8 text-center text-texto-suave">
                  {linhas.length === 0 ? vazio : 'Nenhum registro com esses filtros.'}
                </td>
              </tr>
            ) : (
              visiveis.map((l) => (
                <PiscaOndeMudou key={l.id} chave={`linha:${l.id}`} como="tr" className={`group ${l.destaque ? 'bg-destaque-suave' : ''}`}>
                  {visiveisColunas.map((c, ci) => {
                    const alinhar = c.tipo === 'numero' || c.tipo === 'moeda' ? 'text-right tabular-nums whitespace-nowrap' : '';
                    return (
                      <td
                        key={c.chave}
                        className={`border-b border-borda px-3 py-2 align-top group-hover:bg-superficie-2 group-last:border-b-0 ${alinhar} ${grande ? 'whitespace-nowrap' : ''} ${c.calculada ? 'bg-destaque-suave/40' : ''} ${ci === 0 ? 'sticky left-0 z-10 border-r bg-superficie' : ''}`}
                      >
                        {l.celulas?.[c.chave] ?? formatar(l.valores[c.chave] ?? null, c.tipo)}
                      </td>
                    );
                  })}
                </PiscaOndeMudou>
              ))
            )}
          </tbody>
          {temSoma && visiveis.length > 0 && (
            <tfoot className={`bg-superficie-2 ${grande ? 'sticky bottom-0 z-20' : ''}`}>
              <tr>
                {visiveisColunas.map((c, i) => (
                  <td
                    key={c.chave}
                    className={`border-t-2 border-borda-forte bg-superficie-2 px-3 py-2 font-bold ${c.somar ? 'text-right tabular-nums whitespace-nowrap' : ''} ${i === 0 ? 'sticky left-0 z-30 border-r' : ''}`}
                  >
                    {c.somar
                      ? formatar(Math.round(visiveis.reduce((s, l) => s + (Number(l.valores[c.chave]) || 0), 0) * 100) / 100, c.tipo)
                      : i === 0
                        ? `${totalRotulo}${visiveis.length !== linhas.length ? ' (filtrado)' : ''}`
                        : ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {maisADireita && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-px right-px w-8 rounded-r-cartao bg-gradient-to-l from-black/15 to-transparent dark:from-black/40"
        />
      )}
      </div>
      {maisADireita && <p className="text-sm text-texto-suave">Role para o lado para ver mais colunas.</p>}
    </div>
  );
}
