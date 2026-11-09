/**
 * Cálculo dos indicadores da Comunicação (puro: recebe os registros, devolve os números).
 * Todos os dias são do horário de Brasília e todos os prazos contam dias úteis (`diasUteisEntre`).
 */
import type { RegCalendario, RegHistorico, RegPedido } from '../dados/tabelas';
import { TIPOS_PECA, type TipoPeca } from './pedido';
import { diaEmBrasilia, diasUteisEntre } from './prazos';

export interface PeriodoIndicadores {
  inicio: string;
  fim: string;
}

export interface Indicadores {
  volume: {
    total: number;
    /** Por código da área. */
    porArea: Record<string, number>;
    porTipo: Record<TipoPeca, number>;
    porTema: Array<{ tema: string; total: number }>;
  };
  /** Médias em dias úteis, com 1 casa; null quando não há dado no período. */
  tempoRevisao: number | null;
  tempoAprovacao: number | null;
  tempoPublicacao: number | null;
  publicadosComAtraso: { percentual: number | null; atrasados: number; publicados: number };
  urgentes: number;
  temasSemPublicacao: Array<{ id: string; tema: string; fim: string }>;
}

export const SEM_TEMA = 'Fora do calendário';

const noPeriodo = (dia: string, p: PeriodoIndicadores) => dia >= p.inicio && dia <= p.fim;
const media = (v: number[]): number | null => (v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null);

export function montarIndicadores(e: { pedidos: RegPedido[]; historico: RegHistorico[]; calendario: RegCalendario[]; periodo: PeriodoIndicadores }): Indicadores {
  const { periodo } = e;
  const pedidos = e.pedidos.filter((r) => r.ativo);
  const ids = new Set(pedidos.map((r) => r.id));
  const porPedido = new Map<string, RegHistorico[]>();
  for (const h of [...e.historico].sort((a, b) => a.em.localeCompare(b.em))) {
    if (!ids.has(h.pedido_id)) continue;
    porPedido.set(h.pedido_id, [...(porPedido.get(h.pedido_id) ?? []), h]);
  }

  // Volume e urgentes: pelo primeiro envio.
  const enviados = pedidos.filter((r) => noPeriodo(diaEmBrasilia(new Date(r.enviado_em)), periodo));
  const porArea: Record<string, number> = {};
  const porTipo = Object.fromEntries(TIPOS_PECA.map((t) => [t, 0])) as Record<TipoPeca, number>;
  const porTema = new Map<string, number>();
  for (const r of enviados) {
    porArea[r.area] = (porArea[r.area] ?? 0) + 1;
    porTipo[r.tipo_peca] += 1;
    const tema = r.calendario_tema ?? SEM_TEMA;
    porTema.set(tema, (porTema.get(tema) ?? 0) + 1);
  }

  // Tempos: cada trecho conta no dia em que termina.
  const revisao: number[] = [];
  const aprovacao: number[] = [];
  const publicacao: number[] = [];
  for (const r of pedidos) {
    const linhas = porPedido.get(r.id) ?? [];
    const dia = (h: RegHistorico) => diaEmBrasilia(new Date(h.em));
    let entradaRevisao: string | null = null;
    let entradaAprovacao: string | null = null;
    for (const h of linhas) {
      if (h.para === 'aguardando_revisao' && h.de !== 'aguardando_revisao') entradaRevisao = dia(h);
      else if (h.de === 'em_revisao' && h.para !== 'em_revisao' && entradaRevisao) {
        if (noPeriodo(dia(h), periodo)) revisao.push(diasUteisEntre(entradaRevisao, dia(h)));
        entradaRevisao = null;
      }
      if (h.para === 'aguardando_aprovacao' && h.de !== 'aguardando_aprovacao') entradaAprovacao = dia(h);
      else if (h.de === 'aguardando_aprovacao' && h.para !== 'aguardando_aprovacao' && entradaAprovacao) {
        if (noPeriodo(dia(h), periodo)) aprovacao.push(diasUteisEntre(entradaAprovacao, dia(h)));
        entradaAprovacao = null;
      }
      if ((h.para === 'publicado' || h.para === 'realizada') && noPeriodo(dia(h), periodo))
        publicacao.push(diasUteisEntre(diaEmBrasilia(new Date(r.enviado_em)), dia(h)));
    }
  }

  // Atraso: publicados no período cujo dia de publicação passou da data desejada.
  const publicados = pedidos.filter((r) => r.situacao === 'publicado' && r.publicado_em && noPeriodo(diaEmBrasilia(new Date(r.publicado_em)), periodo));
  const atrasados = publicados.filter((r) => diaEmBrasilia(new Date(r.publicado_em!)) > r.data_desejada).length;

  // Temas com fim no período e nenhum pedido ligado já publicado (ou realizado).
  const cobertos = new Set(pedidos.filter((r) => r.situacao === 'publicado' || r.situacao === 'realizada').map((r) => r.calendario_id));
  const temasSemPublicacao = e.calendario
    .filter((c) => c.ativo && noPeriodo(c.fim, periodo) && !cobertos.has(c.id))
    .sort((a, b) => a.fim.localeCompare(b.fim) || a.tema.localeCompare(b.tema, 'pt-BR'))
    .map((c) => ({ id: c.id, tema: c.tema, fim: c.fim }));

  return {
    volume: {
      total: enviados.length,
      porArea,
      porTipo,
      porTema: [...porTema].map(([tema, total]) => ({ tema, total })).sort((a, b) => b.total - a.total || a.tema.localeCompare(b.tema, 'pt-BR')),
    },
    tempoRevisao: media(revisao),
    tempoAprovacao: media(aprovacao),
    tempoPublicacao: media(publicacao),
    publicadosComAtraso: {
      percentual: publicados.length ? Math.round((atrasados / publicados.length) * 1000) / 10 : null,
      atrasados,
      publicados: publicados.length,
    },
    urgentes: enviados.filter((r) => r.urgente).length,
    temasSemPublicacao,
  };
}

/** Período de um mês, trimestre ou ano que contém o mês de referência (AAAA-MM). */
export function periodoDe(tipo: 'mes' | 'trimestre' | 'ano', mes: string): PeriodoIndicadores & { rotulo: string } {
  const ano = Number(mes.slice(0, 4));
  const m = Number(mes.slice(5, 7));
  const fimDe = (a: number, mm: number) => `${a}-${String(mm).padStart(2, '0')}-${String(new Date(Date.UTC(a, mm, 0)).getUTCDate()).padStart(2, '0')}`;
  if (tipo === 'ano') return { inicio: `${ano}-01-01`, fim: `${ano}-12-31`, rotulo: String(ano) };
  if (tipo === 'trimestre') {
    const q = Math.floor((m - 1) / 3);
    return { inicio: `${ano}-${String(q * 3 + 1).padStart(2, '0')}-01`, fim: fimDe(ano, q * 3 + 3), rotulo: `${q + 1}º trimestre de ${ano}` };
  }
  return { inicio: `${mes}-01`, fim: fimDe(ano, m), rotulo: mes };
}
