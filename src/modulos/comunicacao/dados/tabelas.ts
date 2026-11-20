/**
 * Abas do módulo Comunicação, na planilha própria "comunicacao".
 *
 * - Calendario: temas e datas de comunicação (data exata ou período) e os tipos de peça sugeridos.
 * - Pedidos: a ficha do pedido de publicação, do envio até a publicação.
 * - Historico: cada mudança de situação (só inclusões).
 * - Publicacoes: a fila da publicação automática no Instagram (ADR-028).
 * - Anexos: fotos e documentos do pedido (referência ao arquivo na pasta de anexos).
 * - Contatos, Grupos e ContatoGrupos: a lista de imprensa e os grupos de envio.
 * - Envios: e-mails enviados pelo Elo (release e artigo), com situação, tentativas e erro resumido.
 * - Parametros: ajustes da Comunicação (ex.: antecedência mínima, em dias úteis).
 */
import { z } from 'zod';
import { booleano, definirTabela, texto, textoOpcional, type Registro } from '@/nucleo/armazenamento/tabela';
import type { TipoData } from '../dominio/calendario';
import { SITUACOES_ENVIO, TIPOS_ENVIO } from '../dominio/envio';
import { SITUACOES, TIPOS_PECA } from '../dominio/pedido';
import { SITUACOES_PUBLICACAO, TIPOS_PUBLICACAO } from '../dominio/publicacao';

const vazio = (v: unknown) => v === undefined || v === null || v === '';
const numero = () => z.preprocess((v) => (vazio(v) ? undefined : typeof v === 'number' ? v : Number(String(v).replace(',', '.'))), z.number());
const data = () => z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const TIPOS_DATA = ['exata', 'periodo'] as const satisfies readonly TipoData[];

export const PLANILHA_COMUNICACAO = 'comunicacao';

export const CalendarioComunicacao = definirTabela({
  planilha: PLANILHA_COMUNICACAO,
  aba: 'Calendario',
  esquema: z.object({
    tema: texto(),
    tipo_data: z.enum(TIPOS_DATA),
    inicio: data(),
    fim: data(),
    /** Códigos dos tipos de peça sugeridos, separados por vírgula. */
    tipos: texto(),
    observacao: textoOpcional(),
  }),
});

export const PedidosComunicacao = definirTabela({
  planilha: PLANILHA_COMUNICACAO,
  aba: 'Pedidos',
  esquema: z.object({
    /** COM-AAAA-NNNN. */
    numero: texto(),
    solicitante: texto(),
    solicitante_nome: texto(),
    /** Área (código do Núcleo). */
    area: texto(),
    calendario_id: textoOpcional(),
    calendario_tema: textoOpcional(),
    tipo_peca: z.enum(TIPOS_PECA),
    titulo: texto(),
    descricao: texto(),
    data_desejada: data(),
    urgente: booleano(),
    imagem_confirmada_em: textoOpcional(),
    imagem_confirmada_por: textoOpcional(),
    link_video: textoOpcional(),
    situacao: z.enum(SITUACOES),
    /** Pedido principal, quando este foi juntado a outro. */
    juntado_a: textoOpcional(),
    /** Datas e horas (ISO) de cada etapa. */
    enviado_em: texto(),
    agendado_para: textoOpcional(),
    /** JSON {"grupos": string[], "contatos": string[]} (ids dos grupos e dos contatos). */
    destinatarios: textoOpcional(),
    link_publicacao: textoOpcional(),
    publicado_em: textoOpcional(),
    /** Release e artigo: o Elo envia o e-mail na hora marcada (ADR-027). */
    envio_automatico: booleano(),
    /** Serviço de que o pedido trata (código do Núcleo), para a Ficha do serviço. Opcional. */
    servico: textoOpcional(),
    /** Verdadeiro quando o Elo publica no Instagram na hora marcada (ADR-028). */
    publicacao_automatica: booleano().optional(),
  }),
  sigilo: { solicitante: 'pessoal', solicitante_nome: 'pessoal', imagem_confirmada_por: 'pessoal' },
});

export const HistoricoComunicacao = definirTabela({
  planilha: PLANILHA_COMUNICACAO,
  aba: 'Historico',
  modo: 'somente_inclusao',
  esquema: z.object({
    pedido_id: texto(),
    em: texto(),
    usuario: texto(),
    acao: texto(),
    de: textoOpcional(),
    para: texto(),
    comentario: textoOpcional(),
  }),
  sigilo: { usuario: 'pessoal' },
});

/** Fila da publicação automática no Instagram (ADR-028). Uma linha viva por pedido; nada é apagado. */
export const PublicacoesComunicacao = definirTabela({
  planilha: PLANILHA_COMUNICACAO,
  aba: 'Publicacoes',
  esquema: z.object({
    pedido_id: texto(),
    tipo: z.enum(TIPOS_PUBLICACAO),
    /** Data e hora previstas (ISO UTC). */
    prevista_para: texto(),
    situacao: z.enum(SITUACOES_PUBLICACAO),
    tentativas: numero(),
    /** Não tentar antes desta hora (ISO), depois de uma falha. */
    proxima_tentativa: textoOpcional(),
    /** Identificadores na Meta (não são segredo). */
    container_id: textoOpcional(),
    post_id: textoOpcional(),
    link: textoOpcional(),
    /** Motivo da última falha, em português e sem termo técnico. */
    erro: textoOpcional(),
    publicada_em: textoOpcional(),
    /** Resumo (SHA-256) do código da mídia temporária; vazio quando não há código vivo. */
    codigo_midia: textoOpcional(),
    midia_vence_em: textoOpcional(),
  }),
});

/** Fotos e documentos do pedido: o arquivo fica na pasta de anexos (Drive); aqui, só a referência. */
export const AnexosComunicacao = definirTabela({
  planilha: PLANILHA_COMUNICACAO,
  aba: 'Anexos',
  esquema: z.object({
    pedido_id: texto(),
    tipo: z.enum(['foto', 'documento', 'video']),
    arquivo_id: texto(),
    nome: texto(),
    mime: texto(),
    tamanho: numero(),
  }),
  // A foto pode mostrar pessoas: leitura só pelo Elo, com auditoria.
  sigilo: { arquivo_id: 'sensivel', nome: 'pessoal' },
});

export const ContatosComunicacao = definirTabela({
  planilha: PLANILHA_COMUNICACAO,
  aba: 'Contatos',
  esquema: z.object({ nome: texto(), veiculo: textoOpcional(), email: texto() }),
  sigilo: { nome: 'pessoal', email: 'pessoal' },
});

export const GruposComunicacao = definirTabela({
  planilha: PLANILHA_COMUNICACAO,
  aba: 'Grupos',
  esquema: z.object({ nome: texto() }),
});

export const ContatoGruposComunicacao = definirTabela({
  planilha: PLANILHA_COMUNICACAO,
  aba: 'ContatoGrupos',
  esquema: z.object({ contato_id: texto(), grupo_id: texto() }),
});

export const ParametrosComunicacao = definirTabela({
  planilha: PLANILHA_COMUNICACAO,
  aba: 'Parametros',
  esquema: z.object({ chave: texto(), valor: numero() }),
});

/** Fila e registro dos e-mails que o Elo envia sozinho (ADR-027). O corpo da mensagem não fica gravado. */
export const EnviosComunicacao = definirTabela({
  planilha: PLANILHA_COMUNICACAO,
  aba: 'Envios',
  esquema: z.object({
    pedido_id: texto(),
    tipo: z.enum(TIPOS_ENVIO),
    assunto: texto(),
    /** Endereços de destino da última tentativa (separados por vírgula); vazio enquanto não tentou. */
    destinatarios: textoOpcional(),
    /** Hora marcada para o envio (ISO). */
    previsto_para: texto(),
    /** Quando a rotina pode tentar de novo (ISO). */
    proxima_tentativa: texto(),
    situacao: z.enum(SITUACOES_ENVIO),
    tentativas: numero(),
    enviado_em: textoOpcional(),
    /** Motivo resumido da última falha: nunca traz endereço nem texto da mensagem. */
    erro: textoOpcional(),
  }),
  sigilo: { destinatarios: 'pessoal' },
});

export const TABELAS_COMUNICACAO = [
  CalendarioComunicacao,
  PedidosComunicacao,
  HistoricoComunicacao,
  PublicacoesComunicacao,
  AnexosComunicacao,
  ContatosComunicacao,
  GruposComunicacao,
  ContatoGruposComunicacao,
  ParametrosComunicacao,
  EnviosComunicacao,
] as const;

export type RegCalendario = Registro<typeof CalendarioComunicacao.esquema>;
export type RegPedido = Registro<typeof PedidosComunicacao.esquema>;
export type RegHistorico = Registro<typeof HistoricoComunicacao.esquema>;
export type RegPublicacao = Registro<typeof PublicacoesComunicacao.esquema>;
export type RegAnexo = Registro<typeof AnexosComunicacao.esquema>;
export type RegContato = Registro<typeof ContatosComunicacao.esquema>;
export type RegGrupo = Registro<typeof GruposComunicacao.esquema>;
export type RegContatoGrupo = Registro<typeof ContatoGruposComunicacao.esquema>;
export type RegEnvio = Registro<typeof EnviosComunicacao.esquema>;
export type RegParametro = Registro<typeof ParametrosComunicacao.esquema>;
