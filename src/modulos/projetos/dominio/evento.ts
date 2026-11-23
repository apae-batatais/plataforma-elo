/**
 * Evento de captação (regras L15 a L17): série, dados do modelo curto e a comparação entre edições vem na entrega 3.
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
