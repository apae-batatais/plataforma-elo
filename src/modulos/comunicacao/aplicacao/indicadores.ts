/**
 * Indicadores da Comunicação (coordenação e Diretoria: `comunicacao.indicadores`).
 * Só lê; nenhum dado pessoal sai daqui (só contagens, médias e títulos de temas do calendário).
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { feriadosAtivos } from '@/nucleo/feriados/feriados';
import { Areas } from '@/nucleo/estrutura/tabelas';
import { CalendarioComunicacao, HistoricoComunicacao, PedidosComunicacao } from '../dados/tabelas';
import { montarIndicadores, type Indicadores, type PeriodoIndicadores } from '../dominio/indicadores';
import { ErroComunicacao } from '../dominio/pedido';
import { dataValida } from './calendario';

export async function indicadoresComunicacao(
  p: Planilhas,
  quem: Autorizador,
  periodo: PeriodoIndicadores,
): Promise<Indicadores & { areas: Array<{ nome: string; total: number }> }> {
  if (!quem.temPermissao('comunicacao.indicadores')) throw new ErroPermissao();
  if (!dataValida(periodo.inicio) || !dataValida(periodo.fim) || periodo.fim < periodo.inicio) throw new ErroComunicacao('Informe um período válido.');
  const [pedidos, historico, calendario, areas] = await lerTabelas(p, [PedidosComunicacao, HistoricoComunicacao, CalendarioComunicacao, Areas] as const);
  const ind = montarIndicadores({ pedidos: pedidos.todos(), historico: historico.todos(), calendario: calendario.todos(), periodo, feriados: await feriadosAtivos(p) });
  const nomes = new Map(areas.todos().map((a) => [a.codigo, a.nome]));
  const areasComNome = Object.entries(ind.volume.porArea)
    .map(([codigo, total]) => ({ nome: nomes.get(codigo) ?? codigo, total }))
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));
  return { ...ind, areas: areasComNome };
}
