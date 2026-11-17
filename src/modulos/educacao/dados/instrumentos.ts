/**
 * Os três instrumentos de Educação (documento validado pela Diretoria, issue #163), versão 1.
 * São DADOS: entram na aba Instrumentos na primeira vez que o app é usado. O texto, a dimensão e a
 * etiqueta CIF de cada item seguem exatamente a especificação; mudar um texto cria nova versão (ADR-007).
 * A dimensão (Evolução, Adequação, Barreira) é o domínio do motor; a CIF é só etiqueta e não entra na conta.
 */
import { definirInstrumento, type EntradaInstrumento, type Instrumento } from '@/capacidades/motor-avaliacao';

export const DIMENSOES = [
  { codigo: 'evolucao', nome: 'Evolução' },
  { codigo: 'adequacao', nome: 'Adequação' },
  { codigo: 'barreira', nome: 'Barreira' },
] as const;

const FAIXAS = [
  { nome: 'Não evoluindo / serviço potencialmente inadequado', de: 0, ate: 10 },
  { nome: 'Evolução parcial / sinais de estagnação', de: 11, ate: 20 },
  { nome: 'Evoluindo adequadamente', de: 21, ate: 30 },
];

type Linha = readonly [texto: string, dimensao: 'evolucao' | 'adequacao' | 'barreira', cif: string];

function montar(codigo: string, nome: string, linhas: readonly Linha[]): EntradaInstrumento {
  return {
    codigo,
    versao: 1,
    eixo: 'educacao',
    nome,
    dominios: DIMENSOES.map((d) => ({ ...d })),
    itens: linhas.map(([texto, dominio, etiqueta], i) => ({ numero: i + 1, texto, dominio, etiqueta })),
    faixas: FAIXAS,
  };
}

export const REFERENCIAIS: Record<string, string> = {
  educacao_infantil:
    'Guia Portage (Motor, Cognição, Linguagem, Autocuidados, Socialização) + BNCC/Currículo Paulista (Campos de Experiência) + CIF.',
  ensino_fundamental:
    'CFN (Inventário Ecológico, ambientes naturais, generalização) + BNCC/Currículo Paulista (Linguagens, Matemática) + CIF.',
  educacao_trabalho: 'CFN + itinerários formativos BNCC/Currículo Paulista + CIF.',
};

export const INSTRUMENTOS_EDUCACAO: readonly Instrumento[] = [
  definirInstrumento(
    montar('educacao_infantil', 'Educação Infantil', [
      ['Desenvolvimento motor', 'evolucao', 'd4/b7'],
      ['Desenvolvimento da linguagem e comunicação', 'evolucao', 'd3'],
      ['Desenvolvimento socioafetivo', 'evolucao', 'd7'],
      ['Habilidades cognitivas básicas', 'evolucao', 'd1'],
      ['Adequação do PEI ao perfil atual', 'adequacao', 'e5'],
      ['Adequação de turma, turno e recursos de acessibilidade', 'adequacao', 'e1/e5'],
      ['Frequência e assiduidade', 'barreira', 'e5'],
      ['Impacto de condições de saúde na participação', 'barreira', 'b/s'],
      ['Engajamento da família', 'barreira', 'e3'],
      ['Comportamentos que dificultam a permanência em sala', 'barreira', 'b1'],
    ]),
  ),
  definirInstrumento(
    montar('ensino_fundamental', 'Ensino Fundamental', [
      ['Comunicação funcional em situações reais', 'evolucao', 'd3'],
      ['Independência em atividades de vida diária, em ambientes naturais', 'evolucao', 'd5'],
      ['Habilidades acadêmicas funcionais (leitura, escrita, matemática aplicadas)', 'evolucao', 'd1'],
      ['Generalização das habilidades para ambientes naturais', 'evolucao', 'd9'],
      ['Adequação do PEI construído a partir do Inventário Ecológico', 'adequacao', 'e5'],
      ['Adequação dos ambientes de ensino e idade cronológica', 'adequacao', 'e1/e5'],
      ['Frequência e assiduidade', 'barreira', 'e5'],
      ['Impacto de condições de saúde', 'barreira', 'b/s'],
      ['Engajamento da família na generalização das habilidades', 'barreira', 'e3'],
      ['Comportamentos que dificultam a participação nos ambientes naturais', 'barreira', 'b1'],
    ]),
  ),
  definirInstrumento(
    montar('educacao_trabalho', 'Educação para o Trabalho', [
      ['Aquisição de habilidades técnicas/operacionais em ambientes reais', 'evolucao', 'd8'],
      ['Habilidades socioprofissionais (pontualidade, equipe, comunicação)', 'evolucao', 'd7/d8'],
      ['Autonomia na execução de tarefas e rotinas laborais', 'evolucao', 'd2'],
      ['Avanço em direção a metas de inserção produtiva', 'evolucao', 'd8'],
      ['Adequação do percurso formativo/itinerário ao perfil vocacional', 'adequacao', 'e5'],
      ['Adequação do Plano Individual de Atendimento/Capacitação', 'adequacao', 'e5'],
      ['Frequência e assiduidade', 'barreira', 'e5'],
      ['Impacto de condições de saúde', 'barreira', 'b/s'],
      ['Suporte familiar e barreiras de transporte/deslocamento', 'barreira', 'e3/e1'],
      ['Comportamentos/aspectos socioemocionais que dificultam a inserção', 'barreira', 'b1'],
    ]),
  ),
];
