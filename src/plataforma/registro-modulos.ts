/**
 * Composição da plataforma: a lista de módulos ativos.
 *
 * Este é o ÚNICO lugar (junto com as rotas em src/app) que conhece os
 * módulos. Para ativar um app novo, importe aqui o manifesto e as tabelas
 * dele. A validação roda ao carregar: um manifesto inconsistente impede o
 * app de subir, em vez de falhar escondido em produção.
 */
import type { z } from 'zod';
import type { DefinicaoTabela } from '@/nucleo/armazenamento/tabela';
import type { Manifesto } from '@/nucleo/modulos/manifesto';
import { validarRegistro } from '@/nucleo/modulos/registro';

// Fase 1: import { manifesto as orcamento, tabelas as tabelasOrcamento } from '@/modulos/orcamento';

export const MODULOS: readonly Manifesto[] = [
  // orcamento,
];

/** Tabelas (abas) de todos os módulos ativos, usadas por "Preparar estrutura". */
export const TABELAS_DOS_MODULOS: readonly DefinicaoTabela<z.ZodObject>[] = [
  // ...tabelasOrcamento,
];

validarRegistro(MODULOS);
