/**
 * Ligações entre módulos (ADR-013): um módulo nunca importa outro; a
 * plataforma entrega o que um oferece ao que precisa.
 */
import { gruposDeGastoAtivos } from '@/modulos/orcamento';
import type { CatalogoOrcamento } from '@/modulos/requisicoes';
import type { Planilhas } from '@/nucleo/armazenamento/tabela';

/** Grupos de gasto do Orçamento para o módulo Requisições. */
export const catalogoOrcamento = (p: Planilhas): CatalogoOrcamento => ({ gruposDeGasto: () => gruposDeGastoAtivos(p) });
