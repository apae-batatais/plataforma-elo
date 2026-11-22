/**
 * Plano de contas por exercício (proposta #221, ADR-036): regras puras, sem leitura nem gravação.
 *
 * O plano é gravado em lotes completos. Para uma data vale o lote mais recente cuja vigência já começou.
 * Áreas, Grupos de Contas e Itens são cadastros únicos; "existe no exercício" é estar no plano daquele ano.
 */
export interface LinhaPlano {
  area_id: string;
  grupo_id: string;
  /** Vazio = grupo presente na área sem itens habilitados. */
  item_id: string | null;
}

export interface LinhaGravada extends LinhaPlano {
  exercicio: number;
  lote: string;
  vigencia: string;
}

export interface VersaoPlano {
  lote: string;
  vigencia: string;
  linhas: LinhaPlano[];
}

export class ErroPlanoContas extends Error {}

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Versões (lotes) de um exercício, da mais antiga para a mais nova (vigência e, no empate, ordem de gravação). */
export function versoesDoExercicio(gravadas: LinhaGravada[], ano: number): VersaoPlano[] {
  const lotes = new Map<string, VersaoPlano>();
  for (const l of gravadas) {
    if (l.exercicio !== ano) continue;
    let v = lotes.get(l.lote);
    if (!v) {
      v = { lote: l.lote, vigencia: l.vigencia, linhas: [] };
      lotes.set(l.lote, v);
    }
    v.linhas.push({ area_id: l.area_id, grupo_id: l.grupo_id, item_id: l.item_id });
  }
  // `Array.sort` é estável: a ordem de gravação desempata a vigência.
  return [...lotes.values()].sort((a, b) => a.vigencia.localeCompare(b.vigencia));
}

/** Versão que vale na data (AAAA-MM-DD); `undefined` se ainda não havia plano. */
export function versaoVigente(gravadas: LinhaGravada[], ano: number, data: string): VersaoPlano | undefined {
  return versoesDoExercicio(gravadas, ano).filter((v) => v.vigencia <= data).at(-1);
}

/** Plano do fim do exercício: a versão mais recente, qualquer que seja a vigência dentro do ano. */
export function versaoDoFimDoAno(gravadas: LinhaGravada[], ano: number): VersaoPlano | undefined {
  return versaoVigente(gravadas, ano, `${ano}-12-31`);
}

export function vigenciaDentroDoAno(ano: number, vigencia: string): boolean {
  if (!DATA.test(vigencia) || !vigencia.startsWith(`${ano}-`)) return false;
  return new Date(`${vigencia}T00:00:00Z`).toISOString().slice(0, 10) === vigencia;
}

/** Padrão: 1º de janeiro; se o exercício já começou, hoje. `hoje` é AAAA-MM-DD (de Brasília). */
export function vigenciaPadrao(ano: number, hoje: string): string {
  const inicio = `${ano}-01-01`;
  return hoje > inicio && hoje.startsWith(`${ano}-`) ? hoje : inicio;
}

export interface ContextoPlano {
  areasAtivas: Set<string>;
  gruposAtivos: Set<string>;
  itensAtivos: Set<string>;
  /** item → grupo a que pertence */
  grupoDoItem: Map<string, string>;
}

/** Confere o plano antes de gravar. Devolve as mensagens (vazio = pode gravar). */
export function validarPlano(linhas: LinhaPlano[], ctx: ContextoPlano): string[] {
  const erros = new Set<string>();
  if (linhas.length === 0) return ['O plano está vazio. Marque ao menos um grupo em uma área.'];
  const pares = new Set<string>();
  const itens = new Set<string>();
  const comItem = new Set<string>();
  const semItem = new Set<string>();
  for (const l of linhas) {
    if (!ctx.areasAtivas.has(l.area_id)) erros.add('Há uma área encerrada ou inexistente no plano.');
    if (!ctx.gruposAtivos.has(l.grupo_id)) erros.add('Há um grupo de contas encerrado ou inexistente no plano.');
    const par = `${l.area_id}|${l.grupo_id}`;
    if (l.item_id) {
      if (!ctx.itensAtivos.has(l.item_id)) erros.add('Há um item encerrado ou inexistente no plano.');
      else if (ctx.grupoDoItem.get(l.item_id) !== l.grupo_id) erros.add('Há um item no grupo errado: cada item pertence a um só grupo.');
      const k = `${par}|${l.item_id}`;
      if (itens.has(k)) erros.add('Há um item repetido na mesma área e grupo.');
      itens.add(k);
      comItem.add(par);
    } else {
      if (semItem.has(par)) erros.add('Há um grupo repetido na mesma área.');
      semItem.add(par);
    }
    pares.add(par);
  }
  for (const par of comItem) {
    if (semItem.has(par)) erros.add('Um grupo aparece ao mesmo tempo com e sem itens na mesma área.');
  }
  return [...erros];
}

/** Monta as linhas a partir do que foi marcado: grupo sem itens vira uma linha sem item. */
export function linhasDoMarcado(grupos: { area_id: string; grupo_id: string }[], itens: { area_id: string; grupo_id: string; item_id: string }[]): LinhaPlano[] {
  const chaves = new Map<string, { area_id: string; grupo_id: string }>();
  for (const g of grupos) chaves.set(`${g.area_id}|${g.grupo_id}`, g);
  // Marcar um item inclui o seu grupo na área.
  for (const i of itens) chaves.set(`${i.area_id}|${i.grupo_id}`, { area_id: i.area_id, grupo_id: i.grupo_id });
  const saida: LinhaPlano[] = [];
  const vistos = new Set<string>();
  for (const [k, g] of chaves) {
    const seus = itens.filter((i) => `${i.area_id}|${i.grupo_id}` === k);
    if (seus.length === 0) saida.push({ ...g, item_id: null });
    for (const i of seus) {
      const kk = `${k}|${i.item_id}`;
      if (vistos.has(kk)) continue;
      vistos.add(kk);
      saida.push({ ...g, item_id: i.item_id });
    }
  }
  return saida;
}

export interface ResumoPlano {
  areas: number;
  grupos: number;
  itens: number;
}

export function resumirPlano(linhas: LinhaPlano[]): ResumoPlano {
  return {
    areas: new Set(linhas.map((l) => l.area_id)).size,
    grupos: new Set(linhas.map((l) => l.grupo_id)).size,
    itens: new Set(linhas.filter((l) => l.item_id).map((l) => l.item_id)).size,
  };
}

/** Os dois planos têm o mesmo conteúdo (ignora a ordem das linhas). */
export function planosIguais(a: LinhaPlano[], b: LinhaPlano[]): boolean {
  const k = (l: LinhaPlano) => `${l.area_id}|${l.grupo_id}|${l.item_id ?? ''}`;
  const sa = new Set(a.map(k));
  const sb = new Set(b.map(k));
  return sa.size === sb.size && [...sa].every((x) => sb.has(x));
}
