/**
 * Tarefa da rotina: resumo diário por e-mail de Requisições (ADR-027). Somente servidor.
 * Demonstração: o enviador é o de memória (nada sai de verdade) e o endereço do Elo é fictício.
 */
import 'server-only';
import { rodarResumoDiario } from '@/modulos/requisicoes/aplicacao/resumo';
import { configGeral } from './instituicao';
import { urlPublicaDoElo } from './publicacoes';
import type { TarefaDaRotina } from './tarefa-da-rotina';

export const tarefaDeResumoDeRequisicoes: TarefaDaRotina = {
  id: 'requisicoes.resumo_diario',
  executar: (app, agora) =>
    rodarResumoDiario(app.planilhas, { email: app.email, urlBase: configGeral().modo === 'demonstracao' ? 'https://demonstracao.exemplo.local' : urlPublicaDoElo() }, agora),
};
