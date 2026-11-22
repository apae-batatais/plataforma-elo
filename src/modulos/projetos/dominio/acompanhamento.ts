/**
 * Fase 4 (entrega P4): problemas, pedidos de mudança e relatório de monitoramento.
 * Regras puras, sem leitura nem gravação.
 */
import { GRAUS, type Grau } from './fases';

// ---------- Problemas (regra 21) ----------

/** Problema aberto = sem solução e sem data de solução. */
export const problemaAberto = (p: { solucao: string | null; resolvido_em: string | null }): boolean => !p.solucao || !p.resolvido_em;

/** Gravidade `alto` aparece em destaque (regra 21). */
export const problemaEmDestaque = (p: { gravidade: Grau }): boolean => p.gravidade === 'alto';

export { GRAUS };

// ---------- Pedidos de mudança (regras 16 a 19) ----------

export const TIPOS_MUDANCA = ['prazo', 'custo', 'escopo'] as const;
export type TipoMudanca = (typeof TIPOS_MUDANCA)[number];
export const NOME_MUDANCA: Record<TipoMudanca, string> = { prazo: 'Prazo', custo: 'Custo', escopo: 'Escopo' };

export const SITUACOES_PEDIDO = ['aplicada', 'pendente', 'aguardando_alcada', 'aprovada', 'recusada'] as const;
export type SituacaoPedido = (typeof SITUACOES_PEDIDO)[number];
export const NOME_SITUACAO_PEDIDO: Record<SituacaoPedido, string> = {
  aplicada: 'Aplicada (dentro da tolerância)',
  pendente: 'Esperando a Diretoria',
  aguardando_alcada: 'Esperando a Presidência ou o Conselho',
  aprovada: 'Aprovada',
  recusada: 'Recusada',
};

const arredondar = (n: number) => Math.round(n * 100) / 100;

/** Quanto o valor subiu sobre a base, em %. Reduzir nunca passa da tolerância (devolve 0 ou negativo). */
export function variacaoCustoPct(base: number, novo: number): number {
  if (novo === base) return 0;
  if (base <= 0) return novo > 0 ? 100 : 0;
  return arredondar(((novo - base) / base) * 100);
}

/** Dias entre duas datas AAAA-MM-DD (positivo = depois). */
export function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);
}

export interface AvaliacaoPedido {
  /** Variação principal: % de custo da linha, dias de prazo; null no escopo. */
  variacao: number | null;
  /** Limite da tolerância que vale para o pedido; null no escopo. */
  limite: number | null;
  /** Variação do total, em %, só no custo. */
  variacaoTotal: number | null;
  limiteTotal: number | null;
  dentro: boolean;
}

/** Regra 19: a variação é medida sobre a última versão aprovada do Termo. Passa se linha e total cabem. */
export function avaliarCusto(a: { baseLinha: number; novoLinha: number; baseTotal: number; novoTotal: number; limiteLinhaPct: number; limiteTotalPct: number }): AvaliacaoPedido {
  const variacao = variacaoCustoPct(a.baseLinha, a.novoLinha);
  const variacaoTotal = variacaoCustoPct(a.baseTotal, a.novoTotal);
  return { variacao, limite: a.limiteLinhaPct, variacaoTotal, limiteTotal: a.limiteTotalPct, dentro: variacao <= a.limiteLinhaPct && variacaoTotal <= a.limiteTotalPct };
}

export function avaliarPrazo(a: { base: string; novo: string; limiteDias: number }): AvaliacaoPedido {
  const dias = diasEntre(a.base, a.novo);
  return { variacao: dias, limite: a.limiteDias, variacaoTotal: null, limiteTotal: null, dentro: dias <= a.limiteDias };
}

/** Regra 17: escopo só é livre se o Termo declarou "escopo livre" e a pessoa diz que a mudança cabe nele. */
export function avaliarEscopo(a: { escopoLivreDoTermo: string | null; cabeNoEscopoLivre: boolean }): AvaliacaoPedido {
  const livre = !!a.escopoLivreDoTermo?.trim() && a.cabeNoEscopoLivre;
  return { variacao: null, limite: null, variacaoTotal: null, limiteTotal: null, dentro: livre };
}

const pct = (n: number) => `${String(n).replace('.', ',')}%`;
const dias = (n: number) => `${Math.abs(n)} ${Math.abs(n) === 1 ? 'dia' : 'dias'}`;

/** A variação em palavras, ex.: "o custo sobe 3% de 5% permitidos". */
export function fraseDaVariacao(tipo: TipoMudanca, a: AvaliacaoPedido): string {
  if (tipo === 'escopo') return a.dentro ? 'A mudança cabe no escopo livre do Termo de Abertura.' : 'Mudança de escopo: o Termo não a libera, então a Diretoria decide.';
  if (tipo === 'prazo') {
    const v = a.variacao ?? 0;
    if (v <= 0) return v === 0 ? 'O prazo não muda em relação ao aprovado.' : `O prazo adianta ${dias(v)} em relação ao aprovado.`;
    return `O prazo atrasa ${dias(v)} de ${dias(a.limite ?? 0)} permitidos.`;
  }
  const v = a.variacao ?? 0;
  const t = a.variacaoTotal ?? 0;
  const linha = v <= 0 ? `a linha ${v === 0 ? 'não muda' : `cai ${pct(Math.abs(v))}`}` : `a linha sobe ${pct(v)} de ${pct(a.limite ?? 0)} permitidos`;
  const total = t <= 0 ? `o total ${t === 0 ? 'não muda' : `cai ${pct(Math.abs(t))}`}` : `o total sobe ${pct(t)} de ${pct(a.limiteTotal ?? 0)} permitidos`;
  return `Custo: ${linha}; ${total}.`;
}

/** Diz quem decide (regras 16 e 17), em palavras. */
export function quemDecide(dentro: boolean, exigeAlcada: boolean): string {
  if (dentro) return 'Dentro da tolerância: você aplica.';
  return exigeAlcada ? 'Fora da tolerância: vai para a Diretoria e, como o novo valor total passa do limite, depois para a Presidência ou o Conselho.' : 'Fora da tolerância: vai para a Diretoria.';
}

// ---------- Fora da tolerância (regra 19) e relatório (regra 22) ----------

export interface EntradaTolerancia {
  hoje: string;
  tolerancias: { custoTotalPct: number; prazoFimDias: number; prazoMarcoDias: number };
  valorAprovado: number | null;
  totalOrcamento: number;
  gastoRealizado: number | null;
  fimPrevistoProjeto: string | null;
  atividades: readonly { descricao: string; situacao: 'a_fazer' | 'em_andamento' | 'concluida' | 'cancelada'; fim_previsto: string }[];
}

/** Motivos pelos quais o projeto está fora da tolerância (lista vazia = dentro). */
export function foraDaTolerancia(e: EntradaTolerancia): string[] {
  const motivos: string[] = [];
  const abertas = e.atividades.filter((a) => a.situacao === 'a_fazer' || a.situacao === 'em_andamento');
  if (e.valorAprovado !== null) {
    const limite = e.tolerancias.custoTotalPct;
    const previsao = variacaoCustoPct(e.valorAprovado, e.totalOrcamento);
    if (previsao > limite) motivos.push(`O orçamento soma ${pct(previsao)} acima do valor aprovado (permitido: ${pct(limite)}).`);
    if (e.gastoRealizado !== null) {
      const gasto = variacaoCustoPct(e.valorAprovado, e.gastoRealizado);
      if (gasto > limite) motivos.push(`O gasto realizado está ${pct(gasto)} acima do valor aprovado (permitido: ${pct(limite)}).`);
    }
  }
  const fimPrevisao = e.atividades.filter((a) => a.situacao !== 'cancelada').map((a) => a.fim_previsto).sort().at(-1);
  if (e.fimPrevistoProjeto && fimPrevisao) {
    const d = diasEntre(e.fimPrevistoProjeto, fimPrevisao);
    if (d > e.tolerancias.prazoFimDias) motivos.push(`As atividades terminam ${dias(d)} depois do fim previsto do projeto (permitido: ${dias(e.tolerancias.prazoFimDias)}).`);
  }
  if (e.fimPrevistoProjeto && abertas.length > 0) {
    const d = diasEntre(e.fimPrevistoProjeto, e.hoje);
    if (d > e.tolerancias.prazoFimDias) motivos.push(`O fim previsto do projeto passou há ${dias(d)} e ainda há atividades abertas (permitido: ${dias(e.tolerancias.prazoFimDias)}).`);
  }
  for (const a of abertas) {
    const d = diasEntre(a.fim_previsto, e.hoje);
    if (d > e.tolerancias.prazoMarcoDias) motivos.push(`Atividade "${a.descricao}" atrasada há ${dias(d)} (permitido: ${dias(e.tolerancias.prazoMarcoDias)}).`);
  }
  return motivos;
}

export const SITUACOES_RELATORIO = ['verde', 'amarelo', 'vermelho'] as const;
export type SituacaoRelatorio = (typeof SITUACOES_RELATORIO)[number];
/** A palavra sempre acompanha a cor. */
export const NOME_SITUACAO_RELATORIO: Record<SituacaoRelatorio, string> = { verde: 'Verde: no caminho', amarelo: 'Amarelo: atenção', vermelho: 'Vermelho: fora do combinado' };
const GRAU_DA_SITUACAO: Record<SituacaoRelatorio, number> = { verde: 0, amarelo: 1, vermelho: 2 };

/** Regra 22: calculada pelas tolerâncias, pelos problemas abertos e pelo andamento. */
export function situacaoCalculada(e: { motivosForaTolerancia: readonly string[]; problemasAbertos: readonly { gravidade: Grau }[]; atrasadas: number; planejadoPct: number; realizadoPct: number }): SituacaoRelatorio {
  if (e.motivosForaTolerancia.length > 0 || e.problemasAbertos.some((p) => p.gravidade === 'alto')) return 'vermelho';
  if (e.atrasadas > 0 || e.problemasAbertos.length > 0 || e.realizadoPct < e.planejadoPct) return 'amarelo';
  return 'verde';
}

/** Regra 22: a pessoa pode piorar a situação, nunca melhorá-la. */
export const ePior = (nova: SituacaoRelatorio, calculada: SituacaoRelatorio): boolean => GRAU_DA_SITUACAO[nova] > GRAU_DA_SITUACAO[calculada];
export const eMelhor = (nova: SituacaoRelatorio, calculada: SituacaoRelatorio): boolean => GRAU_DA_SITUACAO[nova] < GRAU_DA_SITUACAO[calculada];

type AtividadeAndamento = { situacao: 'a_fazer' | 'em_andamento' | 'concluida' | 'cancelada'; peso: number | null; fim_previsto: string; fim_real: string | null };
const peso = (a: { peso: number | null }) => a.peso ?? 1;

/** Planejado: peso das atividades que deviam estar concluídas até a data, sobre o peso de todas (canceladas ficam de fora). */
export function planejadoPct(atividades: readonly AtividadeAndamento[], ate: string): number {
  const validas = atividades.filter((a) => a.situacao !== 'cancelada');
  const total = validas.reduce((s, a) => s + peso(a), 0);
  if (total === 0) return 0;
  return Math.round((validas.filter((a) => a.fim_previsto <= ate).reduce((s, a) => s + peso(a), 0) / total) * 100);
}

/** Realizado: peso das atividades concluídas até a data. */
export function realizadoPct(atividades: readonly AtividadeAndamento[], ate: string): number {
  const validas = atividades.filter((a) => a.situacao !== 'cancelada');
  const total = validas.reduce((s, a) => s + peso(a), 0);
  if (total === 0) return 0;
  return Math.round((validas.filter((a) => a.situacao === 'concluida' && a.fim_real !== null && a.fim_real <= ate).reduce((s, a) => s + peso(a), 0) / total) * 100);
}
