/**
 * Painel da Assistência Social: números agregados por serviço atual.
 * Nada aqui identifica pessoas: só contagens, percentuais e a distribuição do índice.
 *
 * Retrato atual: cada pessoa conta uma vez, pela avaliação mais recente.
 * Evolução: pessoas com duas ou mais avaliações, comparando a primeira e a última.
 * Regras puras, sem planilha.
 */
import { EVOLUCOES, geracao, GRAUS_DEPENDENCIA, situacaoReavaliacao, TRANSPORTES, temViolacao, type DadosAvaliacao } from './avaliacao';
import { tendenciaDe, type Tendencia } from './comparativo';

export type AvaliacaoParaPainel = Pick<
  DadosAvaliacao,
  | 'servico'
  | 'sexo'
  | 'tipo'
  | 'data_avaliacao'
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
> & { servicoNome: string; indice: number; idade: number | null; chave: string };

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

/** Indicadores comparados entre mulheres e homens. */
export const INDICADORES_SEXO: { nome: string; tem: (a: AvaliacaoParaPainel) => boolean }[] = [
  { nome: 'Dependência grau III', tem: (a) => a.grau_dependencia === 'III' },
  { nome: 'Pessoa regrediu', tem: (a) => a.evolucao_usuario === 'Regrediu' },
  ...INDICADORES.filter((i) => i.codigo !== 'mae_solo').map((i) => ({ nome: i.nome, tem: i.tem })),
];

export const GERACOES = ['Pessoa idosa', 'Adulto', 'Jovem', 'Criança ou adolescente'] as const;
export const FAIXAS: Record<(typeof GERACOES)[number], string> = {
  'Pessoa idosa': '60+',
  Adulto: '30 a 59',
  Jovem: '18 a 29',
  'Criança ou adolescente': '0 a 17',
};
export const TENDENCIAS = ['melhorou', 'manteve', 'piorou'] as const;

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
  transporte: Contagem<(typeof TRANSPORTES)[number]>;
  /** Pessoas com cada indicador (código → quantidade). */
  indicadores: Record<string, number>;
  /** Pessoas com duas ou mais avaliações, pela variação do índice da primeira para a última. */
  entreAvaliacoes: Contagem<Tendencia>;
  /** Média do índice na primeira e na última avaliação dessas pessoas. */
  mediaPrimeira: number | null;
  mediaUltima: number | null;
}

export interface IndicadorPorSexo {
  nome: string;
  f: number;
  totalF: number;
  m: number;
  totalM: number;
}

export interface PainelAvaliacao {
  /** Pessoas (cada uma conta uma vez). */
  total: number;
  /** Avaliações no período (inclusive as anteriores da mesma pessoa). */
  avaliacoes: number;
  mediaIndice: number | null;
  grauIII: number;
  regrediram: number;
  violacao: number;
  reavaliacao: { atrasadas: number; venceEmBreve: number };
  /** Pessoas com duas ou mais avaliações. */
  comparadas: number;
  servicos: ResumoServico[];
  /** Todos os serviços juntos (para a coluna "Todos"). */
  geral: ResumoServico | null;
  sexo: { f: number; m: number };
  piramide: { geracao: (typeof GERACOES)[number]; faixa: string; f: number; m: number }[];
  indicadoresPorSexo: IndicadorPorSexo[];
}

export function mediana(valores: readonly number[]): number {
  if (!valores.length) return 0;
  const o = [...valores].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

const umaCasa = (v: number) => Math.round(v * 10) / 10;
const media = (v: number[]) => (v.length ? umaCasa(v.reduce((s, x) => s + x, 0) / v.length) : null);
const ordem = (a: AvaliacaoParaPainel, b: AvaliacaoParaPainel) => a.data_avaliacao.localeCompare(b.data_avaliacao);

interface Pessoa {
  atual: AvaliacaoParaPainel;
  primeira: AvaliacaoParaPainel;
  quantas: number;
}

function resumir(servico: string, nome: string, pessoas: Pessoa[]): ResumoServico {
  const lista = pessoas.map((p) => p.atual);
  const conta = <K extends string>(chaves: readonly K[], f: (a: AvaliacaoParaPainel) => string) =>
    Object.fromEntries(chaves.map((k) => [k, lista.filter((a) => f(a) === k).length])) as Contagem<K>;
  const indices = lista.map((a) => a.indice).sort((a, b) => a - b);
  const comparadas = pessoas.filter((p) => p.quantas > 1);
  const tend = comparadas.map((p) => tendenciaDe(p.primeira.indice, p.atual.indice));
  return {
    servico,
    nome,
    pessoas: lista.length,
    indices,
    mediana: mediana(indices),
    media: media(indices) ?? 0,
    dependencia: conta(GRAUS_DEPENDENCIA, (a) => a.grau_dependencia),
    evolucaoPessoa: conta(EVOLUCOES, (a) => a.evolucao_usuario),
    evolucaoFamilia: conta(EVOLUCOES, (a) => a.evolucao_familia),
    transporte: conta(TRANSPORTES, (a) => a.transporte),
    indicadores: Object.fromEntries(INDICADORES.map((i) => [i.codigo, lista.filter(i.tem).length])),
    entreAvaliacoes: Object.fromEntries(TENDENCIAS.map((t) => [t, tend.filter((x) => x === t).length])) as Contagem<Tendencia>,
    mediaPrimeira: media(comparadas.map((p) => p.primeira.indice)),
    mediaUltima: media(comparadas.map((p) => p.atual.indice)),
  };
}

/** Agrupa as avaliações por pessoa: a mais recente é o retrato atual. */
export function porPessoa(lista: AvaliacaoParaPainel[]): Pessoa[] {
  const grupos = new Map<string, AvaliacaoParaPainel[]>();
  for (const a of lista) grupos.set(a.chave, [...(grupos.get(a.chave) ?? []), a]);
  return [...grupos.values()].map((g) => {
    const o = [...g].sort(ordem);
    return { atual: o[o.length - 1], primeira: o[0], quantas: o.length };
  });
}

/** Monta o painel. Serviços com mais pessoas aparecem primeiro. */
export function montarPainel(lista: AvaliacaoParaPainel[], hoje: string): PainelAvaliacao {
  const pessoas = porPessoa(lista);
  const atuais = pessoas.map((p) => p.atual);
  const porServico = new Map<string, Pessoa[]>();
  for (const p of pessoas) porServico.set(p.atual.servico, [...(porServico.get(p.atual.servico) ?? []), p]);
  const servicos = [...porServico]
    .map(([codigo, l]) => resumir(codigo, l[0].atual.servicoNome, l))
    .sort((a, b) => b.pessoas - a.pessoas || a.nome.localeCompare(b.nome, 'pt-BR'));
  const situacoes = atuais.map((a) => situacaoReavaliacao(a.data_avaliacao, hoje).situacao);
  const F = atuais.filter((a) => a.sexo === 'F');
  const M = atuais.filter((a) => a.sexo === 'M');
  return {
    total: atuais.length,
    avaliacoes: lista.length,
    mediaIndice: media(atuais.map((a) => a.indice)),
    grauIII: atuais.filter((a) => a.grau_dependencia === 'III').length,
    regrediram: atuais.filter((a) => a.evolucao_usuario === 'Regrediu').length,
    violacao: atuais.filter((a) => temViolacao(a.barreiras)).length,
    reavaliacao: { atrasadas: situacoes.filter((s) => s === 'atrasada').length, venceEmBreve: situacoes.filter((s) => s === 'vence_em_breve').length },
    comparadas: pessoas.filter((p) => p.quantas > 1).length,
    servicos,
    geral: atuais.length ? resumir('todos', 'Todos', pessoas) : null,
    sexo: { f: F.length, m: M.length },
    piramide: GERACOES.map((g) => ({
      geracao: g,
      faixa: FAIXAS[g],
      f: F.filter((a) => geracao(a.idade) === g).length,
      m: M.filter((a) => geracao(a.idade) === g).length,
    })),
    indicadoresPorSexo: INDICADORES_SEXO.map((i) => ({
      nome: i.nome,
      f: F.filter(i.tem).length,
      totalF: F.length,
      m: M.filter(i.tem).length,
      totalM: M.length,
    })),
  };
}

/** Percentual inteiro (0 quando não há base). */
export const percentual = (parte: number, total: number) => (total ? Math.round((parte / total) * 100) : 0);
