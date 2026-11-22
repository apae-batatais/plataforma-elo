/**
 * Tarefa da rotina que cria e envia os avisos e o lembrete por e-mail da Comunicação (ADR-027). Somente servidor.
 * Demonstração: o enviador é o de memória (nada sai de verdade) e o endereço do Elo é fictício.
 */
import 'server-only';
import { rodarAvisos } from '@/modulos/comunicacao/aplicacao/avisos';
import { configGeral } from './instituicao';
import { urlPublicaDoElo } from './publicacoes';
import type { TarefaDaRotina } from './tarefa-da-rotina';

export const tarefaDeAvisosDaComunicacao: TarefaDaRotina = {
  id: 'comunicacao.avisos',
  executar: (app, agora) => rodarAvisos(app.planilhas, { email: app.email, urlBase: configGeral().modo === 'demonstracao' ? 'https://demonstracao.exemplo.local' : urlPublicaDoElo() }, agora),
};
