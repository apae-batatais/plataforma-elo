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

export const TABELAS_CONHECIMENTO = [CategoriasConhecimento, PublicacoesConhecimento, CienciasConhecimento] as const;

export type RegCategoria = Registro<typeof CategoriasConhecimento.esquema>;
export type RegPublicacao = Registro<typeof PublicacoesConhecimento.esquema>;
export type RegCiencia = Registro<typeof CienciasConhecimento.esquema>;
