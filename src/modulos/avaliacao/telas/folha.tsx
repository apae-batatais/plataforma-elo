/**
 * Moldura comum das páginas de impressão: uma folha A4 branca (também no tema
 * escuro), com o cabeçalho do Elo e da instituição e o rodapé de sigilo.
 */
import type { ReactNode } from 'react';
import { SimboloElo } from '@/ui/marca';

export function Folha({
  instituicao,
  titulo,
  subtitulo,
  emitidoPor,
  emitidoEm,
  sigilo,
  children,
}: {
  instituicao: string;
  titulo: string;
  subtitulo?: ReactNode;
  emitidoPor: string;
  emitidoEm: string;
  /** Aviso de sigilo do rodapé. */
  sigilo: string;
  children: ReactNode;
}) {
  return (
    <article className="folha mx-auto max-w-[210mm] rounded-cartao border border-borda px-[12mm] py-[10mm] text-[13px] leading-snug shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
      <header className="mb-4 flex items-start justify-between gap-4 border-b-2 border-destaque pb-3">
        <div>
          <p className="text-xs font-semibold text-destaque">Avaliação Diagnóstica</p>
          <h1 className="text-xl font-bold leading-tight">{titulo}</h1>
          {subtitulo && <p className="mt-0.5 text-texto-suave">{subtitulo}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-right">
          <div>
            <p className="font-bold">{instituicao}</p>
            <p className="text-xs text-texto-suave">Elo · plataforma de gestão</p>
          </div>
          <SimboloElo tamanho={34} />
        </div>
      </header>
      {children}
      <footer className="mt-5 flex flex-wrap justify-between gap-2 border-t border-borda pt-2 text-[11px] text-texto-suave break-inside-avoid">
        <span>{sigilo}</span>
        <span>
          Emitido em {emitidoEm} por {emitidoPor}
        </span>
      </footer>
    </article>
  );
}

/** Data e hora de agora, no horário de Brasília. */
export const agoraBrasilia = () =>
  new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
