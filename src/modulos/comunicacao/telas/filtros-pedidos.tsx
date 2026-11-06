/** Filas (controle segmentado) e filtros em pílulas da tela Pedidos. Tudo vai no endereço (?fila=...&situacao=...). */
import Link from 'next/link';
import type { FiltrosPedidos, Visao } from '../aplicacao/pedidos';

export interface OpcaoFila {
  fila: Exclude<Visao, 'meus'>;
  rotulo: string;
}

export const FILAS: OpcaoFila[] = [
  { fila: 'revisar', rotulo: 'Para revisar' },
  { fila: 'aprovar', rotulo: 'Para aprovar' },
  { fila: 'agendar', rotulo: 'Para agendar' },
  { fila: 'agendados', rotulo: 'Agendados' },
  { fila: 'todos', rotulo: 'Todos' },
];

function endereco(fila: string, f: FiltrosPedidos, mudar: Partial<FiltrosPedidos>) {
  const q = new URLSearchParams({ fila });
  for (const [k, v] of Object.entries({ ...f, ...mudar })) if (v) q.set(k, v);
  return `/comunicacao/pedidos?${q.toString()}`;
}

const pilula = (ativa: boolean) =>
  `inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold ${ativa ? 'border-destaque bg-destaque text-sobre-destaque' : 'border-borda-forte bg-superficie text-texto hover:bg-superficie-2'}`;

export function ControleFilas({ filas, atual }: { filas: OpcaoFila[]; atual: string }) {
  return (
    <nav aria-label="Filas de pedidos" className="inline-flex flex-wrap gap-1 rounded-lg border border-borda bg-superficie p-1">
      {filas.map((o) => (
        <Link
          key={o.fila}
          href={`/comunicacao/pedidos?fila=${o.fila}`}
          aria-current={atual === o.fila ? 'page' : undefined}
          className={`inline-flex min-h-11 items-center rounded-md px-4 text-sm font-semibold ${atual === o.fila ? 'bg-destaque text-sobre-destaque' : 'text-texto hover:bg-superficie-2'}`}
        >
          {o.rotulo}
        </Link>
      ))}
    </nav>
  );
}

export interface GrupoFiltro {
  chave: keyof FiltrosPedidos;
  rotulo: string;
  opcoes: { valor: string; rotulo: string }[];
}

export function PilulasDeFiltro({ fila, filtros, grupos }: { fila: string; filtros: FiltrosPedidos; grupos: GrupoFiltro[] }) {
  return (
    <div className="space-y-3">
      {grupos
        .filter((g) => g.opcoes.length > 0)
        .map((g) => (
          <div key={g.chave} role="group" aria-label={`Filtrar por ${g.rotulo}`} className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-texto-suave">{g.rotulo}:</span>
            <Link href={endereco(fila, filtros, { [g.chave]: '' })} aria-current={!filtros[g.chave] ? 'true' : undefined} className={pilula(!filtros[g.chave])}>
              Todos
            </Link>
            {g.opcoes.map((o) => (
              <Link
                key={o.valor}
                href={endereco(fila, filtros, { [g.chave]: o.valor })}
                aria-current={filtros[g.chave] === o.valor ? 'true' : undefined}
                className={pilula(filtros[g.chave] === o.valor)}
              >
                {o.rotulo}
              </Link>
            ))}
          </div>
        ))}
    </div>
  );
}
