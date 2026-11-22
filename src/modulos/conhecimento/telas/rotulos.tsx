import { Etiqueta } from '@/ui/pagina';
import { ROTULO_SITUACAO, type SituacaoDaPessoa } from '../dominio/publicacao';

export const formatarData = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' }) : '—';

export const formatarDataHora = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
    : '—';

const TIPO: Record<SituacaoDaPessoa, 'neutro' | 'atencao' | 'sucesso'> = {
  sem_exigencia: 'neutro',
  pendente: 'atencao',
  precisa_renovar: 'atencao',
  em_dia: 'sucesso',
};

export function EtiquetaDaPessoa({ situacao, vencida }: { situacao: SituacaoDaPessoa; vencida?: boolean }) {
  if (vencida) return <Etiqueta tipo="erro">{ROTULO_SITUACAO[situacao]}, vencida</Etiqueta>;
  return <Etiqueta tipo={TIPO[situacao]}>{ROTULO_SITUACAO[situacao]}</Etiqueta>;
}

export const FALTA: Record<SituacaoDaPessoa, string> = {
  sem_exigencia: '',
  pendente: 'Dar ciência',
  precisa_renovar: 'Dar ciência de novo (versão nova)',
  em_dia: '',
};
