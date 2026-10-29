/**
 * Abas do módulo Orçamento.
 *
 * - Planilha "orcamento_folha": a folha. Salários são dados pessoais, então
 *   ficam numa planilha à parte, que pode ter compartilhamento mais restrito.
 * - Os "centros de custo" são os Serviços do Núcleo (Administração › Serviços).
 * - Planilha "orcamento": a previsão (Entrega 1B). Não tem dados pessoais.
 *
 * Abas com vigência (Componentes e Lotacoes) só recebem
 * inclusões: mudar um valor grava uma linha nova, e a mais recente vale a
 * partir da sua vigência. Assim o histórico mês a mês é preservado.
 */
import { z } from 'zod';
import { booleano, dataOpcional, definirTabela, numeroOpcional, texto, textoOpcional, type Registro } from '@/nucleo/armazenamento/tabela';
import { COMPONENTES } from '../dominio/folha';

const vazio = (v: unknown) => v === undefined || v === null || v === '';
const numero = () => z.preprocess((v) => (vazio(v) ? undefined : typeof v === 'number' ? v : Number(String(v).replace(',', '.'))), z.number());
const data = () => z.preprocess((v) => (vazio(v) ? undefined : String(v).trim()), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data no formato AAAA-MM-DD'));

export const PLANILHA_ORCAMENTO = 'orcamento';
export const PLANILHA_FOLHA = 'orcamento_folha';

/** Funcionários e vagas previstas (colunas de identificação da aba Estudo). */
export const Postos = definirTabela({
  planilha: PLANILHA_FOLHA,
  aba: 'Funcionarios',
  esquema: z.object({
    /** Código do funcionário. Sem código = vaga prevista. */
    ficha: textoOpcional(),
    /** Nome do funcionário (ou descrição da vaga, ex.: "A contratar – Fisioterapeuta"). */
    colaborador: textoOpcional(),
    cargo: texto(),
    departamento: textoOpcional(),
    /** Carga horária mensal (ex.: 200, 220). */
    carga_horaria: numeroOpcional(),
    /** Admissão, ou mês de início da vaga prevista. */
    inicio: data(),
    desligamento: dataOpcional(),
    observacao: textoOpcional(),
  }),
  sigilo: { colaborador: 'pessoal' },
});

const colunasComponentes = Object.fromEntries(COMPONENTES.map((c) => [c.chave, numeroOpcional()])) as Record<
  (typeof COMPONENTES)[number]['chave'],
  ReturnType<typeof numeroOpcional>
>;

export const Componentes = definirTabela({
  planilha: PLANILHA_FOLHA,
  aba: 'Valores',
  esquema: z.object({
    posto_id: texto(),
    vigencia: data(),
    ...colunasComponentes,
    /** Reajuste do funcionário em %. */
    reajuste: numeroOpcional(),
    hora_atividade: booleano(),
  }),
  sigilo: { ...Object.fromEntries(COMPONENTES.map((c) => [c.chave, 'pessoal'])), reajuste: 'pessoal' },
});

/** Lotação: em quais Serviços (do Núcleo) o custo do posto se divide, em %. */
export const Rateios = definirTabela({
  planilha: PLANILHA_FOLHA,
  aba: 'Lotacoes',
  esquema: z.object({
    posto_id: texto(),
    /** Identifica as linhas gravadas juntas (uma lotação completa). */
    lote: texto(),
    servico: texto(),
    percentual: numero(),
    vigencia: data(),
  }),
});

export const Parametros = definirTabela({
  planilha: PLANILHA_FOLHA,
  aba: 'Parametros',
  esquema: z.object({
    chave: texto(),
    valor: numero(),
  }),
});

// ---------------------------------------------------------------------------
// Previsão (Entrega 1B) — planilha "orcamento"
// ---------------------------------------------------------------------------

const MESES_COLUNAS = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`m${i + 1}`, numeroOpcional()])) as Record<
  `m${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12}`,
  ReturnType<typeof numeroOpcional>
>;
const distribuicao = () => z.preprocess((v) => (vazio(v) ? 'igual' : v), z.enum(['igual', 'meses', 'manual']));

/** Grupos de gasto (ex.: Material de consumo). "rh" = soma em Recursos Humanos. */
export const GruposGasto = definirTabela({
  planilha: PLANILHA_ORCAMENTO,
  aba: 'GruposGasto',
  esquema: z.object({ nome: texto(), rh: booleano() }),
});

/** Fontes de recurso. Natureza e uso alimentam os indicadores. */
export const Fontes = definirTabela({
  planilha: PLANILHA_ORCAMENTO,
  aba: 'Fontes',
  esquema: z.object({
    nome: texto(),
    natureza: z.enum(['publica', 'propria']),
    uso: z.enum(['livre', 'restrita']),
  }),
});

export const Exercicios = definirTabela({
  planilha: PLANILHA_ORCAMENTO,
  aba: 'Exercicios',
  esquema: z.object({
    ano: numero(),
    situacao: z.enum(['elaboracao', 'aprovado', 'encerrado']),
    aprovado_em: dataOpcional(),
    aprovado_por: textoOpcional(),
  }),
});

/** Itens de despesa. Valor = quantidade × ocorrências × valor unitário; m1..m12 = distribuição nos meses. */
export const Despesas = definirTabela({
  planilha: PLANILHA_ORCAMENTO,
  aba: 'Despesas',
  esquema: z.object({
    ano: numero(),
    servico: texto(),
    grupo_id: texto(),
    /** Vazio = "a definir" (só durante a elaboração). */
    fonte_id: textoOpcional(),
    descricao: texto(),
    quantidade: numero(),
    ocorrencias: numero(),
    valor_unitario: numero(),
    distribuicao: distribuicao(),
    ...MESES_COLUNAS,
    /** Operacional ou Projetos/Capital (filtro da Análise por área). */
    categoria: z.preprocess((v) => (vazio(v) ? 'operacional' : v), z.enum(['operacional', 'projetos'])),
    /** Urgente e importante (ui), urgente e não importante (un), não urgente e importante (ni), não urgente e não importante (nn). */
    prioridade: z.preprocess((v) => (vazio(v) ? null : v), z.enum(['ui', 'un', 'ni', 'nn']).nullable()),
    cotacao: z.preprocess((v) => (vazio(v) ? null : v), z.enum(['ok', 'atualizar', 'pendente']).nullable()),
    /** Quem propôs (coordenação), quando o item veio de uma proposta. */
    proposto_por: textoOpcional(),
    /** Motivo da recusa (ou observação da decisão) do Financeiro. */
    motivo_decisao: textoOpcional(),
    /** aceito (entra no orçamento), proposta (aguarda o Financeiro) ou recusada. */
    situacao: z.preprocess((v) => (vazio(v) ? 'aceito' : v), z.enum(['aceito', 'proposta', 'recusada'])),
    observacao: textoOpcional(),
  }),
});

/** Itens de receita, com a situação da captação. */
export const Receitas = definirTabela({
  planilha: PLANILHA_ORCAMENTO,
  aba: 'Receitas',
  esquema: z.object({
    ano: numero(),
    fonte_id: texto(),
    descricao: texto(),
    valor: numero(),
    captacao: z.enum(['garantida', 'negociacao', 'a_captar']),
    /** Área (código do Núcleo) a que a receita se destina; vazio = geral. */
    area: textoOpcional(),
    distribuicao: distribuicao(),
    ...MESES_COLUNAS,
    observacao: textoOpcional(),
  }),
});

/** Qual fonte paga a folha de cada serviço, no ano. Vigente = a linha ativa mais recente. */
export const FontesFolha = definirTabela({
  planilha: PLANILHA_ORCAMENTO,
  aba: 'FontesFolha',
  esquema: z.object({ ano: numero(), servico: texto(), fonte_id: textoOpcional() }),
});

/**
 * Classificação de custo de cada Serviço (centro de custo), para a Análise por área:
 * direto (atende), indireto (apoio da área, rateado entre os diretos) ou despesa
 * (administrativo, rateado entre as áreas). Uma linha por serviço; sem linha = direto.
 */
export const CentrosCusto = definirTabela({
  planilha: PLANILHA_ORCAMENTO,
  aba: 'CentrosCusto',
  esquema: z.object({
    servico: texto(),
    tipo: z.enum(['direto', 'indireto', 'despesa']),
    atendidos: numeroOpcional(),
    sessoes: numeroOpcional(),
    area_m2: numeroOpcional(),
  }),
});

/**
 * Remanejamentos e suplementações de um exercício aprovado. O item original não
 * muda: o ajuste aprovado soma (ou tira) valor num mês do item.
 * - remanejamento: tira `valor` do mês da despesa de origem e põe na despesa de destino;
 * - suplementacao: soma `valor` (negativo = redução) no mês do item de destino (despesa ou receita).
 */
export const Ajustes = definirTabela({
  planilha: PLANILHA_ORCAMENTO,
  aba: 'Ajustes',
  esquema: z.object({
    ano: numero(),
    tipo: z.enum(['remanejamento', 'suplementacao']),
    origem_id: textoOpcional(),
    destino_tipo: z.enum(['despesa', 'receita']),
    destino_id: texto(),
    mes: numero(),
    valor: numero(),
    justificativa: texto(),
    situacao: z.enum(['pendente', 'aprovado', 'recusado']),
    solicitado_por: textoOpcional(),
    decidido_por: textoOpcional(),
    decidido_em: dataOpcional(),
    motivo_decisao: textoOpcional(),
  }),
});

export type RegAjuste = Registro<typeof Ajustes.esquema>;

export type RegGrupo = Registro<typeof GruposGasto.esquema>;
export type RegFonte = Registro<typeof Fontes.esquema>;
export type RegDespesa = Registro<typeof Despesas.esquema>;
export type RegReceita = Registro<typeof Receitas.esquema>;

export type RegPosto = Registro<typeof Postos.esquema>;
export type RegComponentes = Registro<typeof Componentes.esquema>;
export type RegRateio = Registro<typeof Rateios.esquema>;

export const TABELAS_ORCAMENTO = [Postos, Componentes, Rateios, Parametros, GruposGasto, Fontes, Exercicios, Despesas, Receitas, FontesFolha, CentrosCusto, Ajustes] as const;
