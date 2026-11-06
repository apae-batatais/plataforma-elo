/**
 * Painel da Avaliação Diagnóstica: números agregados por serviço atual.
 * Nada aqui identifica pessoas: só contagens, percentuais e a distribuição do índice.
 * Regras puras, sem planilha.
 */
import { EVOLUCOES, GRAUS_DEPENDENCIA, temViolacao, type DadosAvaliacao } from './avaliacao';

export type AvaliacaoParaPainel = Pick<
  DadosAvaliacao,
  | 'servico'
  | 'evolucao_usuario'
  | 'evolucao_familia'
  | 'grau_dependencia'
  | 'isolamento'
  | 'rede_apoio'
  | 'cuidador_idoso'
  | 'mae_solo'
  | 'enfermagem'
  | 'transporte'
  | 'bpc'
  | 'barreiras'
> & { servicoNome: string; indice: number };

/** Indicadores da tabela "por serviço", na ordem em que aparecem. */
export const INDICADORES: { codigo: string; nome: string; tem: (a: AvaliacaoParaPainel) => boolean }[] = [
  { codigo: 'isolamento', nome: 'Isolamento social', tem: (a) => a.isolamento === 'Sim' },
  { codigo: 'sem_rede', nome: 'Sem rede de apoio', tem: (a) => a.rede_apoio === 'Não' },
  { codigo: 'sobrecarga', nome: 'Sobrecarga do cuidador', tem: (a) => a.barreiras.includes('sobrecarga') },
  { codigo: 'cuidador_idoso', nome: 'Cuidador idoso', tem: (a) => a.cuidador_idoso === 'Sim' },
  { codigo: 'mae_solo', nome: 'Mãe solo', tem: (a) => a.mae_solo === 'Sim' },
  { codigo: 'enfermagem', nome: 'Apoio de enfermagem', tem: (a) => a.enfermagem === 'Sim' },
  { codigo: 'cadeirante', nome: 'Usa cadeira de rodas', tem: (a) => a.transporte === 'Cadeirante' },
  { codigo: 'bpc', nome: 'Recebe BPC', tem: (a) => a.bpc === 'Sim' },
  { codigo: 'violacao', nome: 'Suspeita de violação de direitos', tem: (a) => temViolacao(a.barreiras) },
];

type Contagem<K extends string> = Record<K, number>;

export interface ResumoServico {
  servico: string;
  nome: string;
  pessoas: number;
  /** Índice de cada pessoa, em ordem crescente (para o gráfico de pontos). */
  indices: number[];
  mediana: number;
  media: number;
  dependencia: Contagem<(typeof GRAUS_DEPENDENCIA)[number]>;
  evolucaoPessoa: Contagem<(typeof EVOLUCOES)[number]>;
  evolucaoFamilia: Contagem<(typeof EVOLUCOES)[number]>;
  /** Pessoas com cada indicador (código → quantidade). */
  indicadores: Record<string, number>;
}

export interface PainelAvaliacao {
  total: number;
  mediaIndice: number | null;
  grauIII: number;
  regrediram: number;
  violacao: number;
  servicos: ResumoServico[];
  /** Todos os serviços juntos (para a coluna "Todos"). */
  geral: ResumoServico | null;
}

export function mediana(valores: readonly number[]): number {
  if (!valores.length) return 0;
  const o = [...valores].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

const umaCasa = (v: number) => Math.round(v * 10) / 10;

function resumir(servico: string, nome: string, lista: AvaliacaoParaPainel[]): ResumoServico {
  const conta = <K extends string>(chaves: readonly K[], f: (a: AvaliacaoParaPainel) => string) =>
    Object.fromEntries(chaves.map((k) => [k, lista.filter((a) => f(a) === k).length])) as Contagem<K>;
  const indices = lista.map((a) => a.indice).sort((a, b) => a - b);
  return {
    servico,
    nome,
    pessoas: lista.length,
    indices,
    mediana: mediana(indices),
    media: lista.length ? umaCasa(indices.reduce((s, v) => s + v, 0) / lista.length) : 0,
    dependencia: conta(GRAUS_DEPENDENCIA, (a) => a.grau_dependencia),
    evolucaoPessoa: conta(EVOLUCOES, (a) => a.evolucao_usuario),
    evolucaoFamilia: conta(EVOLUCOES, (a) => a.evolucao_familia),
    indicadores: Object.fromEntries(INDICADORES.map((i) => [i.codigo, lista.filter(i.tem).length])),
  };
}

/** Monta o painel. Serviços com mais pessoas avaliadas aparecem primeiro. */
export function montarPainel(lista: AvaliacaoParaPainel[]): PainelAvaliacao {
  const porServico = new Map<string, AvaliacaoParaPainel[]>();
  for (const a of lista) porServico.set(a.servico, [...(porServico.get(a.servico) ?? []), a]);
  const servicos = [...porServico]
    .map(([codigo, l]) => resumir(codigo, l[0].servicoNome, l))
    .sort((a, b) => b.pessoas - a.pessoas || a.nome.localeCompare(b.nome, 'pt-BR'));
  return {
    total: lista.length,
    mediaIndice: lista.length ? umaCasa(lista.reduce((s, a) => s + a.indice, 0) / lista.length) : null,
    grauIII: lista.filter((a) => a.grau_dependencia === 'III').length,
    regrediram: lista.filter((a) => a.evolucao_usuario === 'Regrediu').length,
    violacao: lista.filter((a) => temViolacao(a.barreiras)).length,
    servicos,
    geral: lista.length ? resumir('todos', 'Todos', lista) : null,
  };
}

/** Percentual inteiro (0 quando não há base). */
export const percentual = (parte: number, total: number) => (total ? Math.round((parte / total) * 100) : 0);
