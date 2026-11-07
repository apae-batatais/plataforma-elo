/**
 * Comparativo das avaliações da mesma pessoa: a evolução do índice de
 * necessidade de cuidado e de cada resposta entre a primeira e a última.
 * Índice menor = menos necessidade de cuidado = melhora na qualidade de vida.
 * Regras puras, sem planilha.
 */
import { BARREIRAS, indiceDeCuidado, temViolacao, type DadosAvaliacao } from './avaliacao';

export type Tendencia = 'melhorou' | 'manteve' | 'piorou';

export interface LinhaComparativo {
  grupo: string;
  rotulo: string;
  valores: string[];
  /** Da primeira para a última avaliação; null quando a pergunta só descreve (não é melhor nem pior). */
  tendencia: Tendencia | null;
}

/** Cada item: como mostrar e, quando faz sentido, o "peso de risco" (maior = pior). */
const ITENS: { grupo: string; rotulo: string; valor: (d: DadosAvaliacao) => string; risco?: (d: DadosAvaliacao) => number }[] = [
  { grupo: 'Situação', rotulo: 'Serviço atual', valor: () => '' },
  { grupo: 'Situação', rotulo: 'Evolução da pessoa', valor: (d) => d.evolucao_usuario },
  { grupo: 'Situação', rotulo: 'Evolução da família', valor: (d) => d.evolucao_familia },
  {
    grupo: 'Dependência e saúde',
    rotulo: 'Grau de dependência',
    valor: (d) => `Grau ${d.grau_dependencia}`,
    risco: (d) => ['I', 'II', 'III'].indexOf(d.grau_dependencia),
  },
  { grupo: 'Dependência e saúde', rotulo: 'Grau de deficiência', valor: (d) => d.grau_deficiencia },
  { grupo: 'Dependência e saúde', rotulo: 'Apoio de enfermagem', valor: (d) => d.enfermagem, risco: (d) => Number(d.enfermagem === 'Sim') },
  {
    grupo: 'Dependência e saúde',
    rotulo: 'Ostomia ou dispositivo',
    valor: (d) => (d.ostomia === 'Sim' ? d.ostomia_tipo || 'Sim' : 'Não'),
    risco: (d) => Number(d.ostomia === 'Sim'),
  },
  { grupo: 'Família e convivência', rotulo: 'Principal cuidador', valor: (d) => d.cuidador },
  { grupo: 'Família e convivência', rotulo: 'Cuidador idoso', valor: (d) => d.cuidador_idoso, risco: (d) => Number(d.cuidador_idoso === 'Sim') },
  { grupo: 'Família e convivência', rotulo: 'Mãe solo', valor: (d) => d.mae_solo, risco: (d) => Number(d.mae_solo === 'Sim') },
  { grupo: 'Família e convivência', rotulo: 'Rede de apoio', valor: (d) => d.rede_apoio, risco: (d) => Number(d.rede_apoio === 'Não') },
  { grupo: 'Família e convivência', rotulo: 'Isolamento social', valor: (d) => d.isolamento, risco: (d) => Number(d.isolamento === 'Sim') },
  { grupo: 'Família e convivência', rotulo: 'Recebe BPC', valor: (d) => d.bpc },
  { grupo: 'Família e convivência', rotulo: 'Transporte', valor: (d) => (d.transporte === 'Rampa' ? 'Com rampa' : d.transporte) },
  ...BARREIRAS.filter((b) => !b.violacao).map((b) => ({
    grupo: 'Barreiras',
    rotulo: b.nome,
    valor: (d: DadosAvaliacao) => (d.barreiras.includes(b.codigo) ? 'Sim' : 'Não'),
    risco: (d: DadosAvaliacao) => Number(d.barreiras.includes(b.codigo)),
  })),
  {
    grupo: 'Barreiras',
    rotulo: 'Suspeita de violação de direitos',
    valor: (d) => (temViolacao(d.barreiras) ? 'Sim' : 'Não'),
    risco: (d) => Number(temViolacao(d.barreiras)),
  },
];

export const tendenciaDe = (antes: number, depois: number): Tendencia => (depois < antes ? 'melhorou' : depois > antes ? 'piorou' : 'manteve');

export interface Comparativo {
  indices: number[];
  /** Índice da última menos o da primeira (negativo = melhorou). */
  variacao: number;
  tendencia: Tendencia;
  linhas: LinhaComparativo[];
  /** Quantos itens com peso de risco melhoraram e pioraram da primeira para a última. */
  itensMelhoraram: number;
  itensPioraram: number;
}

/** Compara as avaliações (em ordem de data, da mais antiga para a mais recente). */
export function compararAvaliacoes(lista: { dados: DadosAvaliacao; servicoNome: string }[]): Comparativo {
  const indices = lista.map((a) => indiceDeCuidado(a.dados));
  const primeiro = lista[0];
  const ultimo = lista[lista.length - 1];
  const linhas: LinhaComparativo[] = ITENS.map((i) => ({
    grupo: i.grupo,
    rotulo: i.rotulo,
    valores: lista.map((a) => (i.rotulo === 'Serviço atual' ? a.servicoNome : i.valor(a.dados) || '—')),
    tendencia: i.risco && lista.length > 1 ? tendenciaDe(i.risco(primeiro.dados), i.risco(ultimo.dados)) : null,
  }));
  const variacao = indices.length ? indices[indices.length - 1] - indices[0] : 0;
  return {
    indices,
    variacao,
    tendencia: tendenciaDe(indices[0] ?? 0, indices[indices.length - 1] ?? 0),
    linhas,
    itensMelhoraram: linhas.filter((l) => l.tendencia === 'melhorou').length,
    itensPioraram: linhas.filter((l) => l.tendencia === 'piorou').length,
  };
}
