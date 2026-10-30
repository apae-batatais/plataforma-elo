/**
 * Situação da estrutura das planilhas para os avisos à Administração
 * (tela inicial, menu, Acessos e Estrutura). Guardada por 2 minutos para não
 * gastar leituras do Google a cada página; "Preparar estrutura" limpa o cache.
 */
import 'server-only';
import { conferirEstrutura, type ConferenciaEstrutura } from '@/nucleo/estrutura/preparar';
import { obterAplicacao } from './aplicacao';
import { ESTRUTURA_DOS_MODULOS } from './registro-modulos';

let guardada: { em: number; valor: Promise<ConferenciaEstrutura | null> } | undefined;

export function situacaoDaEstrutura(): Promise<ConferenciaEstrutura | null> {
  if (!guardada || Date.now() - guardada.em > 120_000) {
    guardada = {
      em: Date.now(),
      valor: obterAplicacao()
        .then((app) => conferirEstrutura(app.planilhas, ESTRUTURA_DOS_MODULOS))
        // Planilhas ainda em branco ou inacessíveis: as telas próprias já explicam.
        .catch(() => null),
    };
  }
  return guardada.valor;
}

export function esquecerSituacaoDaEstrutura() {
  guardada = undefined;
}
