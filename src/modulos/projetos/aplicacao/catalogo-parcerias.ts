/**
 * Parcerias visto pelo Projetos (ADR-023). O Projetos define a forma; quem entrega as funções é a plataforma
 * (`src/plataforma/ligacoes.ts`), porque um módulo nunca importa outro. Sem dados pessoais.
 * Parcerias desligado = `null`: o projeto funciona e mostra "Ligação indisponível".
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';

export interface PedidoRascunhoDeTermo {
  projetoId: string;
  projetoCodigo: string;
  financiador: string;
  objeto: string;
  servico: string | null;
  inicioPrevisto: string | null;
  fimPrevisto: string | null;
  valorAprovado: number;
}

export interface TermoLigado {
  termoId: string;
  parceiro: string;
  situacao: 'rascunho' | 'em_vigor' | 'encerrado';
  /** Valor atual do termo. */
  valor: number;
  /** Regra L13: vigência, recursos próprios, fontes, cronograma e plano de aplicação. */
  inicio: string | null;
  fim: string | null;
  recursosProprios: number | null;
  fontes: {
    nome: string;
    valorAtual: number;
    cronograma: { mes: string; valor: number }[];
    plano: { categoria: string; valor: number }[];
  }[];
}

export interface CatalogoTermos {
  /** Idempotente por projeto: chamar de novo devolve o termo já criado. */
  criarRascunhoDeTermo(quem: { email: string }, pedido: PedidoRascunhoDeTermo, agora: Date): Promise<{ termoId: string; criado: boolean }>;
  /** Passa pela permissão de Parcerias: sem permissão devolve `null`. */
  termoParaProjeto(quem: Autorizador, termoId: string, agora: Date): Promise<TermoLigado | null>;
}
