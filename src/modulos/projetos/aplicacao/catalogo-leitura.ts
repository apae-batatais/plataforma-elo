/**
 * Catálogo de leitura de cada app visto pelo Projetos (ADR-013 e ADR-022). O Projetos define a forma; quem
 * entrega as funções é a plataforma (`src/plataforma/ligacoes.ts`), porque um módulo nunca importa outro.
 * Sem dados pessoais. App desligado ou sem leitor = "Ligação indisponível".
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import type { LigacaoLida } from '@/nucleo/ligacoes/ligacao';
import type { AppLigacao } from '../dominio/ligacoes';

/** O que um app devolve sobre um dado ligado. `null` = a pessoa não tem acesso ao dado nesse app. */
export interface ItemLigado {
  nome: string;
  situacao: string | null;
}

export type LeitorLigacao = (quem: Autorizador, referenciaId: string, agora: Date) => Promise<ItemLigado | null>;

/** Compra (requisição) ligada ao projeto: só número, tipo e situação, sem o nome de quem pediu. */
export interface CompraLigada {
  id: string;
  numero: string;
  tipo: string;
  situacaoNome: string;
  enviadaEm: string;
  /** Ainda anda (não foi atendida, recusada nem cancelada). */
  pendente: boolean;
}

/** Pedido de divulgação ligado ao projeto (L20): número, título, tipo e situação, sem o nome de quem pediu. */
export interface DivulgacaoLigada {
  id: string;
  numero: string;
  titulo: string;
  tipoPeca: string;
  situacaoNome: string;
  /** Ainda não foi publicado, recusado nem cancelado. */
  pendente: boolean;
}

export interface CatalogoLeitura {
  /** Um leitor por tipo de ligação; os que faltam aparecem como "Ligação indisponível". */
  leitores: Partial<Record<AppLigacao, LeitorLigacao>>;
  /** As compras apontam para o projeto (não ficam em `LigacoesProjeto`), então vêm direto do app. */
  compras(quem: Autorizador, projetoId: string): Promise<LigacaoLida<CompraLigada[]>>;
  /** Pedidos de divulgação do projeto vêm direto da Comunicação, pelo mesmo motivo. */
  divulgacao(quem: Autorizador, projetoId: string): Promise<LigacaoLida<DivulgacaoLigada[]>>;
}
