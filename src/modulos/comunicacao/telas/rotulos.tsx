/** Etiquetas de situação e urgência do pedido, sempre com texto (a cor nunca é a única pista). */
import { Etiqueta } from '@/ui/pagina';
import { IconeAtencao } from '@/ui/icones';
import { NOME_SITUACAO, type Situacao } from '../dominio/pedido';

const COR: Record<Situacao, 'neutro' | 'sucesso' | 'atencao' | 'erro' | 'info'> = {
  aguardando_revisao: 'info',
  em_revisao: 'info',
  devolvido: 'atencao',
  aguardando_aprovacao: 'info',
  aprovado: 'info',
  agendado: 'info',
  publicado: 'sucesso',
  realizada: 'sucesso',
  recusado: 'erro',
  cancelado: 'neutro',
  juntado: 'neutro',
};

export function EtiquetaSituacao({ situacao }: { situacao: Situacao }) {
  return <Etiqueta tipo={COR[situacao]}>{NOME_SITUACAO[situacao]}</Etiqueta>;
}

export function EtiquetaUrgente() {
  return (
    <Etiqueta tipo="erro">
      <IconeAtencao tamanho={14} className="mr-1" /> Urgente
    </Etiqueta>
  );
}

export const dataHoraBR = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(
    new Date(iso),
  );
