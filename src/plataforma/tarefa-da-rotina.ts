import type { Aplicacao } from './aplicacao';

export interface TarefaDaRotina {
  /** Identificador estável, usado no resultado (ex.: "comunicacao.envios"). */
  id: string;
  /** Roda a tarefa da instituição; devolve contagens (ex.: { enviados: 2 }). */
  executar(app: Aplicacao, agora: Date): Promise<Record<string, number>>;
}
