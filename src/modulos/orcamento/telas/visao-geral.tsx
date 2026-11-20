/** Cartões dos sinais da Visão geral (1D.2): nome, valor, situação escrita, regra e "Ver detalhes". */
import Link from 'next/link';
import type { Sinal } from '../aplicacao/visao-geral';
import { NumeroQueConta } from '@/ui/numero-que-conta';
import { EtiquetaDeSinal, valorDoSinal } from './situacao';

export function CartaoDeSinal({ s }: { s: Sinal }) {
  return (
    <li className="flex flex-col gap-2 rounded-cartao border border-borda bg-superficie p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-base font-bold">{s.nome}</h3>
        <EtiquetaDeSinal situacao={s.situacao} />
      </div>
      <p className="text-3xl font-bold tabular-nums">
        {s.valor === null ? <span className="text-texto-suave">Sem dado</span> : <NumeroQueConta texto={valorDoSinal(s.valor, s.unidade)} chave={`sinal:${s.chave}`} />}
      </p>
      {s.valor === null && s.motivo && <p className="text-sm">{s.motivo}.</p>}
      {s.dado && (
        <p className="text-sm text-texto-suave">
          {s.previsto ? 'Previsto' : 'Dado'}: {s.dado}
          {s.desatualizado && <strong className="ml-1 text-aviso">· desatualizado</strong>}
        </p>
      )}
      <p className="text-sm text-texto-suave">{s.regra}</p>
      {s.faixaProposta && <p className="text-sm text-texto-suave">Faixa proposta, ainda não aprovada.</p>}
      <Link href={s.href} className="mt-auto pt-1 text-sm font-semibold text-destaque hover:underline">
        Ver detalhes<span className="sr-only"> de {s.nome}</span>
      </Link>
    </li>
  );
}
