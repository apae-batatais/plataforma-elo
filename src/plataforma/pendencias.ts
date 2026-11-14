/**
 * Agrupa as pendências da tela inicial por app, na ordem dos apps do menu;
 * as da plataforma (sem app) vêm num último bloco.
 */
export interface GrupoDePendencias<T> {
  /** Id do app, ou `null` para a plataforma. */
  app: string | null;
  itens: T[];
}

export function agruparPendencias<T extends { app?: string }>(pendencias: readonly T[], ordemDosApps: readonly string[]): GrupoDePendencias<T>[] {
  const grupos: GrupoDePendencias<T>[] = [];
  for (const id of ordemDosApps) {
    const itens = pendencias.filter((p) => p.app === id);
    if (itens.length) grupos.push({ app: id, itens });
  }
  // App fora da ordem do menu (não deveria ocorrer) não some: entra antes da plataforma.
  const conhecidos = new Set(ordemDosApps);
  const outros = pendencias.filter((p) => p.app && !conhecidos.has(p.app));
  for (const id of new Set(outros.map((p) => p.app!))) grupos.push({ app: id, itens: outros.filter((p) => p.app === id) });
  const plataforma = pendencias.filter((p) => !p.app);
  if (plataforma.length) grupos.push({ app: null, itens: plataforma });
  return grupos;
}
