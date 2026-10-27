/**
 * Avisos dentro da página. A cor nunca é a única pista: sempre há ícone e
 * texto dizendo o que aconteceu e o que fazer.
 */
import type { ReactNode } from 'react';
import { IconeAtencao, IconeCerto, IconeErro, IconeInfo } from './icones';

export type TipoAviso = 'info' | 'sucesso' | 'atencao' | 'erro';

const ESTILO: Record<TipoAviso, { classe: string; Icone: typeof IconeInfo }> = {
  info: { classe: 'bg-destaque-suave text-texto border-destaque/30', Icone: IconeInfo },
  sucesso: { classe: 'bg-sucesso-fundo text-sucesso border-sucesso/30', Icone: IconeCerto },
  atencao: { classe: 'bg-aviso-fundo text-aviso border-aviso/30', Icone: IconeAtencao },
  erro: { classe: 'bg-erro-fundo text-erro border-erro/30', Icone: IconeErro },
};

export function Aviso({ tipo = 'info', titulo, children, acao }: { tipo?: TipoAviso; titulo?: ReactNode; children?: ReactNode; acao?: ReactNode }) {
  const { classe, Icone } = ESTILO[tipo];
  return (
    <div role={tipo === 'erro' || tipo === 'atencao' ? 'alert' : 'status'} className={`flex gap-3 rounded-lg border p-4 text-sm ${classe}`}>
      <Icone className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1">
        {titulo && <p className="font-semibold">{titulo}</p>}
        {children && <div>{children}</div>}
        {acao && <div className="pt-1">{acao}</div>}
      </div>
    </div>
  );
}
