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
  /** Espaços ativos para reservar, com os períodos em que estão indisponíveis (ficha de espaço). */
  espacos?: { id: string; nome: string; local: string | null; capacidade: number; indisponiveis: { inicio: string; fim: string }[] }[];
  /** Veículos ativos, com a manutenção prevista e os períodos já pedidos (sem dizer de quem). */
  veiculos?: { id: string; nome: string; placa: string; capacidade: number; manutencaoPrevista: string | null; ocupado: { id: string; saida: string; volta: string }[] }[];
  /** Nome de quem pede: já vem como condutor no pedido de veículo. */
  nomeDoUsuario?: string;
  /** Projetos que a pessoa vê e que aceitam compra, entregues pela plataforma. Sem lista, o campo não aparece. */
  projetos?: ProjetoEscolhivel[];
}

/** O que cada ficha de tipo devolve ao casco: só os dados do seu tipo. */
export type SaidaFicha = Pick<DadosRequisicao, 'itens' | 'detalhes'> & {
  /** A ficha dispensa os centros de custo (reserva cedida para fora da instituição). */
  semCentros?: boolean;
};

export interface PropsFicha {
  /** Requisição que está sendo ajustada (vazio ao abrir uma nova). */
  inicial?: DadosRequisicao;
  tipo?: OpcoesFicha['tipos'][number];
  espacos?: OpcoesFicha['espacos'];
  veiculos?: OpcoesFicha['veiculos'];
  nomeDoUsuario?: string;
  aoMudar: (saida: SaidaFicha) => void;
}
