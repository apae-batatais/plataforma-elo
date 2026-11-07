/**
 * Gráficos do painel da Avaliação de Serviços Sociais, em HTML e CSS (sem biblioteca),
 * nas cores do app. Cada gráfico tem um texto alternativo e a tabela de números
 * fica logo abaixo, em "Ver os números". Nenhum identifica pessoas.
 */
import type { ReactNode } from 'react';
import { EVOLUCOES, GRAUS_DEPENDENCIA, INDICE_MAXIMO, TRANSPORTES } from '../dominio/avaliacao';
import { INDICADORES, percentual, TENDENCIAS, type IndicadorPorSexo, type PainelAvaliacao, type ResumoServico } from '../dominio/painel';

const nf = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const pessoas = (n: number) => `${n} ${n === 1 ? 'pessoa' : 'pessoas'}`;

/** Na tela, a tabela fica recolhida em "Ver os números"; na impressão (`aberto`), sai sempre embaixo do gráfico. */
function VerNumeros({ children, aberto = false }: { children: ReactNode; aberto?: boolean }) {
  if (aberto) {
    return (
      <div className="mt-2 text-[12px]">
        <p className="sr-only">Números do gráfico</p>
        {children}
      </div>
    );
  }
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-texto-suave hover:text-destaque">Ver os números</summary>
      <div className="mt-2 overflow-x-auto">{children}</div>
    </details>
  );
}

/** `impressao`: mostra a tabela de números aberta, para o papel. */
type Props = { servicos: ResumoServico[]; impressao?: boolean };

const th = 'px-2 py-1 text-left font-normal text-texto-suave';
const td = 'px-2 py-1 tabular-nums';

/** Cada ponto é uma pessoa, no valor do índice (0 a 12). O traço marca a mediana. */
export function PontosDoIndice({ servicos, impressao = false }: Props) {
  const x = (v: number) => `${(v / INDICE_MAXIMO) * 100}%`;
  return (
    <figure aria-label="Índice de necessidade de cuidado de cada pessoa, por serviço atual, com a mediana">
      <div className="grid grid-cols-[minmax(6rem,11rem)_1fr_4.5rem] gap-x-3 text-xs text-texto-suave" aria-hidden="true">
        <span />
        <span className="relative h-4">
          {[0, 3, 6, 9, 12].map((t) => (
            <span key={t} className="absolute -translate-x-1/2" style={{ left: x(t) }}>
              {t}
            </span>
          ))}
        </span>
        <span />
      </div>
      <ul className="space-y-1">
        {servicos.map((s) => {
          const contagem = new Map<number, number>();
          return (
            <li key={s.servico} className="grid grid-cols-[minmax(6rem,11rem)_1fr_4.5rem] items-center gap-x-3">
              <span className="min-w-0 text-sm">
                <span className="block truncate font-semibold" title={s.nome}>
                  {s.nome}
                </span>
                <span className="block text-xs text-texto-suave">{pessoas(s.pessoas)}</span>
              </span>
              <span className="relative h-14" aria-hidden="true">
                {[0, 3, 6, 9, 12].map((t) => (
                  <span key={t} className="absolute inset-y-0 w-px bg-borda" style={{ left: x(t) }} />
                ))}
                {s.indices.map((v, i) => {
                  const n = (contagem.get(v) ?? 0) + 1;
                  contagem.set(v, n);
                  const desvio = Math.min(22, (n % 2 ? 1 : -1) * Math.floor(n / 2) * 7);
                  return (
                    <span
                      key={i}
                      className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-destaque opacity-75 ring-1 ring-superficie"
                      style={{ left: x(v), top: `calc(50% + ${desvio}px)` }}
                    />
                  );
                })}
                <span
                  className="absolute inset-y-1 w-[3px] -translate-x-1/2 rounded bg-texto"
                  style={{ left: x(s.mediana) }}
                  title={`Mediana ${nf(s.mediana)}`}
                />
              </span>
              <span className="text-right text-xs text-texto-suave">
                mediana <b className="text-texto">{nf(s.mediana)}</b>
              </span>
            </li>
          );
        })}
      </ul>
      <VerNumeros aberto={impressao}>
        <table className="w-full">
          <thead>
            <tr>
              <th className={th}>Serviço</th>
              <th className={th}>Pessoas</th>
              <th className={th}>Mediana</th>
              <th className={th}>Média</th>
              <th className={th}>Menor</th>
              <th className={th}>Maior</th>
            </tr>
          </thead>
          <tbody>
            {servicos.map((s) => (
              <tr key={s.servico} className="border-t border-borda">
                <td className="px-2 py-1">{s.nome}</td>
                <td className={td}>{s.pessoas}</td>
                <td className={td}>{nf(s.mediana)}</td>
                <td className={td}>{nf(s.media)}</td>
                <td className={td}>{s.indices[0]}</td>
                <td className={td}>{s.indices[s.indices.length - 1]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VerNumeros>
    </figure>
  );
}

function Legenda({ itens }: { itens: { nome: string; cor: string }[] }) {
  return (
    <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-texto-suave">
      {itens.map((i) => (
        <li key={i.nome} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: i.cor }} aria-hidden="true" />
          {i.nome}
        </li>
      ))}
    </ul>
  );
}

/** Uma barra 100% com partes coloridas e o percentual escrito quando cabe. */
function Barra100({ partes, rotulo }: { partes: { nome: string; valor: number; cor: string; texto: string }[]; rotulo: string }) {
  const total = partes.reduce((s, p) => s + p.valor, 0) || 1;
  return (
    <span
      className="flex h-6 overflow-hidden rounded-md bg-superficie-2"
      role="img"
      aria-label={`${rotulo}: ${partes.map((p) => `${p.nome} ${percentual(p.valor, total)}%`).join(', ')}`}
    >
      {partes
        .filter((p) => p.valor > 0)
        .map((p, k) => {
          const pct = (p.valor / total) * 100;
          return (
            <span
              key={p.nome}
              title={`${p.nome}: ${p.valor} (${Math.round(pct)}%)`}
              className={`flex items-center justify-center text-[11px] font-bold ${k > 0 ? 'border-l-2 border-superficie' : ''}`}
              style={{ width: `${pct}%`, background: p.cor, color: p.texto }}
            >
              {pct >= 12 ? `${Math.round(pct)}%` : ''}
            </span>
          );
        })}
    </span>
  );
}

const COR_GRAU = {
  I: { cor: 'color-mix(in srgb, var(--destaque) 28%, var(--superficie))', texto: 'var(--texto)' },
  II: { cor: 'color-mix(in srgb, var(--destaque) 62%, var(--superficie))', texto: 'var(--sobre-destaque)' },
  III: { cor: 'var(--destaque)', texto: 'var(--sobre-destaque)' },
} as const;

export function DependenciaPorServico({ servicos, impressao = false }: Props) {
  return (
    <figure aria-label="Grau de dependência por serviço atual">
      <Legenda itens={GRAUS_DEPENDENCIA.map((g) => ({ nome: `Grau ${g}`, cor: COR_GRAU[g].cor }))} />
      <ul className="space-y-2.5">
        {servicos.map((s) => (
          <li key={s.servico} className="grid grid-cols-[minmax(6rem,11rem)_1fr] items-center gap-3 text-sm">
            <span className="truncate font-semibold" title={s.nome}>
              {s.nome}
            </span>
            <Barra100 rotulo={s.nome} partes={GRAUS_DEPENDENCIA.map((g) => ({ nome: `Grau ${g}`, valor: s.dependencia[g], ...COR_GRAU[g] }))} />
          </li>
        ))}
      </ul>
      <VerNumeros aberto={impressao}>
        <table className="w-full">
          <thead>
            <tr>
              <th className={th}>Serviço</th>
              {GRAUS_DEPENDENCIA.map((g) => (
                <th key={g} className={th}>
                  Grau {g}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {servicos.map((s) => (
              <tr key={s.servico} className="border-t border-borda">
                <td className="px-2 py-1">{s.nome}</td>
                {GRAUS_DEPENDENCIA.map((g) => (
                  <td key={g} className={td}>
                    {s.dependencia[g]} ({percentual(s.dependencia[g], s.pessoas)}%)
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </VerNumeros>
    </figure>
  );
}

const COR_EVOLUCAO = {
  Regrediu: { cor: 'var(--erro)', texto: '#ffffff' },
  Manteve: { cor: 'var(--borda-forte)', texto: 'var(--texto)' },
  Melhorou: { cor: 'var(--sucesso)', texto: '#ffffff' },
} as const;

export function EvolucaoPorServico({ servicos, impressao = false }: Props) {
  return (
    <figure aria-label="Evolução da pessoa atendida e da família desde a avaliação anterior, por serviço atual">
      <Legenda itens={EVOLUCOES.map((e) => ({ nome: e, cor: COR_EVOLUCAO[e].cor }))} />
      <ul className="space-y-3">
        {servicos.map((s) => (
          <li key={s.servico} className="text-sm">
            <span className="block truncate font-semibold" title={s.nome}>
              {s.nome}
            </span>
            {(
              [
                ['Pessoa', s.evolucaoPessoa],
                ['Família', s.evolucaoFamilia],
              ] as const
            ).map(([rotulo, c]) => (
              <span key={rotulo} className="mt-1 grid grid-cols-[3.5rem_1fr_6.5rem] items-center gap-2">
                <span className="text-xs text-texto-suave">{rotulo}</span>
                <Barra100 rotulo={`${s.nome}, ${rotulo.toLowerCase()}`} partes={EVOLUCOES.map((e) => ({ nome: e, valor: c[e], ...COR_EVOLUCAO[e] }))} />
                <span className="text-right text-xs text-texto-suave">{percentual(c.Regrediu, s.pessoas)}% regrediu</span>
              </span>
            ))}
          </li>
        ))}
      </ul>
      <VerNumeros aberto={impressao}>
        <table className="w-full">
          <thead>
            <tr>
              <th className={th}>Serviço</th>
              <th className={th}>Quem</th>
              {EVOLUCOES.map((e) => (
                <th key={e} className={th}>
                  {e}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {servicos.flatMap((s) =>
              (
                [
                  ['Pessoa', s.evolucaoPessoa],
                  ['Família', s.evolucaoFamilia],
                ] as const
              ).map(([rotulo, c]) => (
                <tr key={`${s.servico}-${rotulo}`} className="border-t border-borda">
                  <td className="px-2 py-1">{s.nome}</td>
                  <td className="px-2 py-1">{rotulo}</td>
                  {EVOLUCOES.map((e) => (
                    <td key={e} className={td}>
                      {c[e]}
                    </td>
                  ))}
                </tr>
              )),
            )}
          </tbody>
        </table>
      </VerNumeros>
    </figure>
  );
}

/** Tabela de calor: percentual de pessoas com cada indicador, por serviço (e todos juntos). */
export function IndicadoresPorServico({ servicos, geral }: { servicos: ResumoServico[]; geral: ResumoServico | null }) {
  const colunas = servicos.length > 1 && geral ? [...servicos, geral] : servicos;
  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed border-separate border-spacing-[3px] text-sm">
        <caption className="sr-only">Percentual de pessoas com cada indicador do diagnóstico, por serviço atual</caption>
        <thead>
          <tr>
            <th scope="col" className="w-[36%]">
              <span className="sr-only">Indicador</span>
            </th>
            {colunas.map((c) => (
              <th key={c.servico} scope="col" className="break-words px-0.5 pb-1 text-center align-bottom text-[11px] font-bold leading-tight" title={c.nome}>
                {c.nome}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {INDICADORES.map((i) => (
            <tr key={i.codigo}>
              <th scope="row" className="pr-2 text-left text-[13px] font-normal leading-tight text-texto-suave">
                {i.nome}
              </th>
              {colunas.map((c) => {
                const n = c.indicadores[i.codigo] ?? 0;
                const p = percentual(n, c.pessoas);
                return (
                  <td
                    key={c.servico}
                    title={`${c.nome} · ${i.nome}: ${n} de ${c.pessoas}`}
                    className="rounded-md px-0.5 py-1 text-center text-[13px] font-bold tabular-nums"
                    style={{
                      background: `color-mix(in srgb, var(--destaque) ${Math.round(8 + p * 0.82)}%, var(--superficie))`,
                      color: p > 55 ? 'var(--sobre-destaque)' : 'var(--texto)',
                    }}
                  >
                    {p}%
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Evolução entre avaliações, transporte e análise por sexo
// ---------------------------------------------------------------------------

const COR_TENDENCIA = {
  melhorou: { cor: 'var(--sucesso)', texto: '#ffffff', nome: 'Melhorou (índice menor)' },
  manteve: { cor: 'var(--borda-forte)', texto: 'var(--texto)', nome: 'Manteve' },
  piorou: { cor: 'var(--erro)', texto: '#ffffff', nome: 'Piorou (índice maior)' },
} as const;

/** Pessoas com duas ou mais avaliações: o índice caiu, ficou igual ou subiu da primeira para a última. */
export function EvolucaoEntreAvaliacoes({ servicos, geral, impressao = false }: Props & { geral: ResumoServico | null }) {
  const linhas = [...servicos, ...(servicos.length > 1 && geral ? [geral] : [])].filter((s) => TENDENCIAS.some((t) => s.entreAvaliacoes[t] > 0));
  if (!linhas.length) {
    return <p className="text-sm text-texto-suave">Ainda não há pessoas com duas avaliações. O comparativo aparece depois do primeiro acompanhamento anual.</p>;
  }
  return (
    <figure aria-label="Pessoas com duas ou mais avaliações: variação do índice de necessidade de cuidado da primeira para a última">
      <Legenda itens={TENDENCIAS.map((t) => ({ nome: COR_TENDENCIA[t].nome, cor: COR_TENDENCIA[t].cor }))} />
      <ul className="space-y-2.5">
        {linhas.map((s) => {
          const n = TENDENCIAS.reduce((x, t) => x + s.entreAvaliacoes[t], 0);
          return (
            <li key={s.servico} className="grid grid-cols-[minmax(6rem,11rem)_1fr_7rem] items-center gap-3 text-sm">
              <span className="min-w-0">
                <span className={`block truncate ${s.servico === 'todos' ? 'font-bold' : 'font-semibold'}`} title={s.nome}>
                  {s.nome}
                </span>
                <span className="block text-xs text-texto-suave">{pessoas(n)} com 2+ avaliações</span>
              </span>
              <Barra100 rotulo={s.nome} partes={TENDENCIAS.map((t) => ({ valor: s.entreAvaliacoes[t], ...COR_TENDENCIA[t] }))} />
              <span className="text-right text-xs text-texto-suave">
                índice {nf(s.mediaPrimeira ?? 0)} → <b className="text-texto">{nf(s.mediaUltima ?? 0)}</b>
              </span>
            </li>
          );
        })}
      </ul>
      <VerNumeros aberto={impressao}>
        <table className="w-full">
          <thead>
            <tr>
              <th className={th}>Serviço</th>
              <th className={th}>Melhorou</th>
              <th className={th}>Manteve</th>
              <th className={th}>Piorou</th>
              <th className={th}>Índice médio na 1ª</th>
              <th className={th}>Índice médio na última</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((s) => (
              <tr key={s.servico} className="border-t border-borda">
                <td className="px-2 py-1">{s.nome}</td>
                {TENDENCIAS.map((t) => (
                  <td key={t} className={td}>
                    {s.entreAvaliacoes[t]}
                  </td>
                ))}
                <td className={td}>{nf(s.mediaPrimeira ?? 0)}</td>
                <td className={td}>{nf(s.mediaUltima ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VerNumeros>
    </figure>
  );
}

const COR_TRANSPORTE = {
  Comum: { cor: 'color-mix(in srgb, var(--destaque) 28%, var(--superficie))', texto: 'var(--texto)', nome: 'Comum' },
  Rampa: { cor: 'color-mix(in srgb, var(--destaque) 62%, var(--superficie))', texto: 'var(--sobre-destaque)', nome: 'Com rampa' },
  Cadeirante: { cor: 'var(--destaque)', texto: 'var(--sobre-destaque)', nome: 'Cadeirante' },
} as const;

/** Que veículo cada serviço precisa: comum, com rampa ou para cadeirante. */
export function TransportePorServico({ servicos, impressao = false }: Props) {
  return (
    <figure aria-label="Transporte necessário por serviço atual">
      <Legenda itens={TRANSPORTES.map((x) => ({ nome: COR_TRANSPORTE[x].nome, cor: COR_TRANSPORTE[x].cor }))} />
      <ul className="space-y-2.5">
        {servicos.map((s) => (
          <li key={s.servico} className="grid grid-cols-[minmax(6rem,11rem)_1fr] items-center gap-3 text-sm">
            <span className="truncate font-semibold" title={s.nome}>
              {s.nome}
            </span>
            <Barra100 rotulo={s.nome} partes={TRANSPORTES.map((x) => ({ valor: s.transporte[x], ...COR_TRANSPORTE[x] }))} />
          </li>
        ))}
      </ul>
      <VerNumeros aberto={impressao}>
        <table className="w-full">
          <thead>
            <tr>
              <th className={th}>Serviço</th>
              {TRANSPORTES.map((x) => (
                <th key={x} className={th}>
                  {COR_TRANSPORTE[x].nome}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {servicos.map((s) => (
              <tr key={s.servico} className="border-t border-borda">
                <td className="px-2 py-1">{s.nome}</td>
                {TRANSPORTES.map((x) => (
                  <td key={x} className={td}>
                    {s.transporte[x]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </VerNumeros>
    </figure>
  );
}

const COR_F = 'var(--serie-2)';
const COR_M = 'var(--serie-1)';

/** Pirâmide: pessoas por geração, mulheres à esquerda e homens à direita. */
export function PiramideSexo({
  piramide,
  sexo,
  impressao = false,
}: {
  piramide: PainelAvaliacao['piramide'];
  sexo: PainelAvaliacao['sexo'];
  impressao?: boolean;
}) {
  const max = Math.max(1, ...piramide.flatMap((g) => [g.f, g.m]));
  const larg = (v: number) => `${(v / max) * 100}%`;
  return (
    <figure aria-label={`Pessoas por geração e sexo: ${sexo.f} mulheres e ${sexo.m} homens`}>
      <div className="mb-2 grid grid-cols-[1fr_7.5rem_1fr] text-xs font-bold">
        <span className="text-right">
          Feminino · {sexo.f} ({percentual(sexo.f, sexo.f + sexo.m)}%)
        </span>
        <span />
        <span>
          Masculino · {sexo.m} ({percentual(sexo.m, sexo.f + sexo.m)}%)
        </span>
      </div>
      <ul className="space-y-1.5">
        {piramide.map((g) => (
          <li key={g.geracao} className="grid grid-cols-[1fr_7.5rem_1fr] items-center gap-2 text-sm">
            <span className="flex items-center justify-end gap-1.5">
              <span className="text-xs font-bold tabular-nums">{g.f}</span>
              <span className="h-5 rounded-l" style={{ width: larg(g.f), minWidth: g.f ? 3 : 0, background: COR_F }} title={`${g.geracao}, feminino: ${g.f}`} />
            </span>
            <span className="text-center leading-tight">
              <span className="block text-xs font-semibold">{g.geracao}</span>
              <span className="block text-[11px] text-texto-suave">{g.faixa} anos</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="h-5 rounded-r"
                style={{ width: larg(g.m), minWidth: g.m ? 3 : 0, background: COR_M }}
                title={`${g.geracao}, masculino: ${g.m}`}
              />
              <span className="text-xs font-bold tabular-nums">{g.m}</span>
            </span>
          </li>
        ))}
      </ul>
      <VerNumeros aberto={impressao}>
        <table className="w-full">
          <thead>
            <tr>
              <th className={th}>Geração</th>
              <th className={th}>Feminino</th>
              <th className={th}>Masculino</th>
            </tr>
          </thead>
          <tbody>
            {piramide.map((g) => (
              <tr key={g.geracao} className="border-t border-borda">
                <td className="px-2 py-1">
                  {g.geracao} ({g.faixa})
                </td>
                <td className={td}>{g.f}</td>
                <td className={td}>{g.m}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VerNumeros>
    </figure>
  );
}

/** Halteres: percentual de mulheres e de homens com cada indicador, lado a lado. */
export function IndicadoresPorSexo({ itens, impressao = false }: { itens: IndicadorPorSexo[]; impressao?: boolean }) {
  return (
    <figure aria-label="Percentual de mulheres e de homens com cada indicador">
      <Legenda
        itens={[
          { nome: 'Feminino', cor: COR_F },
          { nome: 'Masculino', cor: COR_M },
        ]}
      />
      <ul className="space-y-1">
        {itens.map((i) => {
          const pf = percentual(i.f, i.totalF);
          const pm = percentual(i.m, i.totalM);
          return (
            <li
              key={i.nome}
              className="grid grid-cols-[minmax(7rem,12rem)_1fr_6.5rem] items-center gap-3 text-sm"
              title={`${i.nome}: feminino ${i.f} de ${i.totalF}; masculino ${i.m} de ${i.totalM}`}
            >
              <span className="truncate text-texto-suave">{i.nome}</span>
              <span className="relative h-4" aria-hidden="true">
                <span className="absolute inset-x-0 top-1/2 h-px bg-borda" />
                <span
                  className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-texto-suave"
                  style={{ left: `${Math.min(pf, pm)}%`, width: `${Math.abs(pf - pm)}%` }}
                />
                <span
                  className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-superficie"
                  style={{ left: `${pf}%`, background: COR_F }}
                />
                <span
                  className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-superficie"
                  style={{ left: `${pm}%`, background: COR_M }}
                />
              </span>
              <span className="text-right text-xs tabular-nums text-texto-suave">
                F {pf}% · M {pm}%
              </span>
            </li>
          );
        })}
      </ul>
      <VerNumeros aberto={impressao}>
        <table className="w-full">
          <thead>
            <tr>
              <th className={th}>Indicador</th>
              <th className={th}>Feminino</th>
              <th className={th}>Masculino</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((i) => (
              <tr key={i.nome} className="border-t border-borda">
                <td className="px-2 py-1">{i.nome}</td>
                <td className={td}>
                  {i.f} de {i.totalF} ({percentual(i.f, i.totalF)}%)
                </td>
                <td className={td}>
                  {i.m} de {i.totalM} ({percentual(i.m, i.totalM)}%)
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </VerNumeros>
    </figure>
  );
}
