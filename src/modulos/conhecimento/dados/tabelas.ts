/**
 * Abas do módulo Base de Conhecimento, na planilha própria "conhecimento".
 *
 * - Categorias: assuntos das publicações.
 * - Publicacoes: comunicado, norma ou material de referência (texto e/ou um anexo).
 *   `edicao` conta as versões do conteúdo (a coluna `versao` das abas é o controle de gravação).
 * - Ciencias: "li e estou de acordo", por pessoa e por edição (nunca alterada nem repetida).
 */
import { z } from 'zod';
import { booleano, definirTabela, numeroOpcional, texto, textoOpcional, type Registro } from '@/nucleo/armazenamento/tabela';
import { SITUACOES_ENVIO } from '../dominio/aviso';
import { PUBLICOS, SITUACOES } from '../dominio/publicacao';

export const PLANILHA_CONHECIMENTO = 'conhecimento';

const inteiro = () => z.preprocess((v) => (v === undefined || v === null || v === '' ? undefined : Number(v)), z.number().int());

export const CategoriasConhecimento = definirTabela({
  planilha: PLANILHA_CONHECIMENTO,
  aba: 'Categorias',
  esquema: z.object({ codigo: texto(), nome: texto() }),
});

export const PublicacoesConhecimento = definirTabela({
  planilha: PLANILHA_CONHECIMENTO,
  aba: 'Publicacoes',
  esquema: z.object({
    titulo: texto(),
    categoria: texto(),
    resumo: textoOpcional(),
    corpo: textoOpcional(),
    /** Arquivo no Drive da instituição (código sensível: nunca vai ao navegador). */
    anexo_id: textoOpcional(),
    anexo_nome: textoOpcional(),
    anexo_mime: textoOpcional(),
    anexo_tamanho: numeroOpcional(),
    publico_tipo: z.enum(PUBLICOS),
    /** Código do perfil ou da área, conforme `publico_tipo`. */
    publico_valor: textoOpcional(),
    exige_ciencia: booleano(),
    /** Tem teste de compreensão (as perguntas ficam na aba Perguntas, por edição). */
    tem_teste: booleano(),
    /** Edição atual do conteúdo (começa em 1; "nova versão" soma 1). */
    edicao: inteiro(),
    /** Data e hora (ISO) em que a edição atual começou; conta o prazo de 15 dias. */
    edicao_em: textoOpcional(),
    situacao: z.enum(SITUACOES),
    autor: texto(),
    autor_nome: texto(),
    publicada_em: textoOpcional(),
  }),
  sigilo: { autor: 'pessoal', autor_nome: 'pessoal', anexo_id: 'sensivel' },
});

export const CienciasConhecimento = definirTabela({
  planilha: PLANILHA_CONHECIMENTO,
  aba: 'Ciencias',
  esquema: z.object({
    publicacao_id: texto(),
    edicao: inteiro(),
    usuario: texto(),
    /** Hora do servidor. */
    registrada_em: texto(),
  }),
  sigilo: { usuario: 'pessoal' },
});

export const PerguntasConhecimento = definirTabela({
  planilha: PLANILHA_CONHECIMENTO,
  aba: 'Perguntas',
  esquema: z.object({
    publicacao_id: texto(),
    edicao: inteiro(),
    ordem: inteiro(),
    texto: texto(),
    /** Lista JSON de 2 a 5 opções. */
    opcoes: texto(),
    /** Posição (a partir de 0) da opção certa; o gabarito nunca vai ao navegador antes do envio. */
    correta: inteiro(),
  }),
  sigilo: { correta: 'sensivel' },
});

/** Cada tentativa fica gravada (somente inclusão): nunca alterada. */
export const TentativasTeste = definirTabela({
  planilha: PLANILHA_CONHECIMENTO,
  aba: 'TentativasTeste',
  esquema: z.object({
    publicacao_id: texto(),
    edicao: inteiro(),
    usuario: texto(),
    feita_em: texto(),
    acertos: inteiro(),
    total: inteiro(),
    aprovada: booleano(),
  }),
  sigilo: { usuario: 'pessoal' },
});

/** Uma linha por pessoa e publicação; descurtir = `ativo = FALSE`, curtir de novo reativa a mesma linha. */
export const CurtidasConhecimento = definirTabela({
  planilha: PLANILHA_CONHECIMENTO,
  aba: 'Curtidas',
  esquema: z.object({ publicacao_id: texto(), usuario: texto() }),
  sigilo: { usuario: 'pessoal' },
});

/** Esconder = `ativo = FALSE` (nada é apagado); quem e quando ficam registrados. */
export const ComentariosConhecimento = definirTabela({
  planilha: PLANILHA_CONHECIMENTO,
  aba: 'Comentarios',
  esquema: z.object({
    publicacao_id: texto(),
    usuario: texto(),
    usuario_nome: texto(),
    texto: texto(),
    escondido_por: textoOpcional(),
    escondido_em: textoOpcional(),
  }),
  sigilo: { usuario: 'pessoal', usuario_nome: 'pessoal', escondido_por: 'pessoal' },
});

/** Fila do aviso por e-mail (ADR-027): um por publicação e edição. O corpo da mensagem não fica gravado. */
export const EnviosConhecimento = definirTabela({
  planilha: PLANILHA_CONHECIMENTO,
  aba: 'Envios',
  esquema: z.object({
    publicacao_id: texto(),
    edicao: inteiro(),
    assunto: texto(),
    /** Endereços da última tentativa, separados por vírgula. */
    destinatarios: textoOpcional(),
    proxima_tentativa: texto(),
    situacao: z.enum(SITUACOES_ENVIO),
    tentativas: inteiro(),
    enviado_em: textoOpcional(),
    /** Motivo resumido da última falha: nunca traz endereço nem texto da mensagem. */
    erro: textoOpcional(),
  }),
  sigilo: { destinatarios: 'pessoal' },
});

export const TABELAS_CONHECIMENTO = [CategoriasConhecimento, PublicacoesConhecimento, CienciasConhecimento, PerguntasConhecimento, TentativasTeste, CurtidasConhecimento, ComentariosConhecimento, EnviosConhecimento] as const;

export type RegCategoria = Registro<typeof CategoriasConhecimento.esquema>;
export type RegPublicacao = Registro<typeof PublicacoesConhecimento.esquema>;
export type RegPergunta = Registro<typeof PerguntasConhecimento.esquema>;
export type RegTentativa = Registro<typeof TentativasTeste.esquema>;
export type RegComentario = Registro<typeof ComentariosConhecimento.esquema>;
export type RegEnvio = Registro<typeof EnviosConhecimento.esquema>;
export type RegCiencia = Registro<typeof CienciasConhecimento.esquema>;
