/**
 * Lista de requisições com número, tipo, situação, prazo da etapa atual e centros.
 */
import Link from 'next/link';
import { Etiqueta } from '@/ui/pagina';
import { TabelaDados } from '@/ui/tabela-dados';
import type { LinhaRequisicao } from '../aplicacao/requisicoes';
import { URGENCIA_CURTA, type Situacao, type Urgencia } from '../dominio/requisicao';
import { textoHoras } from '../dominio/sla';

const PESO_URGENCIA: Record<Urgencia, number> = { critica: 4, alta: 3, media: 2, baixa: 1 };
const COR_URGENCIA: Record<Urgencia, 'erro' | 'atencao' | 'info' | 'neutro'> = { critica: 'erro', alta: 'atencao', media: 'info', baixa: 'neutro' };

const COR: Record<Situacao, 'neutro' | 'sucesso' | 'atencao' | 'erro' | 'info'> = {
  enviada: 'info',
  devolvida: 'atencao',
  aprovada: 'info',
  recusada: 'erro',
  em_atendimento: 'info',
  atendida: 'sucesso',
  atendida_parcial: 'atencao',
  cancelada: 'neutro',
};

export const dataHora = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso));

export function EtiquetaSituacao({ situacao, nome }: { situacao: Situacao; nome: string }) {
  return <Etiqueta tipo={COR[situacao]}>{nome}</Etiqueta>;
}

export function ListaRequisicoes({
  linhas,
  legenda,
  vazio,
  comRequisitante = true,
}: {
  linhas: LinhaRequisicao[];
  legenda: string;
  vazio: string;
  comRequisitante?: boolean;
}) {
  const comUrgencia = linhas.some((r) => r.urgencia);
  return (
    <TabelaDados
      legenda={legenda}
      vazio={vazio}
      colunas={[
        { chave: 'numero', rotulo: 'Número' },
        { chave: 'tipo', rotulo: 'Tipo' },
        ...(comRequisitante ? [{ chave: 'requisitante', rotulo: 'Quem pediu' }] : []),
        { chave: 'centros', rotulo: 'Centros de custo', secundaria: true },
        { chave: 'enviada', rotulo: 'Enviada em' },
        ...(comUrgencia ? [{ chave: 'urgencia', rotulo: 'Urgência', tipo: 'numero' as const }] : []),
        { chave: 'situacao', rotulo: 'Situação' },
        { chave: 'prazo', rotulo: 'Prazo da etapa' },
      ]}
      linhas={linhas.map((r) => ({
        id: r.id,
        valores: {
          numero: r.numero,
          tipo: r.tipo,
          requisitante: r.requisitante,
          centros: r.centros,
          enviada: r.enviadaEm.slice(0, 16),
          situacao: r.situacaoNome,
          urgencia: r.urgencia ? PESO_URGENCIA[r.urgencia] : null,
          prazo: r.prazo ? (r.prazo.situacao === 'atrasada' ? 'Atrasada' : 'No prazo') : '',
        },
        celulas: {
          numero: (
            <Link href={`/requisicoes/${r.id}`} className="font-semibold text-destaque hover:underline">
              {r.numero}
            </Link>
          ),
          enviada: <span className="tabular-nums">{dataHora(r.enviadaEm)}</span>,
          urgencia: r.urgencia ? (
            <Etiqueta tipo={COR_URGENCIA[r.urgencia]}>{URGENCIA_CURTA[r.urgencia]}</Etiqueta>
          ) : (
            <span className="text-texto-suave">—</span>
          ),
          situacao: (
            <span className="flex flex-col items-start gap-1">
              <EtiquetaSituacao situacao={r.situacao} nome={r.situacaoNome} />
              {r.situacao === 'enviada' && r.aprovacao === 'diretoria' && <span className="text-xs text-texto-suave">pela Diretoria</span>}
            </span>
          ),
          prazo: r.prazo ? (
            <span className={`text-sm ${r.prazo.situacao === 'atrasada' ? 'font-semibold text-erro' : 'text-texto-suave'}`}>
              {r.prazo.situacao === 'atrasada' ? 'Atrasada' : 'No prazo'} · {r.prazo.etapa}
              <span className="block text-xs">
                {textoHoras(r.prazo.horas)} de {textoHoras(r.prazo.limite)}
              </span>
            </span>
          ) : (
            <span className="text-texto-suave">—</span>
          ),
        },
      }))}
    />
  );
}
