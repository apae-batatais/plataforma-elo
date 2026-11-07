/**
 * Comparativo das avaliações de uma pessoa: o índice de necessidade de cuidado
 * em cada avaliação e cada resposta lado a lado, com o que melhorou ou piorou
 * da primeira para a última. Também serve para imprimir (fica dentro da Folha).
 */
import Link from 'next/link';
import { INDICE_MAXIMO } from '../dominio/avaliacao';
import type { Tendencia } from '../dominio/comparativo';
import type { HistoricoPessoa } from '../aplicacao/avaliacoes';

const br = (iso: string) => iso.split('-').reverse().join('/');

const TEXTO_TENDENCIA: Record<Tendencia, { texto: string; classe: string; simbolo: string }> = {
  melhorou: { texto: 'Melhorou', classe: 'text-sucesso', simbolo: '▼' },
  manteve: { texto: 'Manteve', classe: 'text-texto-suave', simbolo: '=' },
  piorou: { texto: 'Piorou', classe: 'text-erro', simbolo: '▲' },
};

function Selo({ t }: { t: Tendencia }) {
  const x = TEXTO_TENDENCIA[t];
  return (
    <span className={`whitespace-nowrap font-bold ${x.classe}`}>
      <span aria-hidden="true">{x.simbolo} </span>
      {x.texto}
    </span>
  );
}

const SITUACAO = {
  em_dia: { texto: 'Em dia', classe: 'text-texto' },
  vence_em_breve: { texto: 'Vence em breve', classe: 'text-aviso' },
  atrasada: { texto: 'Atrasada', classe: 'text-erro' },
} as const;

export function ComparativoPessoa({ h, links = true }: { h: HistoricoPessoa; links?: boolean }) {
  const c = h.comparativo;
  const n = h.avaliacoes.length;
  const primeira = h.avaliacoes[0];
  const ultima = h.avaliacoes[n - 1];
  const grupos = [...new Set(c.linhas.map((l) => l.grupo))];
  const resumo =
    n < 2
      ? 'Só há uma avaliação desta pessoa. O comparativo aparece a partir do primeiro acompanhamento anual.'
      : c.tendencia === 'melhorou'
        ? `O índice de necessidade de cuidado caiu de ${c.indices[0]} para ${c.indices[n - 1]}: sinal de melhora na qualidade de vida.`
        : c.tendencia === 'piorou'
          ? `O índice de necessidade de cuidado subiu de ${c.indices[0]} para ${c.indices[n - 1]}: a situação pede atenção da equipe.`
          : `O índice de necessidade de cuidado ficou em ${c.indices[0]}: a situação se manteve.`;

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-2 break-inside-avoid sm:grid-cols-4">
        {(
          [
            ['Avaliações', String(n), `de ${br(primeira.data)} a ${br(ultima.data)}`],
            ['Índice na primeira', String(c.indices[0]), `de ${INDICE_MAXIMO} · ${br(primeira.data)}`],
            ['Índice na última', String(c.indices[n - 1]), `de ${INDICE_MAXIMO} · ${br(ultima.data)}`],
            ['Próxima avaliação', br(h.reavaliacao.vence), SITUACAO[h.reavaliacao.situacao].texto],
          ] as const
        ).map(([r, v, x], i) => (
          <div key={r} className="rounded-lg border border-borda px-3 py-2">
            <p className="text-[11px] text-texto-suave">{r}</p>
            <p className={`text-xl font-bold tabular-nums ${i === 3 ? SITUACAO[h.reavaliacao.situacao].classe : ''}`}>{v}</p>
            <p className={`text-[11px] ${i === 3 ? SITUACAO[h.reavaliacao.situacao].classe : 'text-texto-suave'}`}>{x}</p>
          </div>
        ))}
      </section>

      <section className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg bg-superficie-2 px-4 py-3 break-inside-avoid">
        <p className="min-w-0 flex-1 basis-64">
          {n > 1 && (
            <>
              <Selo t={c.tendencia} />{' '}
            </>
          )}
          {resumo}
          {n > 1 && (
            <span className="mt-0.5 block text-[12px] text-texto-suave">
              Da primeira para a última: {c.itensMelhoraram} {c.itensMelhoraram === 1 ? 'item melhorou' : 'itens melhoraram'} e {c.itensPioraram}{' '}
              {c.itensPioraram === 1 ? 'piorou' : 'pioraram'}.
            </span>
          )}
        </p>
        <figure className="flex items-end gap-3" aria-label={`Índice em cada avaliação: ${h.avaliacoes.map((a) => `${br(a.data)} ${a.indice}`).join(', ')}`}>
          {h.avaliacoes.map((a) => (
            <div key={a.id} className="flex w-14 flex-col items-center gap-1 text-[11px]">
              <span className="font-bold tabular-nums">{a.indice}</span>
              <span className="flex h-20 w-6 items-end rounded bg-superficie" aria-hidden="true">
                <span className="w-full rounded bg-destaque" style={{ height: `${Math.max(4, (a.indice / INDICE_MAXIMO) * 100)}%` }} />
              </span>
              <span className="text-texto-suave">{br(a.data).slice(3)}</span>
            </div>
          ))}
        </figure>
      </section>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <caption className="sr-only">Respostas de cada avaliação, com a tendência da primeira para a última</caption>
          <thead>
            <tr className="border-b-2 border-borda">
              <th scope="col" className="py-1.5 pr-3 text-left font-normal text-texto-suave">
                Pergunta
              </th>
              {h.avaliacoes.map((a) => (
                <th key={a.id} scope="col" className="px-2 py-1.5 text-left align-bottom">
                  <span className="block font-bold">{br(a.data)}</span>
                  <span className="block text-[11px] font-normal text-texto-suave">{a.tipo}</span>
                  {links && (
                    <Link href={`/avaliacao/${a.id}`} className="text-[11px] font-semibold text-destaque underline-offset-2 hover:underline print:hidden">
                      Abrir
                    </Link>
                  )}
                </th>
              ))}
              {n > 1 && (
                <th scope="col" className="px-2 py-1.5 text-left font-normal text-texto-suave">
                  Da 1ª para a última
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-borda bg-destaque-suave">
              <th scope="row" className="py-1.5 pr-3 text-left font-bold">
                Índice de necessidade de cuidado
              </th>
              {c.indices.map((v, i) => (
                <td key={i} className="px-2 py-1.5 text-lg font-bold tabular-nums text-destaque">
                  {v}
                </td>
              ))}
              {n > 1 && (
                <td className="px-2 py-1.5">
                  <Selo t={c.tendencia} />
                </td>
              )}
            </tr>
            {grupos.map((g) => (
              <GrupoLinhas key={g} grupo={g} linhas={c.linhas.filter((l) => l.grupo === g)} comparar={n > 1} colunas={n} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-texto-suave break-inside-avoid">
        Índice menor na avaliação mais recente indica menos necessidade de cuidado, ou seja, melhora na qualidade de vida. A tendência compara só a primeira e a
        última avaliação; perguntas sem seta descrevem a situação e não são melhores nem piores por si.
      </p>
    </div>
  );
}

function GrupoLinhas({
  grupo,
  linhas,
  comparar,
  colunas,
}: {
  grupo: string;
  linhas: HistoricoPessoa['comparativo']['linhas'];
  comparar: boolean;
  colunas: number;
}) {
  return (
    <>
      <tr className="break-inside-avoid break-after-avoid">
        <th scope="colgroup" colSpan={colunas + (comparar ? 2 : 1)} className="pb-1 pt-3 text-left text-[12px] font-bold text-destaque">
          {grupo}
        </th>
      </tr>
      {linhas.map((l) => (
        <tr key={l.rotulo} className="border-b border-borda break-inside-avoid">
          <th scope="row" className="py-1 pr-3 text-left font-normal text-texto-suave">
            {l.rotulo}
          </th>
          {l.valores.map((v, i) => (
            <td key={i} className="px-2 py-1 font-semibold">
              {v}
            </td>
          ))}
          {comparar && <td className="px-2 py-1">{l.tendencia ? <Selo t={l.tendencia} /> : <span className="text-texto-suave">—</span>}</td>}
        </tr>
      ))}
    </>
  );
}
