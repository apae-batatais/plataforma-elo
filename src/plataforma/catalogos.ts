/**
 * Catálogos que a plataforma entrega a um app sobre outro app (ADR-013 e ADR-020).
 * Só aqui um módulo "enxerga" os dados de outro; os módulos continuam sem importar uns aos outros.
 */
import type { Planilhas } from '@/nucleo/armazenamento/tabela';
import type { CatalogoParcerias } from '@/modulos/orcamento/aplicacao/catalogo-parcerias';
import { termosParaOrcamento } from '@/modulos/parcerias';
import { MODULOS } from './registro-modulos';

/** Termos de Parcerias para o Orçamento. Parcerias desligado na instituição = catálogo vazio. */
export function catalogoParcerias(p: Planilhas, agora = new Date()): CatalogoParcerias {
  if (!MODULOS.some((m) => m.id === 'parcerias')) return async () => [];
  return () => termosParaOrcamento(p, agora);
}
