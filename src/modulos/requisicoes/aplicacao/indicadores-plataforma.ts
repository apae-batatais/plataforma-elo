/**
 * Indicadores das Requisições para o painel da Diretoria (ADR-025).
 * Usa o mesmo cálculo do Painel de prazos (`painelDePrazos`): os números nunca divergem.
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import type { Planilhas } from '@/nucleo/armazenamento/tabela';
import { mesAtualEmBrasilia, type DefinicaoDeIndicador, type IndicadorCalculado, type PeriodoDoPainel } from '@/capacidades/indicadores';
import type { Contagem } from '../dominio/painel';
import { painelDePrazos } from './requisicoes';

const definicao = (id: string, nome: string, explicacao: string): DefinicaoDeIndicador => ({
  id,
  nome,
  explicacao,
  formato: 'pct',
  sentido: 'mais',
  periodicidade: 'mes',
});

export const DEFINICOES_REQUISICOES = {
  aprovacao: definicao('requisicoes_aprovacao_no_prazo', 'Aprovadas no prazo', 'Das requisições decididas no mês, quantas foram decididas dentro do prazo do tipo.'),
  atendimento: definicao('requisicoes_atendimento_no_prazo', 'Atendidas no prazo', 'Das requisições concluídas no mês, quantas foram atendidas dentro do prazo do tipo.'),
};

/** Lança `ErroPermissao` se a pessoa não tem o painel de prazos em nenhum escopo. */
export async function indicadoresDaPlataforma(p: Planilhas, quem: Autorizador, periodo: PeriodoDoPainel): Promise<IndicadorCalculado[]> {
  const agora = periodo.agora ?? new Date();
  const painel = await painelDePrazos(p, quem, { de: `${periodo.ano}-01`, ate: `${periodo.ano}-12` }, { agora });
  const corrente = mesAtualEmBrasilia(agora);
  const pontos = (escolher: (i: number) => Contagem) =>
    painel.meses.map((mes, i) => {
      const c = escolher(i);
      return { periodo: mes, valor: c.pct, base: c.total ? `${c.noPrazo} de ${c.total}` : undefined, parcial: mes === corrente };
    });
  return [
    { definicao: DEFINICOES_REQUISICOES.aprovacao, pontos: pontos((i) => painel.porMes[i].aprovacao) },
    { definicao: DEFINICOES_REQUISICOES.atendimento, pontos: pontos((i) => painel.porMes[i].atendimento) },
  ];
}
