/**
 * Regras puras do resultado das postagens do Instagram (Fase 4, #65). Nada aqui lê nem grava planilhas.
 */
import type { TipoPublicacao } from './publicacao';

/** Depois de tanto tempo publicada, o Elo para de atualizar os números (ficam os últimos). */
export const DIAS_DE_BUSCA = 90;
/** Hora (Brasília) em que a rotina busca os resultados, uma vez por dia. */
export const HORA_DA_BUSCA = 3;

export const MENSAGEM_RESULTADO_INDISPONIVEL = 'Resultado ainda não disponível.';
export const MENSAGEM_RESULTADO_SEM_PERMISSAO = 'Ainda não é possível buscar o resultado desta conta; pode ser preciso reconectar o Instagram.';

export const NOME_TIPO_PUBLICACAO: Record<TipoPublicacao, string> = { post: 'Post', reel: 'Reel', carrossel: 'Carrossel' };

export interface NumerosDaPostagem {
  alcance: number | null;
  curtidas: number | null;
  comentarios: number | null;
  salvamentos: number | null;
}

/** Hora cheia (0 a 23) no horário de Brasília. */
export function horaEmBrasilia(agora: Date): number {
  return new Date(agora.getTime() - 3 * 60 * 60 * 1000).getUTCHours();
}

/** A publicação ainda entra na busca diária? (publicada há até `DIAS_DE_BUSCA` dias) */
export function dentroDoPrazoDeBusca(publicadaEm: string | null, agora: Date): boolean {
  if (!publicadaEm) return false;
  const t = new Date(publicadaEm).getTime();
  return Number.isFinite(t) && agora.getTime() - t <= DIAS_DE_BUSCA * 24 * 60 * 60 * 1000;
}

/** Junta o que a Meta devolveu com o que já havia: número que não veio não apaga o anterior. */
export function juntarNumeros(antigo: NumerosDaPostagem, novo: NumerosDaPostagem): NumerosDaPostagem {
  return {
    alcance: novo.alcance ?? antigo.alcance,
    curtidas: novo.curtidas ?? antigo.curtidas,
    comentarios: novo.comentarios ?? antigo.comentarios,
    salvamentos: novo.salvamentos ?? antigo.salvamentos,
  };
}

export interface MediaPorTipo {
  tipo: TipoPublicacao;
  nome: string;
  alcanceMedio: number;
  postagens: number;
}

/** Alcance médio por tipo (só postagens com alcance), maior primeiro. */
export function alcanceMedioPorTipo(linhas: { tipo: TipoPublicacao; alcance: number | null }[]): MediaPorTipo[] {
  const grupos = new Map<TipoPublicacao, number[]>();
  for (const l of linhas) if (l.alcance !== null) grupos.set(l.tipo, [...(grupos.get(l.tipo) ?? []), l.alcance]);
  return [...grupos.entries()]
    .map(([tipo, v]) => ({ tipo, nome: NOME_TIPO_PUBLICACAO[tipo], alcanceMedio: Math.round(v.reduce((a, b) => a + b, 0) / v.length), postagens: v.length }))
    .sort((a, b) => b.alcanceMedio - a.alcanceMedio || a.nome.localeCompare(b.nome, 'pt-BR'));
}

const PLURAL: Record<TipoPublicacao, string> = { post: 'posts', reel: 'Reels', carrossel: 'carrosséis' };

/** Título do gráfico em forma de conclusão, com o que os números do período realmente mostram. */
export function tituloDoAlcance(medias: MediaPorTipo[]): string {
  if (medias.length === 0) return 'Alcance médio por tipo de peça';
  if (medias.length === 1) return `Alcance médio dos ${PLURAL[medias[0].tipo]} no período: ${medias[0].alcanceMedio.toLocaleString('pt-BR')}`;
  const [a, b] = medias;
  if (a.alcanceMedio === b.alcanceMedio) return 'Os tipos de peça alcançaram o mesmo, em média';
  const sujeito = a.tipo === 'reel' ? 'Reel alcança' : a.tipo === 'post' ? 'Post alcança' : 'Carrossel alcança';
  const objeto = b.tipo === 'reel' ? 'Reel' : b.tipo === 'post' ? 'post' : 'carrossel';
  return `${sujeito} mais que ${objeto}, em média`;
}
