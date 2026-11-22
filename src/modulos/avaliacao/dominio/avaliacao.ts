/**
 * Assistência Social: as perguntas, a conferência das respostas e o
 * índice de necessidade de cuidado. Regras puras, sem planilha.
 *
 * A base técnica e legal de cada pergunta está em FUNDAMENTOS (./fundamentos.ts).
 * A avaliação é feita na entrada da pessoa no serviço (inicial) e repetida uma
 * vez por ano (acompanhamento), para comparar a evolução da mesma pessoa.
 *
 * As perguntas seguem as colunas da aba TODOS da planilha de diagnóstico usada
 * hoje pela equipe (Novos Serviços 2027). A identificação é feita por iniciais,
 * data de nascimento e sexo (sem nome completo), como a equipe já faz.
 */

export const SIM_NAO = ['Sim', 'Não'] as const;
export const SEXOS = ['F', 'M'] as const;
export const EVOLUCOES = ['Regrediu', 'Manteve', 'Melhorou'] as const;
export const GRAUS_DEFICIENCIA = ['Leve', 'Moderada', 'Grave', 'Não se aplica'] as const;
export const GRAUS_DEPENDENCIA = ['I', 'II', 'III'] as const;
export const TRANSPORTES = ['Comum', 'Rampa', 'Cadeirante'] as const;
/** Inicial: quando a pessoa é encaminhada ao serviço. Acompanhamento anual: uma vez por ano depois disso. */
export const TIPOS_AVALIACAO = ['Inicial', 'Acompanhamento anual'] as const;
/** De quanto em quanto tempo a pessoa é reavaliada. */
export const MESES_ENTRE_AVALIACOES = 12;
/** A partir de quantos dias antes do vencimento a reavaliação aparece como "vence em breve". */
export const DIAS_AVISO_REAVALIACAO = 30;

/** Grau de dependência conforme a RDC Anvisa nº 502/2021. */
export const DEFINICAO_GRAU: Record<(typeof GRAUS_DEPENDENCIA)[number], string> = {
  I: 'Independente, mesmo que use equipamentos de autoajuda.',
  II: 'Dependência em até três atividades de autocuidado (alimentação, mobilidade, higiene), sem comprometimento cognitivo ou com alteração cognitiva controlada.',
  III: 'Precisa de assistência em todas as atividades de autocuidado ou tem comprometimento cognitivo.',
};

/** Barreiras: as cinco últimas são suspeitas de violação de direitos. */
export const BARREIRAS = [
  { codigo: 'sobrecarga', nome: 'Sobrecarga do cuidador', violacao: false },
  { codigo: 'sem_apoio', nome: 'Ausência de apoio adequado', violacao: false },
  { codigo: 'abandono', nome: 'Abandono familiar', violacao: true },
  { codigo: 'rendimentos', nome: 'Suspeita de apropriação indevida de rendimentos', violacao: true },
  { codigo: 'violencia_fisica', nome: 'Suspeita de violência física', violacao: true },
  { codigo: 'violencia_psicologica', nome: 'Suspeita de violência psicológica', violacao: true },
  { codigo: 'violencia_sexual', nome: 'Suspeita de violência sexual', violacao: true },
] as const;
export const NENHUMA_BARREIRA = 'nenhuma';
export type CodigoBarreira = (typeof BARREIRAS)[number]['codigo'];
const CODIGOS_BARREIRA = new Set<string>(BARREIRAS.map((b) => b.codigo));
const CODIGOS_VIOLACAO = new Set<string>(BARREIRAS.filter((b) => b.violacao).map((b) => b.codigo));

export const CUIDADORES = [
  'Mãe',
  'Pai',
  'Irmã',
  'Irmão',
  'Filha',
  'Filho',
  'Avó',
  'Avô',
  'Esposa',
  'Marido',
  'Companheira',
  'Companheiro',
  'Nora',
  'Genro',
  'Cunhada',
  'Cunhado',
  'Neta',
  'Neto',
  'Tia',
  'Tio',
  'Prima',
  'Primo',
  'Outro familiar',
  'Amiga ou amigo',
  'Vizinha ou vizinho',
  'Cuidador contratado',
] as const;
/** Valor gravado quando a pessoa não tem cuidador principal. */
export const SEM_CUIDADOR = 'Não tem cuidador';

type SimNao = (typeof SIM_NAO)[number];

/** As respostas do questionário, como chegam da tela e como ficam guardadas. */
export interface DadosAvaliacao {
  tipo: (typeof TIPOS_AVALIACAO)[number] | '';
  iniciais: string;
  nascimento: string;
  sexo: (typeof SEXOS)[number] | '';
  prontuario: string;
  servico: string;
  data_avaliacao: string;
  evolucao_usuario: (typeof EVOLUCOES)[number] | '';
  evolucao_familia: (typeof EVOLUCOES)[number] | '';
  cuidador: string;
  bpc: SimNao | '';
  mae_solo: SimNao | '';
  rede_apoio: SimNao | '';
  cuidador_idoso: SimNao | '';
  nucleo_mais_pcd: SimNao | '';
  adultos_30: SimNao | '';
  isolamento: SimNao | '';
  enfermagem: SimNao | '';
  grau_deficiencia: (typeof GRAUS_DEFICIENCIA)[number] | '';
  grau_dependencia: (typeof GRAUS_DEPENDENCIA)[number] | '';
  ostomia: SimNao | '';
  ostomia_tipo: string;
  transporte: (typeof TRANSPORTES)[number] | '';
  /** Códigos das barreiras, ou só "nenhuma". */
  barreiras: string[];
  observacoes: string;
  profissional: string;
  registro_profissional: string;
}

export const AVALIACAO_VAZIA: DadosAvaliacao = {
  tipo: '',
  iniciais: '',
  nascimento: '',
  sexo: '',
  prontuario: '',
  servico: '',
  data_avaliacao: '',
  evolucao_usuario: '',
  evolucao_familia: '',
  cuidador: '',
  bpc: '',
  mae_solo: '',
  rede_apoio: '',
  cuidador_idoso: '',
  nucleo_mais_pcd: '',
  adultos_30: '',
  isolamento: '',
  enfermagem: '',
  grau_deficiencia: '',
  grau_dependencia: '',
  ostomia: '',
  ostomia_tipo: '',
  transporte: '',
  barreiras: [],
  observacoes: '',
  profissional: '',
  registro_profissional: '',
};

/** Nome de cada pergunta, para as mensagens de "falta responder". */
export const ROTULOS: Record<keyof DadosAvaliacao, string> = {
  tipo: 'Tipo de avaliação',
  iniciais: 'Iniciais',
  nascimento: 'Data de nascimento',
  sexo: 'Sexo',
  prontuario: 'Prontuário',
  servico: 'Serviço atual',
  data_avaliacao: 'Data da avaliação',
  evolucao_usuario: 'Evolução da pessoa atendida',
  evolucao_familia: 'Evolução da família',
  cuidador: 'Principal cuidador',
  bpc: 'Recebe BPC',
  mae_solo: 'Mãe solo',
  rede_apoio: 'Rede de apoio',
  cuidador_idoso: 'Cuidador idoso',
  nucleo_mais_pcd: 'Mais de uma pessoa com deficiência no núcleo',
  adultos_30: 'Adultos acima de 30 anos',
  isolamento: 'Isolamento social',
  enfermagem: 'Apoio de enfermagem',
  grau_deficiencia: 'Grau de deficiência',
  grau_dependencia: 'Grau de dependência',
  ostomia: 'Ostomia ou dispositivo',
  ostomia_tipo: 'Qual ostomia ou dispositivo',
  transporte: 'Transporte',
  barreiras: 'Barreiras',
  observacoes: 'Observações',
  profissional: 'Profissional',
  registro_profissional: 'Registro profissional',
};

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const dataValida = (d: string) =>
  DATA.test(d) && !Number.isNaN(new Date(`${d}T12:00:00Z`).getTime()) && new Date(`${d}T12:00:00Z`).toISOString().slice(0, 10) === d;

/** Idade em anos completos na data de referência (null se as datas não servem). */
export function idadeEm(nascimento: string, referencia: string): number | null {
  if (!dataValida(nascimento) || !dataValida(referencia)) return null;
  const [y1, m1, d1] = nascimento.split('-').map(Number);
  const [y2, m2, d2] = referencia.split('-').map(Number);
  let i = y2 - y1;
  if (m2 < m1 || (m2 === m1 && d2 < d1)) i--;
  return i >= 0 && i < 130 ? i : null;
}

export function geracao(idade: number | null): string {
  if (idade === null) return '';
  if (idade >= 60) return 'Pessoa idosa';
  if (idade >= 30) return 'Adulto';
  if (idade >= 18) return 'Jovem';
  return 'Criança ou adolescente';
}

/** Iniciais só com letras maiúsculas (acentos mantidos). */
export const normalizarIniciais = (t: string) => t.toUpperCase().replace(/[^A-ZÀ-ÖØ-Þ]/g, '');

export const temViolacao = (barreiras: readonly string[]) => barreiras.some((b) => CODIGOS_VIOLACAO.has(b));

export class ErroAvaliacao extends Error {}

const OBRIGATORIAS: (keyof DadosAvaliacao)[] = [
  'tipo',
  'iniciais',
  'nascimento',
  'sexo',
  'servico',
  'data_avaliacao',
  'evolucao_usuario',
  'evolucao_familia',
  'cuidador',
  'bpc',
  'mae_solo',
  'rede_apoio',
  'cuidador_idoso',
  'nucleo_mais_pcd',
  'adultos_30',
  'isolamento',
  'enfermagem',
  'grau_deficiencia',
  'grau_dependencia',
  'ostomia',
  'transporte',
];

const LISTAS: Partial<Record<keyof DadosAvaliacao, readonly string[]>> = {
  tipo: TIPOS_AVALIACAO,
  sexo: SEXOS,
  evolucao_usuario: EVOLUCOES,
  evolucao_familia: EVOLUCOES,
  bpc: SIM_NAO,
  mae_solo: SIM_NAO,
  rede_apoio: SIM_NAO,
  cuidador_idoso: SIM_NAO,
  nucleo_mais_pcd: SIM_NAO,
  adultos_30: SIM_NAO,
  isolamento: SIM_NAO,
  enfermagem: SIM_NAO,
  grau_deficiencia: GRAUS_DEFICIENCIA,
  grau_dependencia: GRAUS_DEPENDENCIA,
  ostomia: SIM_NAO,
  transporte: TRANSPORTES,
};

/**
 * Confere e arruma as respostas. Devolve os nomes das perguntas sem resposta
 * válida (vazio = tudo certo) e os dados já normalizados.
 */
export function conferirAvaliacao(bruto: Partial<DadosAvaliacao>, hoje: string): { faltando: (keyof DadosAvaliacao)[]; dados: DadosAvaliacao } {
  const t = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const d = { ...AVALIACAO_VAZIA } as Record<keyof DadosAvaliacao, unknown>;
  for (const k of Object.keys(AVALIACAO_VAZIA) as (keyof DadosAvaliacao)[]) {
    if (k !== 'barreiras') d[k] = t(bruto[k]);
  }
  d.iniciais = normalizarIniciais(d.iniciais as string);
  const barreiras = Array.isArray(bruto.barreiras) ? [...new Set(bruto.barreiras.map(String))] : [];
  d.barreiras = barreiras.includes(NENHUMA_BARREIRA) ? [NENHUMA_BARREIRA] : barreiras.filter((b) => CODIGOS_BARREIRA.has(b));
  if (d.ostomia !== 'Sim') d.ostomia_tipo = '';
  const dados = d as unknown as DadosAvaliacao;

  const faltando = new Set<keyof DadosAvaliacao>();
  for (const k of OBRIGATORIAS) if (!dados[k]) faltando.add(k);
  for (const [k, lista] of Object.entries(LISTAS) as [keyof DadosAvaliacao, readonly string[]][]) {
    if (dados[k] && !lista.includes(dados[k] as string)) faltando.add(k);
  }
  if (dados.iniciais && (dados.iniciais.length < 2 || dados.iniciais.length > 8)) faltando.add('iniciais');
  if (dados.data_avaliacao && (!dataValida(dados.data_avaliacao) || dados.data_avaliacao > hoje)) faltando.add('data_avaliacao');
  if (dados.nascimento && idadeEm(dados.nascimento, dataValida(dados.data_avaliacao) ? dados.data_avaliacao : hoje) === null) faltando.add('nascimento');
  if (dados.ostomia === 'Sim' && !dados.ostomia_tipo) faltando.add('ostomia_tipo');
  if (dados.barreiras.length === 0) faltando.add('barreiras');
  return { faltando: [...faltando], dados };
}

/** Pontos de cada fator do índice (só os que pontuam). */
export function fatoresDoIndice(
  d: Pick<
    DadosAvaliacao,
    | 'grau_dependencia'
    | 'isolamento'
    | 'barreiras'
    | 'rede_apoio'
    | 'cuidador_idoso'
    | 'mae_solo'
    | 'evolucao_usuario'
    | 'evolucao_familia'
    | 'enfermagem'
    | 'ostomia'
  >,
): { nome: string; pontos: number }[] {
  const b = d.barreiras;
  const lista: [string, number][] = [
    [`Dependência grau ${d.grau_dependencia}`, d.grau_dependencia === 'III' ? 2 : d.grau_dependencia === 'II' ? 1 : 0],
    ['Isolamento social', d.isolamento === 'Sim' ? 1 : 0],
    ['Sobrecarga do cuidador', b.includes('sobrecarga') ? 1 : 0],
    ['Sem apoio adequado', b.includes('sem_apoio') ? 1 : 0],
    ['Sem rede de apoio', d.rede_apoio === 'Não' ? 1 : 0],
    ['Cuidador idoso', d.cuidador_idoso === 'Sim' ? 1 : 0],
    ['Mãe solo', d.mae_solo === 'Sim' ? 1 : 0],
    ['Pessoa regrediu', d.evolucao_usuario === 'Regrediu' ? 1 : 0],
    ['Família regrediu', d.evolucao_familia === 'Regrediu' ? 1 : 0],
    ['Suspeita de violação de direitos', temViolacao(b) ? 1 : 0],
    ['Cuidados de saúde', d.enfermagem === 'Sim' || d.ostomia === 'Sim' ? 1 : 0],
  ];
  return lista.filter(([, p]) => p > 0).map(([nome, pontos]) => ({ nome, pontos }));
}

/**
 * Índice de necessidade de cuidado, de 0 a 12: grau de dependência vale até 2
 * pontos (II = 1, III = 2) e cada indicador presente soma 1. Mesmo cálculo do
 * painel dos Novos Serviços 2027. Apoia a análise técnica, não a substitui.
 */
export const indiceDeCuidado = (d: Parameters<typeof fatoresDoIndice>[0]) => fatoresDoIndice(d).reduce((s, f) => s + f.pontos, 0);
export const INDICE_MAXIMO = 12;

/** Lista de barreiras ↔ texto guardado na planilha (códigos separados por vírgula). */
export const barreirasParaTexto = (b: readonly string[]) => b.join(',');
export const barreirasDoTexto = (t: string | null) =>
  t
    ? t
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
    : [];

/**
 * Mesma pessoa em avaliações diferentes: iniciais + data de nascimento + sexo
 * (o prontuário é opcional e pode faltar numa das avaliações).
 */
export const chavePessoa = (d: Pick<DadosAvaliacao, 'iniciais' | 'nascimento' | 'sexo'>) => `${normalizarIniciais(d.iniciais)}|${d.nascimento}|${d.sexo}`;

/** Data (AAAA-MM-DD) em que vence a próxima avaliação: 12 meses depois da última. */
export function proximaAvaliacao(ultima: string): string {
  const [y, m, d] = ultima.split('-').map(Number);
  const alvo = new Date(Date.UTC(y, m - 1 + MESES_ENTRE_AVALIACOES, 1));
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimoDia));
  return alvo.toISOString().slice(0, 10);
}

export type SituacaoReavaliacao = 'em_dia' | 'vence_em_breve' | 'atrasada';

/** Situação da reavaliação anual a partir da última avaliação da pessoa. */
export function situacaoReavaliacao(ultima: string, hoje: string): { vence: string; situacao: SituacaoReavaliacao; dias: number } {
  const vence = proximaAvaliacao(ultima);
  const dias = Math.round((Date.parse(`${vence}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) / 86_400_000);
  return { vence, dias, situacao: dias < 0 ? 'atrasada' : dias <= DIAS_AVISO_REAVALIACAO ? 'vence_em_breve' : 'em_dia' };
}
