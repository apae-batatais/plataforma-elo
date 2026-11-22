/**
 * Abas do app Projetos (entrega P1), na planilha própria "projetos". Sem dados pessoais de atendidos;
 * as colunas de e-mail são de uso interno da instituição.
 *
 * - Projetos: a ficha da ideia/projeto, do rascunho até a decisão da porta 1.
 * - Portas: cada abertura de porta (uma nova a cada reenvio depois de "ajustar").
 * - Pareceres e Decisoes: o que cada parecerista e cada decisor registrou (nunca editados).
 * - ConfigProjetos: ajustes por instituição (chave e valor em texto).
 * - HistoricoProjetos: cada passo do projeto, só inclusões.
 */
import { z } from 'zod';
import { booleano, dataOpcional, definirTabela, numeroOpcional, texto, textoOpcional, type Registro } from '@/nucleo/armazenamento/tabela';
import { FONTES_NUMERO, MOTIVOS_SEM_NUMERO, ORIGENS_MEDICAO } from '../dominio/indicadores';
import { GRAUS, NIVEIS_MARCO, SITUACOES_RISCO } from '../dominio/fases';
import { SITUACOES_PEDIDO, SITUACOES_RELATORIO, TIPOS_MUDANCA } from '../dominio/acompanhamento';
import { SITUACOES_ATIVIDADE } from '../dominio/planejamento';
import { DECISOES, ETAPAS, NIVEIS_DECISAO, PORTES, RESULTADOS_PARECER, SITUACOES_PORTA, TIPOS_PARECER, TIPOS_PORTA, TIPOS_PROJETO } from '../dominio/projeto';

export const PLANILHA_PROJETOS = 'projetos';

export const Projetos = definirTabela({
  planilha: PLANILHA_PROJETOS,
  aba: 'Projetos',
  esquema: z.object({
    /** PRJ-0001. */
    codigo: texto(),
    titulo: texto(),
    resumo: texto(),
    tipo: z.enum(TIPOS_PROJETO),
    porte: z.enum(PORTES),
    etapa: z.enum(ETAPAS),
    proponente: texto(),
    responsavel: textoOpcional(),
    /** Código do serviço do Núcleo (opcional). */
    servico: textoOpcional(),
    valor_estimado: numeroOpcional(),
    inicio_previsto: dataOpcional(),
    fim_previsto: dataOpcional(),
    /** Total do Termo de Abertura aprovado na porta 2 (regra de borda 4). */
    valor_aprovado: numeroOpcional(),
    /** Termo de Parcerias criado como rascunho na porta 2 (regra L8): id e nome copiado. */
    termo_id: textoOpcional(),
    termo_nome: textoOpcional(),
  }),
});

export const Portas = definirTabela({
  planilha: PLANILHA_PROJETOS,
  aba: 'Portas',
  esquema: z.object({
    projeto_id: texto(),
    tipo: z.enum(TIPOS_PORTA),
    situacao: z.enum(SITUACOES_PORTA),
    /** Valor considerado na abertura (regra 8): mudar o limite depois não muda portas abertas. */
    valor_considerado: numeroOpcional(),
    exige_alcada: booleano(),
    /** Tipos de parecer exigidos na abertura, separados por vírgula (pode ficar vazio). */
    pareceres_exigidos: textoOpcional(),
    aberta_em: texto(),
    aberta_por: texto(),
    /** Resultado final (decisão que encerrou a porta). */
    resultado: z.preprocess((v) => (v === '' || v == null ? null : v), z.enum(DECISOES).nullable()),
  }),
});

export const Pareceres = definirTabela({
  planilha: PLANILHA_PROJETOS,
  aba: 'Pareceres',
  esquema: z.object({
    porta_id: texto(),
    projeto_id: texto(),
    tipo: z.enum(TIPOS_PARECER),
    parecerista: texto(),
    resultado: z.enum(RESULTADOS_PARECER),
    texto: textoOpcional(),
    em: texto(),
  }),
});

export const Decisoes = definirTabela({
  planilha: PLANILHA_PROJETOS,
  aba: 'Decisoes',
  esquema: z.object({
    porta_id: texto(),
    projeto_id: texto(),
    nivel: z.enum(NIVEIS_DECISAO),
    decisor: texto(),
    decisao: z.enum(DECISOES),
    justificativa: texto(),
    em: texto(),
  }),
});

export const ConfigProjetos = definirTabela({
  planilha: PLANILHA_PROJETOS,
  aba: 'ConfigProjetos',
  esquema: z.object({ chave: texto(), valor: textoOpcional() }),
});

export const HistoricoProjetos = definirTabela({
  planilha: PLANILHA_PROJETOS,
  aba: 'HistoricoProjetos',
  modo: 'somente_inclusao',
  esquema: z.object({
    projeto_id: texto(),
    em: texto(),
    usuario: texto(),
    acao: texto(),
    /** Texto livre, nunca o conteúdo de um parecer. */
    comentario: textoOpcional(),
  }),
});

export const ProjetoDocumentos = definirTabela({
  planilha: PLANILHA_PROJETOS,
  aba: 'ProjetoDocumentos',
  esquema: z.object({
    projeto_id: texto(),
    /** Um dos TIPOS_DOCUMENTO (dominio/fases.ts). */
    tipo: texto(),
    /** Número da versão do documento (1, 2…); não é a versão da linha. */
    numero: z.coerce.number().int().min(1),
    /** Conteúdo estruturado (JSON validado em dominio/fases.ts). */
    conteudo: texto(),
    situacao: z.enum(['rascunho', 'aprovado', 'substituido']),
    /** Marca "pronto" do próprio documento (não é aprovação). */
    pronto: booleano(),
  }),
});

export const MarcoLogico = definirTabela({
  planilha: PLANILHA_PROJETOS,
  aba: 'MarcoLogico',
  esquema: z.object({
    projeto_id: texto(),
    nivel: z.enum(NIVEIS_MARCO),
    ordem: z.coerce.number().int().min(1),
    descricao: texto(),
    indicador: textoOpcional(),
    fonte_verificacao: textoOpcional(),
    pressuposto: textoOpcional(),
    /** Id do item do nível imediatamente acima. */
    acima: textoOpcional(),
    /** De onde vem o número do indicador (L1 da onda 2); vazio vale `manual`. */
    fonte_numero: z.preprocess((v) => (v === '' || v == null ? 'manual' : v), z.enum(FONTES_NUMERO)),
    /** Código do serviço do Núcleo e cópia do nome; obrigatório com fonte automática. */
    servico_id: textoOpcional(),
    servico_nome: textoOpcional(),
    meta: numeroOpcional(),
  }),
});

/** Fotografia de um indicador automático (regra L12). Linha nunca editada: nova medição é outra linha. */
export const IndicadoresMedidos = definirTabela({
  planilha: PLANILHA_PROJETOS,
  aba: 'IndicadoresMedidos',
  esquema: z.object({
    projeto_id: texto(),
    item_id: texto(),
    data: texto(),
    valor: numeroOpcional(),
    /** Quantas pessoas entraram na conta. */
    base: z.preprocess((v) => (v === '' || v == null ? 0 : Number(v)), z.number().int().min(0)),
    motivo: z.preprocess((v) => (v === '' || v == null ? null : v), z.enum(MOTIVOS_SEM_NUMERO).nullable()),
    origem: z.enum(ORIGENS_MEDICAO),
    registrado_por: texto(),
  }),
});

export const Riscos = definirTabela({
  planilha: PLANILHA_PROJETOS,
  aba: 'Riscos',
  esquema: z.object({
    projeto_id: texto(),
    descricao: texto(),
    probabilidade: z.enum(GRAUS),
    impacto: z.enum(GRAUS),
    resposta: textoOpcional(),
    dono: textoOpcional(),
    situacao: z.enum(SITUACOES_RISCO),
  }),
});

export const ProjetoEquipe = definirTabela({
  planilha: PLANILHA_PROJETOS,
  aba: 'ProjetoEquipe',
  esquema: z.object({
    projeto_id: texto(),
    email: texto(),
    funcao: texto(),
    inicio: texto(),
    /** Preenchido quando a pessoa sai da equipe (nada é apagado). */
    fim: dataOpcional(),
  }),
});

export const Atividades = definirTabela({
  planilha: PLANILHA_PROJETOS,
  aba: 'Atividades',
  esquema: z.object({
    projeto_id: texto(),
    descricao: texto(),
    /** E-mail da pessoa responsável (uso interno). */
    responsavel: texto(),
    inicio_previsto: texto(),
    fim_previsto: texto(),
    inicio_real: dataOpcional(),
    fim_real: dataOpcional(),
    /** `atrasada` não é gravada: é calculada pela data (regra 20). */
    situacao: z.enum(SITUACOES_ATIVIDADE),
    /** Peso opcional no andamento do projeto. */
    peso: numeroOpcional(),
  }),
});

export const ProjetoOrcamento = definirTabela({
  planilha: PLANILHA_PROJETOS,
  aba: 'ProjetoOrcamento',
  esquema: z.object({
    projeto_id: texto(),
    categoria: texto(),
    descricao: texto(),
    valor_planejado: z.coerce.number().min(0),
    fonte: textoOpcional(),
    /** Número da versão do Termo de Abertura aprovado quando a linha foi gravada (vazio antes da aprovação). */
    versao_termo: numeroOpcional(),
  }),
});

export const Problemas = definirTabela({
  planilha: PLANILHA_PROJETOS,
  aba: 'Problemas',
  esquema: z.object({
    projeto_id: texto(),
    descricao: texto(),
    gravidade: z.enum(GRAUS),
    dono: textoOpcional(),
    aberto_em: texto(),
    aberto_por: texto(),
    /** Problema aberto = sem solução e sem data (regra 21). */
    solucao: textoOpcional(),
    resolvido_em: dataOpcional(),
  }),
});

/** Pedido de mudança (regras 16 a 19). Nunca editado além da decisão; nada é apagado. */
export const PedidosMudanca = definirTabela({
  planilha: PLANILHA_PROJETOS,
  aba: 'PedidosMudanca',
  esquema: z.object({
    projeto_id: texto(),
    tipo: z.enum(TIPOS_MUDANCA),
    /** Custo: id da linha do orçamento. Prazo: "projeto" ou id da atividade. Escopo: vazio. */
    alvo: textoOpcional(),
    /** Valor, data ou texto do escopo antes e depois (em texto). */
    atual: texto(),
    proposto: texto(),
    /** % de custo da linha ou dias de prazo; vazio no escopo. */
    variacao: numeroOpcional(),
    limite: numeroOpcional(),
    variacao_total: numeroOpcional(),
    limite_total: numeroOpcional(),
    dentro_tolerancia: booleano(),
    /** O novo valor total passa do limite de alçada: depois da Diretoria, decide a Presidência ou o Conselho. */
    exige_alcada: booleano(),
    justificativa: texto(),
    pedido_por: texto(),
    pedido_em: texto(),
    situacao: z.enum(SITUACOES_PEDIDO),
    /** Diretoria que passou o pedido para a alçada (quando houve). */
    diretoria_por: textoOpcional(),
    decidido_por: textoOpcional(),
    decidido_em: textoOpcional(),
    decisao_justificativa: textoOpcional(),
    /** Versão do Termo aprovada quando o pedido foi feito e versão nova gerada pela aprovação. */
    versao_termo_base: z.coerce.number().int().min(1),
    versao_termo_nova: numeroOpcional(),
  }),
});

export const Relatorios = definirTabela({
  planilha: PLANILHA_PROJETOS,
  aba: 'Relatorios',
  esquema: z.object({
    projeto_id: texto(),
    periodo_inicio: texto(),
    periodo_fim: texto(),
    planejado_pct: z.coerce.number().min(0).max(100),
    realizado_pct: z.coerce.number().min(0).max(100),
    orcamento_total: numeroOpcional(),
    gasto_realizado: numeroOpcional(),
    atividades_atrasadas: z.coerce.number().int().min(0),
    problemas_abertos: z.coerce.number().int().min(0),
    fora_tolerancia: booleano(),
    situacao_calculada: z.enum(SITUACOES_RELATORIO),
    situacao: z.enum(SITUACOES_RELATORIO),
    /** Obrigatória quando a pessoa piorou a situação. */
    justificativa: textoOpcional(),
    texto: texto(),
    enviado_por: texto(),
    enviado_em: texto(),
  }),
});

export const TABELAS_PROJETOS = [Projetos, ProjetoDocumentos, MarcoLogico, IndicadoresMedidos, Riscos, ProjetoEquipe, Atividades, ProjetoOrcamento, Problemas, PedidosMudanca, Relatorios, Portas, Pareceres, Decisoes, ConfigProjetos, HistoricoProjetos] as const;

export type RegProjeto = Registro<typeof Projetos.esquema>;
export type RegDocumento = Registro<typeof ProjetoDocumentos.esquema>;
export type RegMarco = Registro<typeof MarcoLogico.esquema>;
export type RegMedicao = Registro<typeof IndicadoresMedidos.esquema>;
export type RegRisco = Registro<typeof Riscos.esquema>;
export type RegEquipe = Registro<typeof ProjetoEquipe.esquema>;
export type RegAtividade = Registro<typeof Atividades.esquema>;
export type RegLinhaOrcamento = Registro<typeof ProjetoOrcamento.esquema>;
export type RegProblema = Registro<typeof Problemas.esquema>;
export type RegPedido = Registro<typeof PedidosMudanca.esquema>;
export type RegRelatorio = Registro<typeof Relatorios.esquema>;
export type RegPorta = Registro<typeof Portas.esquema>;
export type RegParecer = Registro<typeof Pareceres.esquema>;
export type RegDecisao = Registro<typeof Decisoes.esquema>;
export type RegConfig = Registro<typeof ConfigProjetos.esquema>;
export type RegHistorico = z.infer<typeof HistoricoProjetos.esquema>;
