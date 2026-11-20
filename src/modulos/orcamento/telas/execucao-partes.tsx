/** Peças comuns às telas Painel de execução e Recursos livres (1C.2): só apresentação, sem regra de negócio. */
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Etiqueta } from '@/ui/pagina';
import { NumeroQueConta } from '@/ui/numero-que-conta';
import type { PeriodoExecucao } from '../dominio/execucao';
import { MESES, percentual, reais } from './formato';

/** Cartão de destaque: número grande e a frase do que significa. */
export function CartaoNumero({ rotulo, valor, chave, children, alerta }: { rotulo: string; valor: number | null; chave: string; children?: ReactNode; alerta?: string | null }) {
  return (
    <div className={`rounded-cartao border bg-superficie px-5 py-4 ${alerta ? 'border-erro' : 'border-borda'}`}>
      <dt className="text-sm text-texto-suave">{rotulo}</dt>
      <dd className={`mt-0.5 text-2xl font-bold leading-tight tabular-nums ${alerta ? 'text-erro' : ''}`}>
        {valor === null ? '—' : <NumeroQueConta texto={reais(valor)} chave={chave} />}
      </dd>
      <dd className="mt-1 flex flex-wrap items-center gap-2 text-sm text-texto-suave">
        {children}
        {alerta && <Etiqueta tipo="erro">{alerta}</Etiqueta>}
      </dd>
    </div>
  );
}

/** "Previsto R$ x · 75% do previsto" (ou "sem previsto"). */
export function LinhaPrevisto({ previsto, execucao, previstoRotulo = 'Previsto' }: { previsto: number | null; execucao: number | null; previstoRotulo?: string }) {
  if (previsto === null) return <span>Sem Previsão aprovada para comparar</span>;
  return (
    <span>
      {previstoRotulo} {reais(previsto)} · {execucao === null ? 'sem previsto' : `${percentual(execucao)} do previsto`}
    </span>
  );
}

export function Bloco({ titulo, descricao, children }: { titulo: string; descricao?: string; children: ReactNode }) {
  return (
    <section className="rounded-cartao border border-borda bg-superficie p-5" aria-label={titulo}>
      <h2 className="font-bold">{titulo}</h2>
      {descricao ? <p className="mb-4 mt-0.5 text-sm text-texto-suave">{descricao}</p> : <div className="mb-4" />}
      {children}
    </section>
  );
}

/** Gráfico à esquerda e a leitura (o que fazer) à direita. */
export function GraficoComLeitura({ titulo, descricao, leitura, children }: { titulo: string; descricao?: string; leitura: ReactNode; children: ReactNode }) {
  return (
    <Bloco titulo={titulo} descricao={descricao}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0">{children}</div>
        <div className="space-y-2 text-sm">{leitura}</div>
      </div>
    </Bloco>
  );
}

const nomeMes = (mes: string) => MESES[Number(mes.slice(5)) - 1].toLowerCase();
const lista = (meses: string[]) => (meses.length > 1 ? `${meses.slice(0, -1).map(nomeMes).join(', ')} e ${nomeMes(meses.at(-1)!)}` : nomeMes(meses[0]));

/** "Janeiro a setembro de 2026 · realizado informado até setembro" */
export function textoDoPeriodo(ano: number, p: PeriodoExecucao): string {
  if (p.meses.length === 0) return `${ano} · nenhum mês informado ainda`;
  const primeiro = MESES[Number(p.meses[0].slice(5)) - 1];
  const ultimo = MESES[Number(p.meses.at(-1)!.slice(5)) - 1].toLowerCase();
  const ate = p.contam.at(-1);
  const faixa = p.meses.length === 1 ? `${primeiro} de ${ano}` : `${primeiro} a ${ultimo} de ${ano}`;
  return `${faixa} · realizado informado até ${ate ? nomeMes(ate) : 'nenhum mês'}`;
}

export const listaDeMeses = lista;

/** Filtro de período: ano todo (até o último mês informado) ou um mês. */
export function SeletorPeriodo({ base, meses, escolhido }: { base: string; meses: string[]; escolhido: string | null }) {
  const item = (ativo: boolean) =>
    `inline-flex min-h-11 items-center rounded-full border px-3 text-sm ${ativo ? 'border-destaque bg-superficie-2 font-bold' : 'border-borda text-texto-suave hover:text-texto'}`;
  return (
    <nav aria-label="Período" className="flex flex-wrap gap-2">
      <Link href={base} aria-current={escolhido === null ? 'page' : undefined} className={item(escolhido === null)}>
        Ano até agora
      </Link>
      {meses.map((m) => (
        <Link key={m} href={`${base}${base.includes('?') ? '&' : '?'}mes=${m}`} aria-current={escolhido === m ? 'page' : undefined} className={item(escolhido === m)}>
          {MESES[Number(m.slice(5)) - 1].slice(0, 3)}
        </Link>
      ))}
    </nav>
  );
}
