/**
 * Tarefa da rotina que envia o aviso por e-mail da Base de Conhecimento (ADR-027). Somente servidor.
 * Demonstração: o enviador é o de memória (nada sai de verdade) e o endereço do Elo é fictício.
 */
import 'server-only';
import { rodarAvisos } from '@/modulos/conhecimento/aplicacao/avisos';
import { configGeral } from './instituicao';
import { urlPublicaDoElo } from './publicacoes';
import type { TarefaDaRotina } from './tarefa-da-rotina';

export const tarefaDeAvisosDoConhecimento: TarefaDaRotina = {
  id: 'conhecimento.avisos',
  executar: (app, agora) => rodarAvisos(app.planilhas, { email: app.email, urlBase: configGeral().modo === 'demonstracao' ? 'https://demonstracao.exemplo.local' : urlPublicaDoElo() }, agora),
};
