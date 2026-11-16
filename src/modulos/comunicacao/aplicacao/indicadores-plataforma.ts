/**
 * Indicadores da Comunicação para o painel da Diretoria (ADR-025).
 * Usa `montarIndicadores`, a mesma conta da tela de Indicadores do app, mês a mês (uma leitura só das abas).
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { mesAtualEmBrasilia, MESES_DO_ANO, type DefinicaoDeIndicador, type IndicadorCalculado, type PeriodoDoPainel, type PontoDeIndicador } from '@/capacidades/indicadores';
import { CalendarioComunicacao, HistoricoComunicacao, PedidosComunicacao } from '../dados/tabelas';
import { montarIndicadores, periodoDe, type Indicadores } from '../dominio/indicadores';

const base = { periodicidade: 'mes' as const };
export const DEFINICOES_COMUNICACAO: Record<string, DefinicaoDeIndicador> = {
  comunicacao_volume: { ...base, id: 'comunicacao_volume', nome: 'Pedidos de comunicação', explicacao: 'Pedidos enviados no mês, pela data do primeiro envio.', formato: 'numero', sentido: 'neutro' },
  comunicacao_tempo_revisao: { ...base, id: 'comunicacao_tempo_revisao', nome: 'Tempo de revisão', explicacao: 'Média, em dias úteis, que o pedido fica na revisão.', formato: 'dias', sentido: 'menos' },
  comunicacao_tempo_aprovacao: { ...base, id: 'comunicacao_tempo_aprovacao', nome: 'Tempo de aprovação', explicacao: 'Média, em dias úteis, que o pedido espera a aprovação.', formato: 'dias', sentido: 'menos' },
  comunicacao_tempo_publicacao: { ...base, id: 'comunicacao_tempo_publicacao', nome: 'Tempo até publicar', explicacao: 'Média, em dias úteis, do envio do pedido até a publicação.', formato: 'dias', sentido: 'menos' },
  comunicacao_publicados_com_atraso: { ...base, id: 'comunicacao_publicados_com_atraso', nome: 'Publicados com atraso', explicacao: 'Dos pedidos publicados no mês, quantos passaram da data desejada.', formato: 'pct', sentido: 'menos' },
  comunicacao_urgentes: { ...base, id: 'comunicacao_urgentes', nome: 'Pedidos urgentes', explicacao: 'Pedidos marcados como urgentes, enviados no mês.', formato: 'numero', sentido: 'neutro' },
};

type Extrator = (i: Indicadores) => { valor: number | null; base?: string };
const EXTRATORES: Record<string, Extrator> = {
  comunicacao_volume: (i) => ({ valor: i.volume.total }),
  comunicacao_tempo_revisao: (i) => ({ valor: i.tempoRevisao }),
  comunicacao_tempo_aprovacao: (i) => ({ valor: i.tempoAprovacao }),
  comunicacao_tempo_publicacao: (i) => ({ valor: i.tempoPublicacao }),
  comunicacao_publicados_com_atraso: (i) => ({
    valor: i.publicadosComAtraso.percentual,
    base: i.publicadosComAtraso.publicados ? `${i.publicadosComAtraso.atrasados} de ${i.publicadosComAtraso.publicados}` : undefined,
  }),
  comunicacao_urgentes: (i) => ({ valor: i.urgentes }),
};

/** Lança `ErroPermissao` sem `comunicacao.indicadores`. */
export async function indicadoresDaPlataforma(p: Planilhas, quem: Autorizador, periodo: PeriodoDoPainel): Promise<IndicadorCalculado[]> {
  if (!quem.temPermissao('comunicacao.indicadores')) throw new ErroPermissao();
  const corrente = mesAtualEmBrasilia(periodo.agora ?? new Date());
  const [pedidos, historico, calendario] = await lerTabelas(p, [PedidosComunicacao, HistoricoComunicacao, CalendarioComunicacao] as const);
  const dados = { pedidos: pedidos.todos(), historico: historico.todos(), calendario: calendario.todos() };
  const meses = MESES_DO_ANO(periodo.ano).map((mes) => ({ mes, ind: mes > corrente ? null : montarIndicadores({ ...dados, periodo: periodoDe('mes', mes) }) }));
  return Object.keys(DEFINICOES_COMUNICACAO).map((id) => ({
    definicao: DEFINICOES_COMUNICACAO[id],
    pontos: meses.map(({ mes, ind }): PontoDeIndicador => {
      // Mês futuro: sem dado (nunca 0). Mês passado sem pedidos é um 0 verdadeiro no volume.
      const r = ind ? EXTRATORES[id](ind) : { valor: null };
      return { periodo: mes, valor: r.valor, base: r.base, parcial: mes === corrente };
    }),
  }));
}
