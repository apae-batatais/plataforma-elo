/**
 * Famílias de apps no menu e no início (ADR-037): um mapa só, com nome, ícone, descrição e a ordem dos apps.
 * O módulo só diz a qual família pertence (`familia` no manifesto); quem conhece os ids é esta composição.
 */
import type { NomeIcone } from '@/ui/icones';

export interface Familia {
  nome: string;
  icone: NomeIcone;
  descricao: string;
  /** Ordem dos apps dentro da família (não é alfabética). Apps fora da lista vão para o fim. */
  apps: readonly string[];
}

export const FAMILIAS: Record<string, Familia> = {
  avaliacoes: {
    nome: 'Avaliações',
    icone: 'avaliacoes',
    descricao: 'Avaliação de evolução das pessoas atendidas: Assistência Social, Educação e Saúde.',
    apps: ['avaliacao', 'educacao', 'saude'],
  },
};

/** Ordena os apps de uma família pela ordem do mapa. */
export function ordenarNaFamilia<T extends { id: string }>(familia: string, apps: readonly T[]): T[] {
  const ordem = FAMILIAS[familia]?.apps ?? [];
  const pos = (id: string) => (ordem.includes(id) ? ordem.indexOf(id) : ordem.length);
  return [...apps].sort((a, b) => pos(a.id) - pos(b.id));
}

/**
 * Agrupa apps na ordem do menu: a família ocupa o lugar do primeiro app dela;
 * app sem família (ou de família desconhecida) fica solto.
 */
export type ItemAgrupado<T> = { tipo: 'app'; app: T } | { tipo: 'familia'; id: string; familia: Familia; apps: T[] };

export function agruparPorFamilia<T extends { id: string; familia?: string }>(apps: readonly T[]): ItemAgrupado<T>[] {
  const saida: ItemAgrupado<T>[] = [];
  const familias = new Map<string, Extract<ItemAgrupado<T>, { tipo: 'familia' }>>();
  for (const app of apps) {
    const f = app.familia ? FAMILIAS[app.familia] : undefined;
    if (!f || !app.familia) {
      saida.push({ tipo: 'app', app });
      continue;
    }
    const existente = familias.get(app.familia);
    if (existente) existente.apps.push(app);
    else {
      const novo = { tipo: 'familia' as const, id: app.familia, familia: f, apps: [app] };
      familias.set(app.familia, novo);
      saida.push(novo);
    }
  }
  for (const g of familias.values()) g.apps = ordenarNaFamilia(g.id, g.apps);
  return saida;
}
