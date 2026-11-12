/**
 * Quais apps têm pendência com prazo vencido para esta pessoa (anel que pulsa na tela inicial).
 * Conta como vencida: requisição atrasada na aprovação ou no atendimento e reavaliação atrasada.
 * Só lê, sempre pelos casos de uso dos apps (que passam pelo Autorizador): quem não vê o app
 * ou o dado não recebe o anel.
 */
import { PERM as PERM_AVALIACAO, listarAvaliacoes, painelDaAvaliacao } from '@/modulos/avaliacao/aplicacao/avaliacoes';
import { painelDePrazos } from '@/modulos/requisicoes/aplicacao/requisicoes';
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import type { Planilhas } from '@/nucleo/armazenamento/tabela';

export async function appsComPendenciaVencida(p: Planilhas, quem: Autorizador, opcoes: { agora?: Date } = {}): Promise<Set<string>> {
  const vencidas = new Set<string>();
  // Planilha do app ainda não preparada ou sem acesso: o app simplesmente fica sem anel.
  try {
    if ((await painelDePrazos(p, quem, {}, opcoes)).atrasadas.length > 0) vencidas.add('requisicoes');
  } catch {
    // sem anel
  }
  try {
    const atrasadas = quem.temPermissaoAlgumEscopo(PERM_AVALIACAO.avaliar)
      ? (await listarAvaliacoes(p, quem, opcoes)).some((a) => a.reavaliacao?.situacao === 'atrasada')
      : ((await painelDaAvaliacao(p, quem, {}, opcoes)).reavaliacao.atrasadas ?? 0) > 0;
    if (atrasadas) vencidas.add('avaliacao');
  } catch {
    // sem anel
  }
  return vencidas;
}
