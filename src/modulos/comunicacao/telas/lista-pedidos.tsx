/** Lista de pedidos: número, título, tipo, data desejada, urgência e situação. */
import Link from 'next/link';
import { TabelaDados } from '@/ui/tabela-dados';
import type { LinhaPedido } from '../aplicacao/pedidos';
import { NOME_SITUACAO, NOME_TIPO_PECA } from '../dominio/pedido';
import { dataCurta } from './mes';
import { EtiquetaSituacao, EtiquetaUrgente } from './rotulos';

export function ListaPedidos({ linhas, legenda, vazio, comSolicitante = false }: { linhas: LinhaPedido[]; legenda: string; vazio: string; comSolicitante?: boolean }) {
  return (
    <TabelaDados
      legenda={legenda}
      vazio={vazio}
      colunas={[
        { chave: 'numero', rotulo: 'Número' },
        { chave: 'titulo', rotulo: 'Título' },
        { chave: 'tipo', rotulo: 'Tipo de peça' },
        ...(comSolicitante ? [{ chave: 'solicitante', rotulo: 'Quem pediu' }] : []),
        { chave: 'tema', rotulo: 'Tema', secundaria: true },
        { chave: 'data', rotulo: 'Data desejada' },
        { chave: 'urgente', rotulo: 'Urgência' },
        { chave: 'situacao', rotulo: 'Situação' },
      ]}
      linhas={linhas.map((r) => ({
        id: r.id,
        valores: {
          numero: r.numero,
          titulo: r.titulo,
          tipo: NOME_TIPO_PECA[r.tipoPeca],
          solicitante: r.solicitanteNome,
          tema: r.tema ?? 'Fora do calendário',
          data: r.dataDesejada,
          urgente: r.urgente ? 'Urgente' : 'Normal',
          situacao: NOME_SITUACAO[r.situacao],
        },
        celulas: {
          numero: (
            <Link href={`/comunicacao/${r.id}`} className="font-semibold text-destaque hover:underline">
              {r.numero}
            </Link>
          ),
          data: <span className="tabular-nums">{dataCurta(r.dataDesejada)}</span>,
          urgente: r.urgente ? <EtiquetaUrgente /> : <span className="text-texto-suave">Normal</span>,
          situacao: <EtiquetaSituacao situacao={r.situacao} />,
        },
      }))}
    />
  );
}
