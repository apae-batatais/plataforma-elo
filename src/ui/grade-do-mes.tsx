'use client';

/**
 * Calendário do mês em grade (semana de domingo a sábado). Cada dia é um link para o dia aberto
 * (`href`). Pelo teclado: Tab entra na grade, setas movem entre os dias e Enter abre o dia.
 * Cada item mostra o ícone do app, na cor dele, com o título; mais de 3 itens viram "+N".
 */
import Link from 'next/link';
import { useRef, useState } from 'react';
import { ICONES, type NomeIcone } from './icones';

export interface ItemDaGrade {
  app: string;
  icone: NomeIcone;
  nomeDoApp: string;
  titulo: string;
}

export interface DiaDaGrade {
  /** AAAA-MM-DD. */
  dia: string;
  itens: ItemDaGrade[];
  href: string;
}

const SEMANA = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'];
const MAX_NA_CELULA = 3;

export function GradeDoMes({ mes, dias, hoje, diaAberto }: { mes: string; dias: DiaDaGrade[]; hoje: string; diaAberto?: string }) {
  const primeiro = new Date(`${dias[0].dia}T12:00:00Z`).getUTCDay();
  const inicial = diaAberto ?? (hoje.startsWith(mes) ? hoje : dias[0].dia);
  const [foco, setFoco] = useState(inicial);
  const links = useRef(new Map<string, HTMLAnchorElement>());

  function mover(de: string, passo: number) {
    const i = dias.findIndex((d) => d.dia === de) + passo;
    const alvo = dias[Math.min(dias.length - 1, Math.max(0, i))].dia;
    setFoco(alvo);
    links.current.get(alvo)?.focus();
  }

  function aoTeclar(e: React.KeyboardEvent, dia: string) {
    const passo = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (passo === undefined) return;
    e.preventDefault();
    mover(dia, passo);
  }

  return (
    <div role="group" aria-label="Calendário do mês" className="overflow-hidden rounded-cartao border border-borda bg-superficie">
      <div aria-hidden="true" className="grid grid-cols-7 border-b border-borda bg-superficie-2 text-center text-sm font-semibold text-texto-suave">
        {SEMANA.map((s) => (
          <div key={s} className="py-2">
            {s}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: primeiro }, (_, i) => (
          <div key={`v${i}`} aria-hidden="true" className="min-h-24 border-b border-r border-borda bg-superficie-2/50" />
        ))}
        {dias.map((d) => {
          const numero = Number(d.dia.slice(8));
          const ehHoje = d.dia === hoje;
          const aberto = d.dia === diaAberto;
          const mostrados = d.itens.length > MAX_NA_CELULA ? d.itens.slice(0, MAX_NA_CELULA - 1) : d.itens;
          const resto = d.itens.length - mostrados.length;
          return (
            <div key={d.dia} className="min-h-24 border-b border-r border-borda p-0">
              <Link
                href={d.href}
                ref={(el) => {
                  if (el) links.current.set(d.dia, el);
                }}
                tabIndex={foco === d.dia ? 0 : -1}
                onFocus={() => setFoco(d.dia)}
                onKeyDown={(e) => aoTeclar(e, d.dia)}
                aria-current={ehHoje ? 'date' : undefined}
                aria-label={`${numero} de ${new Date(`${d.dia}T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' })}${ehHoje ? ', hoje' : ''}, ${
                  d.itens.length === 0 ? 'nada marcado' : d.itens.length === 1 ? '1 item' : `${d.itens.length} itens`
                }`}
                className={`block h-full min-h-24 p-1.5 hover:bg-destaque-suave ${aberto ? 'bg-destaque-suave' : ''}`}
              >
                <span
                  className={`mb-1 inline-flex size-6 items-center justify-center rounded-full text-sm tabular-nums ${
                    ehHoje ? 'bg-primario font-bold text-sobre-primario' : 'font-semibold text-texto'
                  }`}
                >
                  {numero}
                </span>
                <ul className="space-y-0.5">
                  {mostrados.map((it, i) => {
                    const Icone = ICONES[it.icone];
                    return (
                      <li key={i} data-app={it.app} className="flex items-center gap-1 text-xs leading-tight text-texto">
                        <span className="shrink-0 text-destaque">
                          <Icone tamanho={14} />
                        </span>
                        <span className="sr-only">{it.nomeDoApp}: </span>
                        <span className="truncate">{it.titulo}</span>
                      </li>
                    );
                  })}
                  {resto > 0 && <li className="text-xs font-semibold text-texto-suave">+{resto}</li>}
                </ul>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
