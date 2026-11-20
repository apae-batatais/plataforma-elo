/**
 * Abas do módulo Orçamento.
 *
 * - Planilha "orcamento_folha": a folha. Salários são dados pessoais, então
 *   ficam numa planilha à parte, que pode ter compartilhamento mais restrito.
 * - Os "centros de custo" são os Serviços do Núcleo (Administração › Serviços).
 * - Planilha "orcamento": a previsão (Entrega 1B). Não tem dados pessoais.
 * - Planilha "orcamento_execucao": a tesouraria (Entrega 1D.1: contas, saldos e ajustes
 *   de conciliação) e, depois, os lançamentos da 1C. Não tem dados pessoais.
 *
 * Abas com vigência (Componentes e Lotacoes) só recebem
 * inclusões: mudar um valor grava uma linha nova, e a mais recente vale a
 * partir da sua vigência. Assim o histórico mês a mês é preservado.
 */
import { z } from 'zod';
import { booleano, dataOpcional, definirTabela, numeroOpcional, texto, textoOpcional, type Registro } from '@/nucleo/armazenamento/tabela';
import { COMPONENTES } from '../dominio/folha';
import { CLASSES, TIPOS_CONTA } from '../dominio/tesouraria';

const vazio = (v: unknown) => v === undefined || v === null || v === '';
const numero = () => z.preprocess((v) => (vazio(v) ? undefined : typeof v === 'number' ? v : Number(String(v).replace(',', '.'))), z.number());
const data = () => z.preprocess((v) => (vazio(v) ? undefined : String(v).trim()), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data no formato AAAA-MM-DD'));

export const PLANILHA_ORCAMENTO = 'orcamento';
export const PLANILHA_FOLHA = 'orcamento_folha';
export const PLANILHA_EXECUCAO = 'orcamento_execucao';

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
    /** 'indeterminado' ou 'determinado' (vazio = indeterminado). */
    contrato: z.preprocess((v) => (vazio(v) ? null : v), z.enum(['indeterminado', 'determinado']).nullable()),
    /** Mês de férias (1 a 12) que vale no lugar do calendário da instituição. */
    mes_ferias: z.preprocess((v) => (vazio(v) ? null : Number(v)), z.number().int().min(1).max(12).nullable()),
  }),
  sigilo: { colaborador: 'pessoal', mes_ferias: 'pessoal' },
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

/** Calendário de pagamentos da instituição (P1): 12 linhas por vigência, sem dado pessoal. */
export const CalendarioPagamento = definirTabela({
  planilha: PLANILHA_FOLHA,
  aba: 'CalendarioPagamento',
  esquema: z.object({
    vigencia: data(),
    mes: numero(),
    ferias_coletivas: booleano(),
    decimo_pct: numero(),
    abono_pct: numero(),
  }),
});

/** Períodos de férias já gozados (P2): base do cálculo das férias vencidas no passivo. */
export const FeriasTiradas = definirTabela({
  planilha: PLANILHA_FOLHA,
  aba: 'FeriasTiradas',
  esquema: z.object({
    posto_id: texto(),
    inicio: data(),
    dias: numero(),
    observacao: textoOpcional(),
  }),
  sigilo: { inicio: 'pessoal', dias: 'pessoal' },
});

/** Extrato do FGTS (P2): só inclusões; vale a linha mais recente. */
export const SaldoFGTS = definirTabela({
  planilha: PLANILHA_FOLHA,
  aba: 'SaldoFGTS',
  esquema: z.object({
    posto_id: texto(),
    referencia: data(),
    valor: numero(),
    observacao: textoOpcional(),
  }),
  sigilo: { valor: 'pessoal' },
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
  esquema: z.object({ nome: texto(), rh: booleano(), regra_rateio_id: textoOpcional(), codigo_conta: textoOpcional() }),
});

/** Fontes de recurso. Natureza e uso alimentam os indicadores. */
export const Fontes = definirTabela({
  planilha: PLANILHA_ORCAMENTO,
  aba: 'Fontes',
  esquema: z.object({
    nome: texto(),
    natureza: z.enum(['publica', 'propria']),
    uso: z.enum(['livre', 'restrita']),
    codigo_conta: textoOpcional(),
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
    /** Regra de rateio própria do item (vence a do grupo). */
    regra_rateio_id: textoOpcional(),
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
    /** Quem do Setor de Compras informou o valor (cotação) da proposta. */
    cotado_por: textoOpcional(),
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

/**
 * Despesas e receitas que vieram de uma importação de planilha. Uma nova
 * importação do mesmo ano e tipo cancela os itens da anterior (que ficam no
 * histórico) e grava os do arquivo; o que foi lançado à mão não é tocado.
 */
export const ItensImportados = definirTabela({
  planilha: PLANILHA_ORCAMENTO,
  aba: 'ItensImportados',
  esquema: z.object({
    ano: numero(),
    tipo: z.enum(['despesa', 'receita']),
    item_id: texto(),
    /** Identifica a importação (todos os itens gravados juntos). */
    lote: texto(),
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
    vagas: numeroOpcional(),
    /** Regra de rateio do serviço (apoio e administrativo). */
    regra_rateio_id: textoOpcional(),
    /** Origem do serviço (painel de sustentabilidade, #131). Vazio = vale a sugestão do termo. Só em serviço direto. */
    origem: z.preprocess((v) => (v === undefined || v === null || v === '' ? null : v), z.enum(['contratado', 'propria_apoio', 'propria']).nullable()),
  }),
});

/**
 * Limites de alerta do painel de sustentabilidade (#131). Uma linha ativa por indicador (e serviço, só no peso do aporte).
 * Limpar o limite encerra a linha (`ativo = FALSE`); nada é apagado.
 */
export const LimitesSustentabilidade = definirTabela({
  planilha: PLANILHA_ORCAMENTO,
  aba: 'LimitesSustentabilidade',
  esquema: z.object({
    indicador: z.enum(['peso_aporte', 'meses_reserva', 'concentracao_financiador', 'margem_operacional']),
    servico: textoOpcional(),
    valor: numero(),
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

// ---------------------------------------------------------------------------
// Tesouraria (Entrega 1D.1) — planilha "orcamento_execucao"
// ---------------------------------------------------------------------------

const mesAAAAMM = () => z.preprocess((v) => (vazio(v) ? undefined : String(v).trim()), z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'mês no formato AAAA-MM'));

/** Contas da instituição (banco, aplicação ou caixa). Excluir encerra (ativo = FALSE); nada é apagado. */
export const Contas = definirTabela({
  planilha: PLANILHA_EXECUCAO,
  aba: 'Contas',
  esquema: z.object({
    banco: texto(),
    agencia: textoOpcional(),
    conta: textoOpcional(),
    tipo: z.enum(TIPOS_CONTA),
    classe: z.enum(CLASSES),
    /** Fonte (termo) de onde vem o recurso; só nas contas vinculadas. */
    fonte_id: textoOpcional(),
    unidade: textoOpcional(),
  }),
});

/** Saldo de uma conta no fim de um mês. Quem informou e quando: atualizado_por e atualizado_em. */
export const Saldos = definirTabela({
  planilha: PLANILHA_EXECUCAO,
  aba: 'Saldos',
  esquema: z.object({ conta_id: texto(), mes: mesAAAAMM(), saldo: numero() }),
});

/** Ajuste de conciliação de uma conta num mês (valor com sinal, sempre com motivo). */
export const AjustesConciliacao = definirTabela({
  planilha: PLANILHA_EXECUCAO,
  aba: 'AjustesConciliacao',
  esquema: z.object({ conta_id: texto(), mes: mesAAAAMM(), valor: numero(), motivo: texto() }),
});

/**
 * Histórico de troca de classe de uma conta (só inclusões). `classe_anterior` e
 * `fonte_id_anterior` valem até o mês anterior a `a_partir_de`, o primeiro mês da classe nova.
 */
export const MudancasClasse = definirTabela({
  planilha: PLANILHA_EXECUCAO,
  aba: 'MudancasClasse',
  esquema: z.object({ conta_id: texto(), classe_anterior: z.enum(CLASSES), fonte_id_anterior: textoOpcional(), a_partir_de: mesAAAAMM() }),
});


/**
 * Política da reserva (1D.2): vigência, meses de folha e as faixas dos seis sinais. Só inclusões;
 * a decisão (aprovar ou recusar) atualiza `situacao` e `motivo` da própria linha, auditada.
 */
export const PoliticaReserva = definirTabela({
  planilha: PLANILHA_EXECUCAO,
  aba: 'PoliticaReserva',
  esquema: z.object({
    vigencia: mesAAAAMM(),
    meses_minimo: numero(),
    situacao: z.enum(['proposta', 'aprovada', 'recusada']),
    motivo: textoOpcional(),
    livre_ok: numero(),
    livre_atencao: numero(),
    fim_ok: numero(),
    exec_atencao: numero(),
    folha_ok: numero(),
    folha_atencao: numero(),
    gasto_ok: numero(),
    gasto_atencao: numero(),
    reserva_ok: numero(),
    reserva_atencao: numero(),
  }),
});
export type RegPoliticaReserva = Registro<typeof PoliticaReserva.esquema>;

/** Pedido de uso da reserva (1D.2). Não move saldo: o saldo vem do extrato digitado. Cancelar encerra (ativo = FALSE). */
export const UsosReserva = definirTabela({
  planilha: PLANILHA_EXECUCAO,
  aba: 'UsosReserva',
  esquema: z.object({
    mes_pedido: mesAAAAMM(),
    valor: numero(),
    motivo: texto(),
    prazo_recomposicao: mesAAAAMM(),
    situacao: z.enum(['pedido', 'aprovado', 'recusado', 'recomposto']),
    motivo_decisao: textoOpcional(),
    mes_recomposicao: z.preprocess((v) => (vazio(v) ? null : String(v).trim()), z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).nullable()),
  }),
});
export type RegUsoReserva = Registro<typeof UsosReserva.esquema>;

/**
 * Realizado (1C.1): totais mensais informados à mão, uma linha por mês, tipo, serviço, grupo, fonte e natureza.
 * Receita não tem serviço nem grupo. Sem coluna pessoal (não há fornecedor). "Remover linha" encerra (ativo = FALSE).
 */
export const Realizado = definirTabela({
  planilha: PLANILHA_EXECUCAO,
  aba: 'Realizado',
  esquema: z.object({
    ano: numero(),
    mes: mesAAAAMM(),
    tipo: z.enum(['despesa', 'receita']),
    servico: textoOpcional(),
    grupo_id: textoOpcional(),
    fonte_id: texto(),
    natureza: z.enum(['rh', 'encargos', 'custeio', 'investimento', 'tarifas', 'adiantamento_termo', 'receita_comum', 'ressarcimento']),
    valor: numero(),
    nao_recorrente: booleano(),
    motivo_nao_recorrente: textoOpcional(),
    observacao: textoOpcional(),
  }),
});
export type RegRealizado = Registro<typeof Realizado.esquema>;

/**
 * Histórico (1E): receita realizada de um ano fechado, uma linha por linha da planilha de origem,
 * associada a uma fonte. Reimportar o ano cancela as linhas anteriores (ativo = FALSE).
 */
export const Historico = definirTabela({
  planilha: PLANILHA_EXECUCAO,
  aba: 'Historico',
  esquema: z.object({
    ano: numero(),
    fonte_id: texto(),
    descricao: texto(),
    receita: numero(),
    linha_origem: numero(),
    observacao: textoOpcional(),
    lote: texto(),
  }),
});

/** Totais de um ano fechado: despesa, folha e saldo livre em 1º de janeiro (do mesmo lote do Historico). */
export const HistoricoAnos = definirTabela({
  planilha: PLANILHA_EXECUCAO,
  aba: 'HistoricoAnos',
  esquema: z.object({
    ano: numero(),
    despesa_total: numero(),
    folha: numero(),
    saldo_livre_inicial: numeroOpcional(),
    receita_total_planilha: numero(),
    lote: texto(),
  }),
});


// ---------------------------------------------------------------------------
// Regras de rateio dos custos comuns (R1, proposta #91) — planilha "orcamento"
// ---------------------------------------------------------------------------

const baseRegra = () => z.string().regex(/^(igual|m2|profissionais|atendidos|vagas|custo|propria:.+)$/, 'base de rateio inválida');

/** Regra de rateio: base do nível 1 e, opcionalmente, do nível 2 (dentro de cada área). */
export const RegrasRateio = definirTabela({
  planilha: PLANILHA_ORCAMENTO,
  aba: 'RegrasRateio',
  esquema: z.object({
    nome: texto(),
    tipo: z.enum(['area', 'servico']),
    base1: baseRegra(),
    base2: z.preprocess((v) => (vazio(v) ? null : v), baseRegra().nullable()),
  }),
});

/** Quem participa de uma regra: uma área ou um serviço (código do Núcleo). */
export const RegrasRateioParticipantes = definirTabela({
  planilha: PLANILHA_ORCAMENTO,
  aba: 'RegrasRateioParticipantes',
  esquema: z.object({ regra_id: texto(), participante: texto() }),
});

/** Bases próprias da OSC (ex.: nº de refeições). */
export const BasesRateio = definirTabela({
  planilha: PLANILHA_ORCAMENTO,
  aba: 'BasesRateio',
  esquema: z.object({ nome: texto() }),
});

/** Valor de uma base própria em cada serviço, por exercício. */
export const BasesRateioValores = definirTabela({
  planilha: PLANILHA_ORCAMENTO,
  aba: 'BasesRateioValores',
  esquema: z.object({ base_id: texto(), servico: texto(), ano: numero(), valor: numero() }),
});

/**
 * Ligação de cada fonte de um termo (lida de Parcerias) com a Fonte do cadastro (natureza e uso) e com a
 * conta vinculada da Tesouraria (R3a, #140). Uma linha ativa por fonte do termo; trocar a ligação altera a linha.
 */
export const FontesTermo = definirTabela({
  planilha: PLANILHA_ORCAMENTO,
  aba: 'FontesTermo',
  esquema: z.object({ fonte_termo_id: texto(), fonte_id: texto(), conta_id: textoOpcional() }),
});

/**
 * De onde vem cada categoria do plano de aplicação de uma fonte de termo (R3a): uma linha por origem, que é
 * "grupo:<id do Grupo de gasto>" ou "folha" (Folha de pessoal). Tirar uma origem encerra a linha (ativo = FALSE).
 */
export const CategoriasPlanoOrigens = definirTabela({
  planilha: PLANILHA_ORCAMENTO,
  aba: 'CategoriasPlanoOrigens',
  esquema: z.object({ fonte_termo_id: texto(), categoria: texto(), origem: texto() }),
});

export type RegFonteTermo = Registro<typeof FontesTermo.esquema>;
export type RegRegraRateio = Registro<typeof RegrasRateio.esquema>;
export type RegBaseRateio = Registro<typeof BasesRateio.esquema>;

export type RegHistorico = Registro<typeof Historico.esquema>;
export type RegHistoricoAno = Registro<typeof HistoricoAnos.esquema>;

export type RegConta = Registro<typeof Contas.esquema>;
export type RegMudancaClasse = Registro<typeof MudancasClasse.esquema>;
export type RegSaldo = Registro<typeof Saldos.esquema>;
export type RegAjusteConciliacao = Registro<typeof AjustesConciliacao.esquema>;

export type RegAjuste = Registro<typeof Ajustes.esquema>;

export type RegGrupo = Registro<typeof GruposGasto.esquema>;
export type RegFonte = Registro<typeof Fontes.esquema>;
export type RegDespesa = Registro<typeof Despesas.esquema>;
export type RegReceita = Registro<typeof Receitas.esquema>;

export type RegPosto = Registro<typeof Postos.esquema>;
export type RegComponentes = Registro<typeof Componentes.esquema>;
export type RegRateio = Registro<typeof Rateios.esquema>;

// ---------------------------------------------------------------------------
// Profissionais cedidos (C1 da #125)
// ---------------------------------------------------------------------------

/** Quem cede profissionais. Não é dado pessoal. `termo_id` e `termo_numero` ficam para a ligação com Parcerias (C2). */
export const Cedentes = definirTabela({
  planilha: PLANILHA_ORCAMENTO,
  aba: 'Cedentes',
  esquema: z.object({
    nome: texto(),
    tipo: z.enum(['poder_publico', 'empresa_aprendiz', 'empresa_pcd', 'outro']),
    termo_id: textoOpcional(),
    termo_numero: textoOpcional(),
    observacao: textoOpcional(),
  }),
});

/** Profissional cedido: pessoa da equipe paga por quem cede. Mesmo sigilo dos funcionários da folha. */
export const Cedidos = definirTabela({
  planilha: PLANILHA_FOLHA,
  aba: 'Cedidos',
  esquema: z.object({
    colaborador: textoOpcional(),
    funcao: texto(),
    carga_horaria: numeroOpcional(),
    cedente_id: texto(),
    inicio: data(),
    fim_previsto: dataOpcional(),
    /** Data em que a cessão realmente acabou. */
    encerramento: dataOpcional(),
    observacao: textoOpcional(),
  }),
  sigilo: { colaborador: 'pessoal' },
});

/** Valor mensal por vigência (só inclusões). */
export const ValoresCedidos = definirTabela({
  planilha: PLANILHA_FOLHA,
  aba: 'ValoresCedidos',
  esquema: z.object({
    cedido_id: texto(),
    vigencia: data(),
    valor_mensal: numero(),
    tipo_valor: z.enum(['informado', 'equivalente']),
    observacao: textoOpcional(),
  }),
  sigilo: { valor_mensal: 'pessoal' },
});

/** Lotação por serviço, com vigência (igual a `Lotacoes`). */
export const LotacaoCedidos = definirTabela({
  planilha: PLANILHA_FOLHA,
  aba: 'LotacaoCedidos',
  esquema: z.object({
    cedido_id: texto(),
    lote: texto(),
    servico: texto(),
    percentual: numero(),
    vigencia: data(),
  }),
});

export type RegCedente = Registro<typeof Cedentes.esquema>;
export type RegCedido = Registro<typeof Cedidos.esquema>;
export type RegValorCedido = Registro<typeof ValoresCedidos.esquema>;
export type RegLotacaoCedido = Registro<typeof LotacaoCedidos.esquema>;

export const TABELAS_ORCAMENTO = [Postos, Componentes, Rateios, CalendarioPagamento, FeriasTiradas, SaldoFGTS, Parametros, GruposGasto, Fontes, Exercicios, Despesas, Receitas, FontesFolha, CentrosCusto, Ajustes, ItensImportados, Contas, Saldos, AjustesConciliacao, MudancasClasse, Historico, HistoricoAnos, RegrasRateio, RegrasRateioParticipantes, BasesRateio, BasesRateioValores, FontesTermo, CategoriasPlanoOrigens, Realizado, Cedentes, Cedidos, ValoresCedidos, LotacaoCedidos, LimitesSustentabilidade, PoliticaReserva, UsosReserva] as const;
