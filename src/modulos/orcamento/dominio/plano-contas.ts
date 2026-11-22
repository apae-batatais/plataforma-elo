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

// ---------------------------------------------------------------------------
// Lançamentos orientados pelo plano (entrega 2): o plano só orienta, nunca bloqueia.
// ---------------------------------------------------------------------------

/** Plano a usar ao lançar: o vigente na data (limitada ao ano); sem vigente ainda, a versão mais recente do ano. */
export function versaoParaLancar(gravadas: LinhaGravada[], ano: number, hoje: string): VersaoPlano | undefined {
  const data = hoje < `${ano}-01-01` ? `${ano}-01-01` : hoje > `${ano}-12-31` ? `${ano}-12-31` : hoje;
  return versaoVigente(gravadas, ano, data) ?? versoesDoExercicio(gravadas, ano).at(-1);
}

export interface ItemDoGrupo {
  id: string;
  nome: string;
  codigo: string | null;
  grupo_id: string;
}

/** Itens do grupo separados em "habilitados" (na área escolhida, ou em qualquer área se não há área) e "outros". Sem plano, todos são habilitados. */
export function itensParaEscolher(
  itens: ItemDoGrupo[],
  grupoId: string,
  areaId: string | null,
  linhas: LinhaPlano[] | null,
): { habilitados: ItemDoGrupo[]; outros: ItemDoGrupo[] } {
  const doGrupo = itens.filter((i) => i.grupo_id === grupoId);
  if (!linhas) return { habilitados: doGrupo, outros: [] };
  const ok = new Set(linhas.filter((l) => l.grupo_id === grupoId && l.item_id && (!areaId || l.area_id === areaId)).map((l) => l.item_id as string));
  return { habilitados: doGrupo.filter((i) => ok.has(i.id)), outros: doGrupo.filter((i) => !ok.has(i.id)) };
}

/**
 * Aviso (texto) quando Grupo, Item ou Área estão fora do plano. `null` = sem aviso (inclui "sem plano no exercício"
 * e "sem item nem área escolhidos").
 */
export function avisoDoPlano(
  escolha: { grupo_id: string | null; item_id: string | null; area_id: string | null },
  linhas: LinhaPlano[] | null,
  ano: number,
): string | null {
  if (!linhas || (!escolha.item_id && !escolha.area_id)) return null;
  const foraDe = `não está habilitado para esta área em ${ano}`;
  if (escolha.area_id && !linhas.some((l) => l.area_id === escolha.area_id)) return `Esta área não está no plano de ${ano}.`;
  if (escolha.area_id && escolha.grupo_id && !linhas.some((l) => l.area_id === escolha.area_id && l.grupo_id === escolha.grupo_id)) {
    return `Este grupo ${foraDe}.`;
  }
  if (escolha.item_id) {
    const noPlano = linhas.some((l) => l.item_id === escolha.item_id && (!escolha.area_id || l.area_id === escolha.area_id));
    if (!noPlano) return escolha.area_id ? `Este item ${foraDe}.` : `Este item não está no plano de ${ano}.`;
  }
  return null;
}

/** Erros de dado (não de plano): o item precisa existir e ser do grupo escolhido; a área precisa existir. */
export function conferirItemEArea(
  dados: { grupo_id: string | null; item_id: string | null; area_plano_id: string | null },
  itens: { id: string; grupo_id: string; ativo: boolean }[],
  areas: { id: string; ativo: boolean }[],
  atual: { item_id: string | null; area_plano_id: string | null } = { item_id: null, area_plano_id: null },
): string[] {
  const erros: string[] = [];
  if (dados.item_id) {
    const i = itens.find((x) => x.id === dados.item_id);
    if (!i) erros.push('O item contábil escolhido não existe.');
    else if (!dados.grupo_id || i.grupo_id !== dados.grupo_id) erros.push('O item contábil escolhido é de outro grupo de contas. Escolha um item do grupo.');
    else if (!i.ativo && dados.item_id !== atual.item_id) erros.push('O item contábil escolhido está excluído.');
  }
  if (dados.area_plano_id) {
    const a = areas.find((x) => x.id === dados.area_plano_id);
    if (!a) erros.push('A área do plano escolhida não existe.');
    else if (!a.ativo && dados.area_plano_id !== atual.area_plano_id) erros.push('A área do plano escolhida está excluída.');
  }
  return erros;
}

// ---------------------------------------------------------------------------
// Comparar exercícios e divergência de área (entrega 3): só leitura.
// ---------------------------------------------------------------------------

export interface ItemComparado {
  area_id: string;
  grupo_id: string;
  /** Vazio quando a diferença é de grupo presente na área (sem item). */
  item_id: string | null;
}

export interface MudouDeGrupo {
  area_id: string;
  item_id: string;
  de_grupo_id: string;
  para_grupo_id: string;
}

export interface ComparacaoPlanos {
  areasEntraram: string[];
  areasSairam: string[];
  /** Grupos (por área) que entraram ou saíram; só os de áreas presentes nos dois planos ou já contados na área. */
  gruposEntraram: { area_id: string; grupo_id: string }[];
  gruposSairam: { area_id: string; grupo_id: string }[];
  itensEntraram: ItemComparado[];
  itensSairam: ItemComparado[];
  mudaramDeGrupo: MudouDeGrupo[];
  /** Os dois planos têm o mesmo conteúdo. */
  iguais: boolean;
}

/** Compara dois planos (o `antes` e o `depois`, normalmente o vigente no fim de cada exercício). */
export function compararPlanos(antes: LinhaPlano[], depois: LinhaPlano[]): ComparacaoPlanos {
  const conj = <T,>(l: LinhaPlano[], f: (x: LinhaPlano) => T | null, chave: (t: T) => string) => {
    const m = new Map<string, T>();
    for (const x of l) {
      const v = f(x);
      if (v !== null) m.set(chave(v), v);
    }
    return m;
  };
  const diff = <T,>(a: Map<string, T>, b: Map<string, T>) => [...b].filter(([k]) => !a.has(k)).map(([, v]) => v);

  const areasA = conj(antes, (l) => l.area_id, (x) => x);
  const areasD = conj(depois, (l) => l.area_id, (x) => x);
  const gruposA = conj(antes, (l) => ({ area_id: l.area_id, grupo_id: l.grupo_id }), (g) => `${g.area_id}|${g.grupo_id}`);
  const gruposD = conj(depois, (l) => ({ area_id: l.area_id, grupo_id: l.grupo_id }), (g) => `${g.area_id}|${g.grupo_id}`);

  // Item por (área, item): o grupo em que está em cada plano.
  const itensA = conj(antes, (l) => (l.item_id ? { area_id: l.area_id, grupo_id: l.grupo_id, item_id: l.item_id } : null), (i) => `${i.area_id}|${i.item_id}`);
  const itensD = conj(depois, (l) => (l.item_id ? { area_id: l.area_id, grupo_id: l.grupo_id, item_id: l.item_id } : null), (i) => `${i.area_id}|${i.item_id}`);
  const mudaramDeGrupo: MudouDeGrupo[] = [];
  const mudou = new Set<string>();
  for (const [k, a] of itensA) {
    const d = itensD.get(k);
    if (d && d.grupo_id !== a.grupo_id) {
      mudaramDeGrupo.push({ area_id: a.area_id, item_id: a.item_id, de_grupo_id: a.grupo_id, para_grupo_id: d.grupo_id });
      mudou.add(k);
    }
  }
  const semMudanca = (l: { area_id: string; item_id: string }[]) => l.filter((i) => !mudou.has(`${i.area_id}|${i.item_id}`));

  const r = {
    areasEntraram: diff(areasA, areasD),
    areasSairam: diff(areasD, areasA),
    gruposEntraram: diff(gruposA, gruposD),
    gruposSairam: diff(gruposD, gruposA),
    itensEntraram: semMudanca(diff(itensA, itensD)) as ItemComparado[],
    itensSairam: semMudanca(diff(itensD, itensA)) as ItemComparado[],
    mudaramDeGrupo,
  };
  return { ...r, iguais: planosIguais(antes, depois) };
}

export interface LancamentoParaDivergencia {
  origem: 'despesa' | 'realizado';
  id: string;
  servico: string | null;
  area_plano_id: string | null;
  /** Valor em centavos (inteiro). */
  centavos: number;
}

export interface ParDivergente {
  area_plano_id: string;
  /** Código da área do serviço. */
  area_servico: string;
  centavos: number;
  lancamentos: LancamentoParaDivergencia[];
}

export interface Divergencias {
  pares: ParDivergente[];
  totalCentavos: number;
  /** Lançamentos sem área do plano: nunca contam como divergência nem como zero. */
  semAreaDoPlano: number;
}

/**
 * Agrupa os lançamentos cuja área do plano difere da área do serviço. `coincide` diz se a área do plano
 * e a área do serviço (código) são a mesma. O filtro de escopo deve ser feito ANTES.
 */
export function divergenciasDeArea(
  lancamentos: LancamentoParaDivergencia[],
  areaDoServico: (servico: string | null) => string | null,
  coincide: (areaPlanoId: string, areaServico: string) => boolean,
): Divergencias {
  const pares = new Map<string, ParDivergente>();
  let semAreaDoPlano = 0;
  for (const l of lancamentos) {
    if (!l.area_plano_id) {
      semAreaDoPlano++;
      continue;
    }
    const areaServico = areaDoServico(l.servico);
    // Sem serviço ou serviço sem área: não há com o que comparar.
    if (!areaServico) continue;
    if (coincide(l.area_plano_id, areaServico)) continue;
    const k = `${l.area_plano_id}|${areaServico}`;
    const par = pares.get(k) ?? { area_plano_id: l.area_plano_id, area_servico: areaServico, centavos: 0, lancamentos: [] };
    par.centavos += l.centavos;
    par.lancamentos.push(l);
    pares.set(k, par);
  }
  const lista = [...pares.values()].sort((a, b) => b.centavos - a.centavos);
  return { pares: lista, totalCentavos: lista.reduce((s, x) => s + x.centavos, 0), semAreaDoPlano };
}
