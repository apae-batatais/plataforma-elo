/**
 * Evento de captação (regras L15 a L19): série, dados do modelo curto, resultado e comparação entre edições.
 * Regras puras: nada aqui lê nem grava planilhas.
 */
import { ErroProjetos } from './projeto';

/** Dados do modelo curto do evento, já conferidos. */
export interface DadosEvento {
  /** Série do evento (ex.: "Leilão anual"); null = evento único, sem comparação. */
  serie: string | null;
  /** AAAA-MM-DD. */
  dataEvento: string;
  /** Meta de receita (R$), maior que zero. */
  metaReceita: number;
  /** Fonte de natureza própria do Orçamento; null enquanto o Financeiro não cadastrou a fonte do evento. */
  fonteReceitaId: string | null;
}

/** Chave de comparação da série: sem acento, sem diferença de maiúscula e sem espaço sobrando (regra L16). */
export function chaveDaSerie(serie: string | null | undefined): string {
  return (serie ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Série em branco = evento único: nunca é igual a outra série. */
export function mesmaSerie(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = chaveDaSerie(a);
  return x !== '' && x === chaveDaSerie(b);
}

/** Sugestões de série: uma por chave (a grafia mais usada), em ordem alfabética. */
export function sugestoesDeSerie(series: readonly (string | null | undefined)[]): string[] {
  const contagem = new Map<string, Map<string, number>>();
  for (const s of series) {
    const texto = (s ?? '').replace(/\s+/g, ' ').trim();
    if (!texto) continue;
    const grafias = contagem.get(chaveDaSerie(texto)) ?? new Map<string, number>();
    grafias.set(texto, (grafias.get(texto) ?? 0) + 1);
    contagem.set(chaveDaSerie(texto), grafias);
  }
  return [...contagem.values()]
    .map((g) => [...g.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))[0][0])
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Confere o modelo curto. Erros em português; a pessoa nunca perde o que digitou (a tela devolve os valores). */
export function conferirEvento(d: { serie?: string | null; dataEvento?: string | null; metaReceita?: number | null; fonteReceitaId?: string | null }): DadosEvento {
  const dataEvento = (d.dataEvento ?? '').trim();
  if (!DATA.test(dataEvento) || Number.isNaN(Date.parse(`${dataEvento}T12:00:00Z`)) || new Date(`${dataEvento}T12:00:00Z`).toISOString().slice(0, 10) !== dataEvento) {
    throw new ErroProjetos('Informe a data do evento.');
  }
  const meta = d.metaReceita;
  if (meta === null || meta === undefined || !Number.isFinite(meta) || meta <= 0) throw new ErroProjetos('Informe a meta de receita do evento (maior que zero).');
  const serie = (d.serie ?? '').replace(/\s+/g, ' ').trim();
  if (serie.length > 80) throw new ErroProjetos('O nome da série pode ter até 80 letras.');
  return { serie: serie || null, dataEvento, metaReceita: Math.round(meta * 100) / 100, fonteReceitaId: d.fonteReceitaId?.trim() || null };
}

/** Números do evento vindos do Orçamento (L18), em reais. */
export interface NumerosDoEvento {
  receita: number;
  custo: number;
  /** Quantos lançamentos do Realizado têm o projeto; 0 = "Sem lançamentos no Orçamento" (L19), nunca R$ 0,00. */
  lancamentos: number;
}

const centavos = (v: number) => Math.round(v * 100);

/** Resultado líquido = receita − custo (L18), em reais com duas casas. */
export const resultadoDoEvento = (n: Pick<NumerosDoEvento, 'receita' | 'custo'>): number => (centavos(n.receita) - centavos(n.custo)) / 100;

/** Palavra e valor para o número grande: "Sobrou R$ X" ou "Faltou R$ X" (L18: negativo é prejuízo). */
export function leituraDoResultado(resultado: number): { palavra: 'Sobrou' | 'Faltou' | 'Ficou no zero'; valor: number } {
  const c = centavos(resultado);
  if (c > 0) return { palavra: 'Sobrou', valor: c / 100 };
  if (c < 0) return { palavra: 'Faltou', valor: -c / 100 };
  return { palavra: 'Ficou no zero', valor: 0 };
}

/** A fotografia do resultado guardada ao encerrar (L19) vai como texto JSON; nada de pessoa nela. */
export function fotografiaEmTexto(n: NumerosDoEvento, em: string): string {
  return JSON.stringify({ receita: n.receita, custo: n.custo, lancamentos: n.lancamentos, em });
}

export function fotografiaDoTexto(texto: string | null | undefined): (NumerosDoEvento & { em: string }) | null {
  if (!texto) return null;
  try {
    const j = JSON.parse(texto) as Record<string, unknown>;
    if (typeof j.receita !== 'number' || typeof j.custo !== 'number' || typeof j.lancamentos !== 'number' || !Number.isFinite(j.receita) || !Number.isFinite(j.custo)) return null;
    return { receita: j.receita, custo: j.custo, lancamentos: j.lancamentos, em: typeof j.em === 'string' ? j.em : '' };
  } catch {
    return null;
  }
}

/** Uma edição da série, com os números fotografados no encerramento. */
export interface EdicaoDaSerie extends NumerosDoEvento {
  projetoId: string;
  codigo: string;
  /** AAAA-MM-DD. */
  dataEvento: string;
  resultado: number;
  /** Nome para o gráfico: o ano do evento; com duas edições no mesmo ano, o ano e o código. */
  rotulo: string;
}

/** Dá a cada edição um nome curto e único para o eixo do gráfico. */
export function rotularEdicoes<T extends { codigo: string; dataEvento: string }>(edicoes: readonly T[]): (T & { rotulo: string })[] {
  const porAno = new Map<string, number>();
  for (const e of edicoes) porAno.set(e.dataEvento.slice(0, 4), (porAno.get(e.dataEvento.slice(0, 4)) ?? 0) + 1);
  return edicoes.map((e) => ({ ...e, rotulo: (porAno.get(e.dataEvento.slice(0, 4)) ?? 0) > 1 ? `${e.dataEvento.slice(0, 4)} (${e.codigo})` : e.dataEvento.slice(0, 4) }));
}

/**
 * Comparação com as edições anteriores (L19): só entram as encerradas e com lançamentos, de data anterior à da edição
 * atual. A variação é do resultado contra a edição imediatamente anterior; "melhor" é a de maior resultado, contando a atual.
 */
export function compararEdicoes(
  atual: { rotulo: string; resultado: number },
  anteriores: readonly { rotulo: string; resultado: number; dataEvento: string }[],
): { anterior: { rotulo: string; resultado: number } | null; variacao: number | null; melhor: { rotulo: string; resultado: number } | null } {
  if (anteriores.length === 0) return { anterior: null, variacao: null, melhor: null };
  const ordenadas = [...anteriores].sort((a, b) => a.dataEvento.localeCompare(b.dataEvento));
  const anterior = ordenadas[ordenadas.length - 1];
  const todas = [...ordenadas, atual];
  const melhor = todas.reduce((m, e) => (centavos(e.resultado) > centavos(m.resultado) ? e : m));
  return { anterior, variacao: (centavos(atual.resultado) - centavos(anterior.resultado)) / 100, melhor: { rotulo: melhor.rotulo, resultado: melhor.resultado } };
}
