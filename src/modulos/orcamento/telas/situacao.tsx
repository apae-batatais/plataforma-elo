/** Situação escrita (nunca só cor) dos sinais e das conferências da Tesouraria (1D.2). */
import type { ReactNode } from 'react';
import { Etiqueta } from '@/ui/pagina';
import { IconeAtencao, IconeCerto, IconeErro, IconeInfo } from '@/ui/icones';
import type { SituacaoSinal } from '../dominio/reserva';
import { reais, rotuloMes } from './formato';

const ROTULO: Record<SituacaoSinal, string> = { critico: 'Crítico', atencao: 'Atenção', ok: 'Ok', sem_dado: 'Sem dado' };
const TIPO = { critico: 'erro', atencao: 'atencao', ok: 'sucesso', sem_dado: 'neutro' } as const;
const ICONE = { critico: IconeErro, atencao: IconeAtencao, ok: IconeCerto, sem_dado: IconeInfo } as const;

/** Etiqueta com ícone e texto: "Ok", "Atenção", "Crítico" ou "Sem dado". */
export function EtiquetaDeSinal({ situacao }: { situacao: SituacaoSinal }) {
  const Icone = ICONE[situacao];
  return (
    <Etiqueta tipo={TIPO[situacao]}>
      <Icone tamanho={14} className="mr-1" />
      {ROTULO[situacao]}
    </Etiqueta>
  );
}

const um = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

/** O valor de um sinal no formato dele ("12,6 meses", "R$ 14.500,00", "58,2%", "+3,1 pontos"). */
export function valorDoSinal(valor: number, unidade: 'meses' | 'moeda' | 'percentual' | 'pontos'): string {
  if (unidade === 'moeda') return reais(valor);
  if (unidade === 'meses') return `${um(valor)} ${valor === 1 ? 'mês' : 'meses'}`;
  if (unidade === 'percentual') return `${um(valor)}%`;
  return `${valor > 0 ? '+' : ''}${um(valor)} pontos`;
}

/** Resultado de uma conferência: "Confere", "Diferença de R$ X" ou "Faltam dados: saldo de agosto de 2026". */
export function ResultadoDaConferencia({
  situacao,
  diferenca,
  faltam,
  acao,
}: {
  situacao: 'confere' | 'diferenca' | 'sem_dado';
  diferenca: number | null;
  faltam: { o: 'saldo' | 'realizado'; mes: string }[];
  acao?: ReactNode;
}) {
  if (situacao === 'confere') {
    return (
      <span className="inline-flex items-center gap-1.5 font-semibold text-sucesso">
        <IconeCerto tamanho={16} /> Confere
      </span>
    );
  }
  if (situacao === 'diferenca') {
    return (
      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="inline-flex items-center gap-1.5 font-semibold text-aviso">
          <IconeAtencao tamanho={16} /> Diferença de {reais(Math.abs(diferenca ?? 0))}
        </span>
        <span className="text-texto-suave">{(diferenca ?? 0) > 0 ? '(o saldo está acima do esperado)' : '(o saldo está abaixo do esperado)'}</span>
        {acao}
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-texto-suave">
      <IconeInfo tamanho={16} /> Faltam dados: {faltam.map((f) => `${f.o === 'saldo' ? 'saldo' : 'realizado'} de ${rotuloMes(f.mes)}`).join(', ')}
      {acao}
    </span>
  );
}
