/**
 * Abas do app Educação, na planilha própria "avaliacao_educacao" (dados sensíveis de atendidos ficam
 * separados das demais planilhas — ADR-011).
 *
 * - Instrumentos: os instrumentos versionados (sem dado de pessoa). Depois de usado, não muda (ADR-007).
 * - Aplicacoes: uma por pessoa e período. Total, subtotais e faixa NÃO são guardados: são calculados na leitura.
 * - Respostas: uma linha por item respondido (0 a 3).
 * Nada é apagado: aplicação aberta desistida fica com ativo = FALSE e o motivo; fechada só é corrigida.
 */
import { z } from 'zod';
import { dataOpcional, definirTabela, texto, textoOpcional } from '@/nucleo/armazenamento/tabela';

export const PLANILHA_EDUCACAO = 'avaliacao_educacao';

export const SITUACOES = ['aberta', 'fechada'] as const;

const inteiro = () => z.preprocess((v) => (v === '' || v == null ? undefined : Number(v)), z.number().int());

export const Instrumentos = definirTabela({
  planilha: PLANILHA_EDUCACAO,
  aba: 'Instrumentos',
  esquema: z.object({
    codigo: texto(),
    versao_instrumento: inteiro(),
    nome: texto(),
    referenciais: textoOpcional(),
    /** Instrumento inteiro (domínios, itens com etiqueta CIF e faixas), em JSON. */
    definicao: texto(),
  }),
});

export const Aplicacoes = definirTabela({
  planilha: PLANILHA_EDUCACAO,
  aba: 'Aplicacoes',
  esquema: z.object({
    pessoa_id: texto(),
    instrumento: texto(),
    instrumento_versao: inteiro(),
    servico: texto(),
    periodo_inicio: dataOpcional(),
    periodo_fim: dataOpcional(),
    data_ingresso: dataOpcional(),
    situacao: z.enum(SITUACOES),
    /** Id da aplicação que esta corrige. */
    corrige: textoOpcional(),
    profissional: textoOpcional(),
    funcao: textoOpcional(),
    data_assinatura: dataOpcional(),
    ciente_por: textoOpcional(),
    ciente_em: dataOpcional(),
    justificativa: textoOpcional(),
    motivo_desistencia: textoOpcional(),
  }),
  sigilo: {
    pessoa_id: 'pessoal',
    profissional: 'pessoal',
    justificativa: 'sensivel',
    motivo_desistencia: 'sensivel',
  },
});

export const Respostas = definirTabela({
  planilha: PLANILHA_EDUCACAO,
  aba: 'Respostas',
  esquema: z.object({
    aplicacao_id: texto(),
    item: inteiro(),
    valor: inteiro(),
  }),
  sigilo: { valor: 'sensivel' },
});

export const TABELAS_EDUCACAO = [Instrumentos, Aplicacoes, Respostas] as const;
