/**
 * Para onde vai quem clica em "Orçamento": o Resumo da folha, para quem vê a
 * folha em algum escopo (a Coordenação vê só o seu); os demais (ex.: Compras)
 * vão para o primeiro item do seu menu.
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';

export function veResumoDaFolha(quem: Autorizador): boolean {
  return quem.temPermissaoAlgumEscopo('orcamento.folha.ver');
}
