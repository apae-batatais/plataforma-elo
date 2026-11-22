/**
 * Abas do módulo Requisições, na planilha própria "requisicoes".
 *
 * - TiposRequisicao: o cadastro de tipos (Higiene e limpeza, Pedagógico…), com o
 *   perfil do setor que atende e os prazos de SLA em horas úteis.
 * - Requisicoes: a ficha. Campos próprios de cada formulário (entrega, evento,
 *   utensílios…) ficam em "detalhes" (JSON), conferidos pelo domínio.
 * - RequisicaoCentros: os centros de custo (serviços) com o percentual, somando 100%.
 * - RequisicaoItens: os itens pedidos (materiais) e quanto foi atendido.
 * - RequisicaoHistorico: cada mudança de etapa (só inclusões).
 * - ParametrosRequisicoes: expediente usado no cálculo do SLA.
 * - FeriadosRequisicoes: aba antiga de feriados; só leitura, para copiar ao Núcleo (a lista vive no Núcleo).
 * - RequisicaoAnexos: fotos e vídeo da requisição (referência ao arquivo na pasta de anexos).
 * - ResumosEnviados: um dia por linha, para o resumo diário por e-mail nunca sair duas vezes (entrega 7).
 */
import { z } from 'zod';
import { definirTabela, numeroOpcional, texto, textoOpcional, type Registro } from '@/nucleo/armazenamento/tabela';
import { CATEGORIAS, FORMULARIOS, SITUACOES } from '../dominio/requisicao';

const vazio = (v: unknown) => v === undefined || v === null || v === '';
const numero = () => z.preprocess((v) => (vazio(v) ? undefined : typeof v === 'number' ? v : Number(String(v).replace(',', '.'))), z.number());

export const PLANILHA_REQUISICOES = 'requisicoes';

export const TiposRequisicao = definirTabela({
  planilha: PLANILHA_REQUISICOES,
  aba: 'Tipos',
  esquema: z.object({
    nome: texto(),
    categoria: z.enum(CATEGORIAS),
    /** Qual ficha usar (materiais, TI, mobiliário, manutenção). */
    formulario: z.enum(FORMULARIOS),
    /** Código do perfil do setor que recebe e atende (ex.: almoxarifado). */
    perfil_responsavel: texto(),
    /** Prazos do SLA, em horas úteis. */
    prazo_aprovacao: numero(),
    prazo_atendimento: numero(),
    descricao: textoOpcional(),
    /** Áreas (códigos) que podem usar o tipo, separadas por vírgula. Vazio = todas. Grupos: não usado desde 04/11/2026. */
    areas: textoOpcional(),
    grupos: textoOpcional(),
    /** Aceita foto e vídeo: "sim", "nao" ou vazio (vazio = as fichas de serviço aceitam). */
    anexos: textoOpcional(),
  }),
});

/** Itens que cada tipo aceita (a lista que quem pede escolhe). Tipo sem itens aceita texto livre. */
export const CatalogoItens = definirTabela({
  planilha: PLANILHA_REQUISICOES,
  aba: 'CatalogoItens',
  esquema: z.object({ tipo_id: texto(), descricao: texto(), unidade: texto() }),
});

export const Requisicoes = definirTabela({
  planilha: PLANILHA_REQUISICOES,
  aba: 'Requisicoes',
  esquema: z.object({
    /** REQ-AAAA-NNNN. */
    numero: texto(),
    tipo_id: texto(),
    requisitante: texto(),
    requisitante_nome: texto(),
    /** Área (código do Núcleo). Grupo de despesa: só nos pedidos feitos até 04/11/2026 (saiu da ficha). */
    area: texto(),
    grupo_id: textoOpcional(),
    grupo_nome: textoOpcional(),
    situacao: z.enum(SITUACOES),
    /** Quem aprova: a coordenação dos centros de custo ou a Diretoria. */
    aprovacao: z.enum(['coordenacao', 'diretoria']),
    detalhes: textoOpcional(),
    observacao: textoOpcional(),
    /** Datas e horas (ISO) de cada etapa, para o histórico e o SLA. */
    enviada_em: texto(),
    decidida_em: textoOpcional(),
    decidida_por: textoOpcional(),
    recebida_em: textoOpcional(),
    recebida_por: textoOpcional(),
    concluida_em: textoOpcional(),
    executada_por: textoOpcional(),
    /** Ligação com projeto (L2): id e código/título copiados, para a lista não depender de ler Projetos. */
    projeto_id: textoOpcional(),
    projeto_codigo: textoOpcional(),
    projeto_titulo: textoOpcional(),
    atividade_id: textoOpcional(),
    atividade_descricao: textoOpcional(),
    /** Informado por quem aprova, só para conferir o saldo (nunca por quem pede). */
    valor_estimado: numeroOpcional(),
    /** Informado por quem atendeu ao concluir; não soma com o realizado do Orçamento. */
    valor_gasto: numeroOpcional(),
  }),
  sigilo: { requisitante: 'pessoal', requisitante_nome: 'pessoal' },
});

export const RequisicaoCentros = definirTabela({
  planilha: PLANILHA_REQUISICOES,
  aba: 'Centros',
  esquema: z.object({ requisicao_id: texto(), servico: texto(), percentual: numero() }),
});

export const RequisicaoItens = definirTabela({
  planilha: PLANILHA_REQUISICOES,
  aba: 'Itens',
  esquema: z.object({
    requisicao_id: texto(),
    ordem: numero(),
    quantidade: numero(),
    unidade: texto(),
    descricao: texto(),
    /** Item da lista do tipo (vazio quando o tipo aceita texto livre). */
    catalogo_id: textoOpcional(),
    /** Quanto foi entregue (preenchido ao concluir). */
    atendido: numeroOpcional(),
  }),
});

export const RequisicaoHistorico = definirTabela({
  planilha: PLANILHA_REQUISICOES,
  aba: 'Historico',
  modo: 'somente_inclusao',
  esquema: z.object({
    requisicao_id: texto(),
    em: texto(),
    usuario: texto(),
    acao: texto(),
    de: textoOpcional(),
    para: texto(),
    comentario: textoOpcional(),
  }),
  sigilo: { usuario: 'pessoal' },
});

export const ParametrosRequisicoes = definirTabela({
  planilha: PLANILHA_REQUISICOES,
  aba: 'Parametros',
  esquema: z.object({ chave: texto(), valor: numero() }),
});

/** Fotos e vídeo de cada requisição: o arquivo fica na pasta de anexos (Drive); aqui, só a referência. */
export const RequisicaoAnexos = definirTabela({
  planilha: PLANILHA_REQUISICOES,
  aba: 'Anexos',
  esquema: z.object({
    requisicao_id: texto(),
    tipo: z.enum(['foto', 'video']),
    arquivo_id: texto(),
    nome: texto(),
    mime: texto(),
    tamanho: numero(),
    duracao: numeroOpcional(),
  }),
  // A foto ou o vídeo pode mostrar pessoas: leitura só pelo Elo, com auditoria.
  sigilo: { arquivo_id: 'sensivel', nome: 'pessoal' },
});

/** Espaços que a instituição deixa reservar (cadastrados pela Administração da plataforma). */
export const Espacos = definirTabela({
  planilha: PLANILHA_REQUISICOES,
  aba: 'Espacos',
  esquema: z.object({ nome: texto(), local: textoOpcional(), capacidade: numero() }),
});

/** Períodos em que um espaço não pode ser reservado (reforma, obra…). Um espaço pode ter vários. */
export const EspacoIndisponibilidades = definirTabela({
  planilha: PLANILHA_REQUISICOES,
  aba: 'EspacoIndisponibilidades',
  esquema: z.object({
    espaco_id: texto(),
    inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    motivo: texto(),
  }),
});

export const FeriadosRequisicoes = definirTabela({
  planilha: PLANILHA_REQUISICOES,
  aba: 'Feriados',
  esquema: z.object({ data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), nome: texto() }),
});

/** Um dia (AAAA-MM-DD, Brasília) em que o resumo diário por e-mail já foi feito, e para quantas pessoas. */
export const ResumosEnviados = definirTabela({
  planilha: PLANILHA_REQUISICOES,
  aba: 'ResumosEnviados',
  esquema: z.object({ dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), pessoas: numero() }),
});

export const TABELAS_REQUISICOES = [
  TiposRequisicao,
  CatalogoItens,
  Requisicoes,
  RequisicaoCentros,
  RequisicaoItens,
  RequisicaoHistorico,
  ParametrosRequisicoes,
  FeriadosRequisicoes,
  RequisicaoAnexos,
  Espacos,
  EspacoIndisponibilidades,
  ResumosEnviados,
] as const;

export type RegTipo = Registro<typeof TiposRequisicao.esquema>;
export type RegRequisicao = Registro<typeof Requisicoes.esquema>;
export type RegEspaco = Registro<typeof Espacos.esquema>;
export type RegCentro = Registro<typeof RequisicaoCentros.esquema>;
export type RegItemCatalogo = Registro<typeof CatalogoItens.esquema>;
export type RegItem = Registro<typeof RequisicaoItens.esquema>;
