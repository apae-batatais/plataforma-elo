/**
 * Painel de prazos (SLA): quanto foi decidido e atendido dentro do prazo.
 *
 * - Aprovação: conta no mês em que a coordenação (ou a Diretoria) decidiu
 *   (aprovou, devolveu ou recusou). Horas úteis do envio até a decisão.
 * - Atendimento: conta no mês em que o setor concluiu. Horas úteis da
 *   aprovação até a conclusão.
 * - Em aberto: o que está agora esperando decisão ou atendimento além do prazo.
 *
 * Os meses seguem o horário de Brasília. Regras puras, sem planilha.
 */
import { horasUteis, type Expediente } from './sla';
import type { Situacao } from './requisicao';

export interface RequisicaoParaPainel {
  id: string;
  numero: string;
  tipoId: string;
  tipoNome: string;
  setor: string;
  situacao: Situacao;
  enviadaEm: string;
  decididaEm: string | null;
  concluidaEm: string | null;
  prazoAprovacao: number;
  prazoAtendimento: number;
}

export interface Contagem {
  total: number;
  noPrazo: number;
  /** % no prazo (null se não houve nenhuma). */
  pct: number | null;
  /** Média de horas úteis gastas. */
  mediaHoras: number | null;
}

export interface Resumo {
  aprovacao: Contagem;
  atendimento: Contagem;
  /** Atendidas em parte, entre as concluídas. */
  parciais: number;
}

export interface Atrasada {
  id: string;
  numero: string;
  tipo: string;
  setor: string;
  etapa: 'aprovação' | 'atendimento';
  horas: number;
  prazo: number;
}

export interface Painel {
  meses: string[];
  total: Resumo;
  porMes: Resumo[];
  porTipo: { nome: string; resumo: Resumo }[];
  porSetor: { nome: string; resumo: Resumo }[];
  atrasadas: Atrasada[];
}

const FUSO_MS = -3 * 3600_000;
/** Mês (AAAA-MM) de um instante, no horário de Brasília. */
export const mesDe = (iso: string) => new Date(Date.parse(iso) + FUSO_MS).toISOString().slice(0, 7);

/** Meses de `de` até `ate` (AAAA-MM), inclusive. No máximo 24. */
export function mesesEntre(de: string, ate: string): string[] {
  const meses: string[] = [];
  let [a, m] = de.split('-').map(Number);
  const fim = ate;
  while (meses.length < 24) {
    const atual = `${a}-${String(m).padStart(2, '0')}`;
    if (atual > fim) break;
    meses.push(atual);
    m += 1;
    if (m > 12) {
      m = 1;
      a += 1;
    }
  }
  return meses;
}

const pct = (parte: number, total: number) => (total ? Math.round((parte / total) * 1000) / 10 : null);
const media = (l: number[]) => (l.length ? Math.round((l.reduce((s, x) => s + x, 0) / l.length) * 10) / 10 : null);

interface Fato {
  r: RequisicaoParaPainel;
  aprovacao: { mes: string; horas: number; noPrazo: boolean } | null;
  atendimento: { mes: string; horas: number; noPrazo: boolean; parcial: boolean } | null;
}

function resumir(fatos: Fato[], mes?: string): Resumo {
  const ap = fatos.map((f) => f.aprovacao).filter((x): x is NonNullable<Fato['aprovacao']> => x !== null && (!mes || x.mes === mes));
  const at = fatos.map((f) => f.atendimento).filter((x): x is NonNullable<Fato['atendimento']> => x !== null && (!mes || x.mes === mes));
  const contar = (l: { horas: number; noPrazo: boolean }[]): Contagem => {
    const noPrazo = l.filter((x) => x.noPrazo).length;
    return { total: l.length, noPrazo, pct: pct(noPrazo, l.length), mediaHoras: media(l.map((x) => x.horas)) };
  };
  return { aprovacao: contar(ap), atendimento: contar(at), parciais: at.filter((x) => x.parcial).length };
}

/** Monta o painel do período (meses AAAA-MM) com as requisições que a pessoa pode ver. */
export function montarPainel(lista: RequisicaoParaPainel[], de: string, ate: string, agoraISO: string, e: Expediente): Painel {
  const meses = mesesEntre(de, ate);
  const noPeriodo = new Set(meses);
  const fatos: Fato[] = lista.map((r) => {
    let aprovacao: Fato['aprovacao'] = null;
    if (r.decididaEm && noPeriodo.has(mesDe(r.decididaEm))) {
      const horas = horasUteis(r.enviadaEm, r.decididaEm, e);
      aprovacao = { mes: mesDe(r.decididaEm), horas, noPrazo: horas <= r.prazoAprovacao };
    }
    let atendimento: Fato['atendimento'] = null;
    if (r.decididaEm && r.concluidaEm && noPeriodo.has(mesDe(r.concluidaEm))) {
      const horas = horasUteis(r.decididaEm, r.concluidaEm, e);
      atendimento = { mes: mesDe(r.concluidaEm), horas, noPrazo: horas <= r.prazoAtendimento, parcial: r.situacao === 'atendida_parcial' };
    }
    return { r, aprovacao, atendimento };
  });
  const comDado = fatos.filter((f) => f.aprovacao || f.atendimento);
  const porChave = (chave: (r: RequisicaoParaPainel) => string) => {
    const grupos = new Map<string, Fato[]>();
    for (const f of comDado) grupos.set(chave(f.r), [...(grupos.get(chave(f.r)) ?? []), f]);
    return [...grupos.entries()].map(([nome, l]) => ({ nome, resumo: resumir(l) })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  };

  // Em aberto além do prazo (agora, independentemente do período).
  const atrasadas: Atrasada[] = [];
  for (const r of lista) {
    if (r.situacao === 'enviada') {
      const horas = horasUteis(r.enviadaEm, agoraISO, e);
      if (horas > r.prazoAprovacao)
        atrasadas.push({ id: r.id, numero: r.numero, tipo: r.tipoNome, setor: r.setor, etapa: 'aprovação', horas, prazo: r.prazoAprovacao });
    } else if ((r.situacao === 'aprovada' || r.situacao === 'em_atendimento') && r.decididaEm) {
      const horas = horasUteis(r.decididaEm, agoraISO, e);
      if (horas > r.prazoAtendimento)
        atrasadas.push({ id: r.id, numero: r.numero, tipo: r.tipoNome, setor: r.setor, etapa: 'atendimento', horas, prazo: r.prazoAtendimento });
    }
  }
  atrasadas.sort((a, b) => b.horas - b.prazo - (a.horas - a.prazo));

  return {
    meses,
    total: resumir(comDado),
    porMes: meses.map((m) => resumir(comDado, m)),
    porTipo: porChave((r) => r.tipoNome),
    porSetor: porChave((r) => r.setor),
    atrasadas,
  };
}
