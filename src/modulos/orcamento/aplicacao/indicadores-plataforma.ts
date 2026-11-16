/**
 * Indicadores do Orçamento para o painel da Diretoria (ADR-025): um ponto por exercício.
 * Usa `painelGeral`, a mesma conta do Painel geral do app.
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import type { Planilhas } from '@/nucleo/armazenamento/tabela';
import type { DefinicaoDeIndicador, IndicadorCalculado } from '@/capacidades/indicadores';
import type { Indicadores } from '../dominio/previsao';
import { painelGeral } from './painel-geral';

const anual = { periodicidade: 'ano' as const, formato: 'pct' as const };
export const DEFINICOES_ORCAMENTO: Record<string, DefinicaoDeIndicador> = {
  folha_sobre_receita: { ...anual, id: 'folha_sobre_receita', nome: 'Folha sobre a receita', explicacao: 'Quanto da receita prevista do ano vai para pessoal (recursos humanos).', sentido: 'menos' },
  dependencia_recursos_publicos: { ...anual, id: 'dependencia_recursos_publicos', nome: 'Dependência de recursos públicos', explicacao: 'Quanto da receita prevista vem de recursos públicos.', sentido: 'menos' },
  recursos_livres: { ...anual, id: 'recursos_livres', nome: 'Recursos livres', explicacao: 'Quanto da receita prevista pode ser usada sem destino obrigatório.', sentido: 'mais' },
  resultado_previsto: { id: 'resultado_previsto', nome: 'Resultado previsto', explicacao: 'Receita prevista menos despesa prevista do exercício.', periodicidade: 'ano', formato: 'moeda', sentido: 'mais' },
};

const LEITURA: Record<string, (i: Indicadores) => number | null> = {
  folha_sobre_receita: (i) => i.folhaSobreReceita,
  dependencia_recursos_publicos: (i) => i.dependenciaPublica,
  recursos_livres: (i) => i.recursosLivres,
  resultado_previsto: (i) => i.resultado,
};

/** Lança `ErroPermissao` sem `orcamento.painel.ver`. O ano do painel não filtra: mostra todos os exercícios. */
export async function indicadoresDaPlataforma(p: Planilhas, quem: Autorizador): Promise<IndicadorCalculado[]> {
  const geral = await painelGeral(p, quem);
  return Object.keys(DEFINICOES_ORCAMENTO).map((id) => ({
    definicao: DEFINICOES_ORCAMENTO[id],
    pontos: geral.anos.map((a) => ({ periodo: String(a.ano), valor: LEITURA[id](a.indicadores) })),
  }));
}
