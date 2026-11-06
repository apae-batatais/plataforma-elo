import type { Acao } from '../dominio/pedido';

/** As ações que esta tela desenha (a página usa a mesma lista para saber se há o que mostrar). */
export const ACOES_DA_EQUIPE: Acao[] = ['iniciar_revisao', 'enviar_aprovacao', 'devolver', 'recusar', 'juntar', 'aprovar', 'pedir_ajustes'];
