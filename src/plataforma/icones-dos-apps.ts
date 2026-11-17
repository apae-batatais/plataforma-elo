/**
 * Ícone de cada app, num mapa só: o menu, o cartão do início e as pendências usam este.
 * A cor de cada app fica em globals.css (data-app) e na identidade visual.
 */
import type { NomeIcone } from '@/ui/icones';

export const ICONE_DO_APP: Record<string, NomeIcone> = {
  orcamento: 'orcamento',
  requisicoes: 'requisicoes',
  comunicacao: 'comunicacao',
  avaliacao: 'avaliacao',
  parcerias: 'parcerias',
  projetos: 'projetos',
  educacao: 'educacao',
};

export function iconeDoApp(id: string): NomeIcone {
  return ICONE_DO_APP[id] ?? 'planilhas';
}
