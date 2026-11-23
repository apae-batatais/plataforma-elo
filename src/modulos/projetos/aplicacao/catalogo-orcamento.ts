/**
 * Orçamento visto pelo Projetos (ADR-023, regras L17 e L21). O Projetos define a forma; quem entrega as funções é
 * a plataforma (`src/plataforma/ligacoes.ts`), porque um módulo nunca importa outro. Sem dados pessoais.
 * Orçamento desligado = `null`: o projeto funciona e a ligação com a receita fica pendente e visível.
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';

export interface FonteDeReceita {
  id: string;
  nome: string;
}

export interface PedidoReceitaDoEvento {
  projetoId: string;
  projetoCodigo: string;
  titulo: string;
  fonteId: string;
  valor: number;
  dataEvento: string;
}

export interface CatalogoReceitas {
  /** Fontes de natureza própria. `null` = a pessoa não tem acesso à lista. */
  fontesProprias(quem: Autorizador): Promise<FonteDeReceita[] | null>;
  /** Idempotente por projeto: repetir não duplica. Falha de gravação vira exceção com mensagem em português. */
  registrarReceita(quem: { email: string }, pedido: PedidoReceitaDoEvento): Promise<{ receitaId: string; criada: boolean }>;
  /** Cancelado ou parado: encerra o item (nada é apagado). Devolve se havia item. */
  encerrarReceita(quem: { email: string }, projetoId: string): Promise<boolean>;
}
