import type { DadosRequisicao } from '../aplicacao/requisicoes';
import type { ProjetoEscolhivel } from '../dominio/requisicao';

export interface OpcoesFicha {
  tipos: {
    id: string;
    nome: string;
    formulario: string;
    descricao: string | null;
    /** Áreas permitidas (vazio = todas) e itens aceitos (vazio = texto livre). */
    areas: string[];
    /** Aceita foto e vídeo. */
    anexos: boolean;
    itens: { id: string; descricao: string; unidade: string }[];
  }[];
  areas: { codigo: string; nome: string }[];
  servicos: { codigo: string; nome: string; area: string | null; areaNome: string }[];
  /** A instituição ativou a pasta de anexos (fotos e vídeo). */
  anexosAtivos: boolean;
  /** Projetos que a pessoa vê e que aceitam compra, entregues pela plataforma. Sem lista, o campo não aparece. */
  projetos?: ProjetoEscolhivel[];
}

/** O que cada ficha de tipo devolve ao casco: só os dados do seu tipo. */
export type SaidaFicha = Pick<DadosRequisicao, 'itens' | 'detalhes'>;

export interface PropsFicha {
  /** Requisição que está sendo ajustada (vazio ao abrir uma nova). */
  inicial?: DadosRequisicao;
  tipo?: OpcoesFicha['tipos'][number];
  aoMudar: (saida: SaidaFicha) => void;
}
