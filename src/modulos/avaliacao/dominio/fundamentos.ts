/**
 * Base técnica e legal do instrumento da Assistência Social: de onde
 * vem cada grupo de perguntas. Mostrado na tela "Sobre o instrumento".
 *
 * Referências normativas federais; a periodicidade anual e o índice de
 * necessidade de cuidado são decisões técnicas da instituição (não são norma).
 */

export interface Norma {
  sigla: string;
  nome: string;
  /** O que a norma diz que sustenta o instrumento. */
  usoNoInstrumento: string;
}

export const NORMAS: Norma[] = [
  {
    sigla: 'LOAS',
    nome: 'Lei nº 8.742/1993 (Lei Orgânica da Assistência Social)',
    usoNoInstrumento:
      'Organiza a assistência social e a proteção à família, à pessoa com deficiência e à pessoa idosa. O art. 20 institui o Benefício de Prestação Continuada (pergunta "Recebe BPC").',
  },
  {
    sigla: 'Tipificação',
    nome: 'Resolução CNAS nº 109/2009 (Tipificação Nacional de Serviços Socioassistenciais)',
    usoNoInstrumento:
      'Descreve o Serviço de Proteção Social Especial para Pessoas com Deficiência, Idosas e suas Famílias (média complexidade): pessoas com algum grau de dependência, violações de direitos que agravam a dependência e a redução da sobrecarga do cuidador. Prevê estudo social, diagnóstico socioeconômico e plano individual ou familiar de atendimento, no domicílio, em centro-dia, no CREAS ou em Unidade Referenciada.',
  },
  {
    sigla: 'NOB-SUAS',
    nome: 'Resolução CNAS nº 33/2012 (Norma Operacional Básica do SUAS)',
    usoNoInstrumento:
      'Estabelece a vigilância socioassistencial: identificar vulnerabilidades e riscos e acompanhar a oferta dos serviços. É a base do painel por serviço e da comparação ao longo do tempo.',
  },
  {
    sigla: 'LBI',
    nome: 'Lei nº 13.146/2015 (Lei Brasileira de Inclusão da Pessoa com Deficiência)',
    usoNoInstrumento:
      'O art. 2º define a deficiência pela interação dos impedimentos com as barreiras e manda considerar fatores socioambientais, limitação de atividades e restrição de participação (avaliação biopsicossocial). O art. 26 obriga a notificação de suspeita ou confirmação de violência contra a pessoa com deficiência.',
  },
  {
    sigla: 'Estatuto da Pessoa Idosa',
    nome: 'Lei nº 10.741/2003',
    usoNoInstrumento:
      'Garante à pessoa idosa prioridade e convivência familiar e comunitária. O art. 19 obriga a notificação de suspeita ou confirmação de violência contra a pessoa idosa.',
  },
  {
    sigla: 'RDC 502/2021',
    nome: 'Resolução da Diretoria Colegiada Anvisa nº 502/2021',
    usoNoInstrumento: 'Define os graus de dependência I, II e III usados na pergunta "Grau de dependência".',
  },
  {
    sigla: 'LGPD',
    nome: 'Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais)',
    usoNoInstrumento:
      'Dados de saúde e de violência são dados pessoais sensíveis (art. 11). Por isso a pessoa é identificada só por iniciais, nascimento e sexo, o painel não identifica ninguém e cada abertura de avaliação fica registrada.',
  },
];

export interface GrupoPerguntas {
  grupo: string;
  perguntas: string;
  base: string;
}

/** Cada grupo de perguntas e a norma que o sustenta. */
export const FUNDAMENTOS: GrupoPerguntas[] = [
  {
    grupo: 'Tipo de avaliação e serviço atual',
    perguntas: 'Inicial ou acompanhamento anual; serviço em que a pessoa é atendida.',
    base: 'Tipificação (estudo social e plano de atendimento na entrada; acompanhamento durante o serviço); NOB-SUAS (vigilância socioassistencial).',
  },
  {
    grupo: 'Evolução',
    perguntas: 'Evolução da pessoa atendida e da família desde a avaliação anterior.',
    base: 'Tipificação (aquisições esperadas dos usuários e redução da dependência); NOB-SUAS (acompanhamento dos resultados).',
  },
  {
    grupo: 'Família e cuidado',
    perguntas: 'Principal cuidador, cuidador idoso, mãe solo, rede de apoio, mais de uma pessoa com deficiência no núcleo, adultos acima de 30 anos.',
    base: 'Tipificação (apoio à família na tarefa de cuidar e redução da sobrecarga do cuidador); Estatuto da Pessoa Idosa (cuidador idoso).',
  },
  {
    grupo: 'Proteção social e convivência',
    perguntas: 'Recebe BPC, isolamento social, transporte necessário.',
    base: 'LOAS art. 20 (BPC); LBI art. 2º (barreiras e restrição de participação; acessibilidade no transporte); Estatuto da Pessoa Idosa (convivência familiar e comunitária).',
  },
  {
    grupo: 'Deficiência, dependência e saúde',
    perguntas: 'Grau de deficiência, grau de dependência, ostomia ou dispositivo, apoio de enfermagem.',
    base: 'LBI art. 2º (impedimentos e limitação de atividades); RDC Anvisa 502/2021 (graus de dependência); Tipificação (público com dependência).',
  },
  {
    grupo: 'Barreiras e violação de direitos',
    perguntas:
      'Sobrecarga do cuidador, ausência de apoio adequado, abandono, apropriação de rendimentos e suspeitas de violência física, psicológica e sexual.',
    base: 'Tipificação (violações de direitos que agravam a dependência); LBI art. 26 e Estatuto da Pessoa Idosa art. 19 (notificação obrigatória de violência).',
  },
];

/** Decisões técnicas da instituição (não são norma), escritas para quem lê a avaliação. */
export const DECISOES_TECNICAS = [
  'Periodicidade: a avaliação inicial é feita quando a pessoa é encaminhada ao serviço e o acompanhamento, uma vez por ano. A Tipificação pede estudo social, diagnóstico e plano de atendimento; o prazo anual é decisão da instituição.',
  'Índice de necessidade de cuidado (0 a 12): soma os fatores de risco previstos nas normas acima (grau de dependência vale até 2 pontos; cada outro fator, 1). É um apoio à análise técnica criado pela instituição, não uma escala oficial.',
  'Comparação entre avaliações: a mesma pessoa é reconhecida pelas iniciais, data de nascimento e sexo. Índice menor na avaliação mais recente indica menos necessidade de cuidado, ou seja, melhora na qualidade de vida.',
];
