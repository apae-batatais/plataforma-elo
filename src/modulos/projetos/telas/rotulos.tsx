import { Etiqueta } from '@/ui/pagina';
import { NOME_ETAPA, type Etapa } from '../dominio/projeto';

const TIPO: Record<Etapa, 'neutro' | 'sucesso' | 'atencao' | 'erro' | 'info'> = {
  rascunho: 'neutro',
  aguardando_responsavel: 'atencao',
  ideia: 'info',
  em_porta: 'atencao',
  fase_1: 'sucesso',
  fase_2: 'sucesso',
  fase_3: 'sucesso',
  implementacao: 'sucesso',
  parado: 'erro',
  cancelado: 'neutro',
};

export const EtiquetaEtapa = ({ etapa }: { etapa: Etapa }) => <Etiqueta tipo={TIPO[etapa]}>{NOME_ETAPA[etapa]}</Etiqueta>;

export const moeda = (v: number | null) => (v === null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
