/**
 * Composição da plataforma: a lista de módulos ativos.
 *
 * Este é o ÚNICO lugar (junto com as rotas em src/app) que conhece os
 * módulos. Para ativar um app novo, importe o manifesto dele aqui.
 * A validação roda ao carregar: um manifesto inconsistente impede o
 * app de subir, em vez de falhar escondido em produção.
 */
import type { Manifesto } from '@/nucleo/modulos/manifesto';
import { validarRegistro } from '@/nucleo/modulos/registro';

// Fase 1: import { manifesto as orcamento } from '@/modulos/orcamento/manifesto';
// Fase 2: import { manifesto as assistenciaAvaliacao } from '@/modulos/assistencia-avaliacao/manifesto';

export const MODULOS: readonly Manifesto[] = [
  // orcamento,
  // assistenciaAvaliacao,
];

validarRegistro(MODULOS);
