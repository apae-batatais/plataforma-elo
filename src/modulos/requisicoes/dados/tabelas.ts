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
  }),
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
    /** Área (código do Núcleo) e grupo de despesa do orçamento (id e nome no momento do pedido). */
    area: texto(),
    grupo_id: texto(),
    grupo_nome: texto(),
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

export const TABELAS_REQUISICOES = [TiposRequisicao, Requisicoes, RequisicaoCentros, RequisicaoItens, RequisicaoHistorico, ParametrosRequisicoes] as const;

export type RegTipo = Registro<typeof TiposRequisicao.esquema>;
export type RegRequisicao = Registro<typeof Requisicoes.esquema>;
export type RegCentro = Registro<typeof RequisicaoCentros.esquema>;
export type RegItem = Registro<typeof RequisicaoItens.esquema>;
