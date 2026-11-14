/**
 * Quais grupos do menu ficam abertos. Função pura (com teste):
 * - o grupo da tela atual sempre fica aberto;
 * - nos demais, vale a escolha da pessoa (lembrada no navegador);
 * - sem escolha, ficam recolhidos.
 */
export type EscolhaDeGrupos = Record<string, boolean>;

export function grupoAberto(grupo: string, grupoAtual: string | undefined, escolhas: EscolhaDeGrupos): boolean {
  if (grupo === grupoAtual) return true;
  return escolhas[grupo] ?? false;
}

/** Chave de armazenamento: uma por app e grupo. */
export function chaveDoGrupo(appHref: string, grupo: string): string {
  return `elo-menu-grupo:${appHref}:${grupo}`;
}

/** Itens de um app agrupados por `secao`, na ordem em que aparecem. Sem `secao`, um grupo sem título. */
export function agruparItens<T extends { secao?: string }>(itens: readonly T[]): { titulo?: string; itens: T[] }[] {
  const grupos: { titulo?: string; itens: T[] }[] = [];
  for (const i of itens) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.titulo === i.secao) ultimo.itens.push(i);
    else grupos.push({ titulo: i.secao, itens: [i] });
  }
  return grupos;
}
