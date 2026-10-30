/**
 * Situação da estrutura das planilhas de cada instituição, para os avisos à
 * Administração (tela inicial, menu, Acessos e Estrutura). Guardada por 2
 * minutos, por instituição, para não gastar leituras do Google a cada página;
 * "Preparar estrutura" limpa o cache daquela instituição.
 */
import 'server-only';
import { conferirEstrutura, type ConferenciaEstrutura } from '@/nucleo/estrutura/preparar';
import { obterAplicacao } from './aplicacao';
import { ESTRUTURA_DOS_MODULOS } from './registro-modulos';

const guardadas = new Map<string, { em: number; valor: Promise<ConferenciaEstrutura | null> }>();

export async function situacaoDaEstrutura(): Promise<ConferenciaEstrutura | null> {
  const app = await obterAplicacao();
  const atual = guardadas.get(app.instituicao.codigo);
  if (atual && Date.now() - atual.em <= 120_000) return atual.valor;
  // Planilhas ainda em branco ou inacessíveis: as telas próprias já explicam.
  const valor = conferirEstrutura(app.planilhas, ESTRUTURA_DOS_MODULOS).catch(() => null);
  guardadas.set(app.instituicao.codigo, { em: Date.now(), valor });
  return valor;
}

export async function esquecerSituacaoDaEstrutura() {
  const app = await obterAplicacao();
  guardadas.delete(app.instituicao.codigo);
}
