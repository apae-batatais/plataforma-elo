/**
 * Abas do módulo Saúde, na planilha própria "avaliacao_saude" (dados sensíveis de atendidos
 * ficam separados das demais planilhas — ADR-011).
 *
 * - Instrumentos: o instrumento do CER como dado (definição em JSON), uma linha por versão.
 * - Aplicacoes: uma linha por aplicação do instrumento a uma pessoa em um período.
 * - Respostas: uma linha por item respondido.
 * Total, subtotais, faixa e principal barreira NÃO são guardados: o motor calcula a cada leitura.
 */
import { z } from 'zod';
import { dataOpcional, definirTabela, texto, textoOpcional } from '@/nucleo/armazenamento/tabela';

export const PLANILHA_SAUDE = 'avaliacao_saude';
export const SITUACOES = ['aberta', 'fechada'] as const;

const data = () =>
  z.preprocess((v) => (v === undefined || v === null ? '' : String(v).trim()), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data no formato AAAA-MM-DD'));
const inteiro = () => z.preprocess((v) => (typeof v === 'number' ? v : Number(String(v ?? '').trim())), z.number().int());

export const Instrumentos = definirTabela({
  planilha: PLANILHA_SAUDE,
  aba: 'Instrumentos',
  esquema: z.object({
    codigo: texto(),
    versao_instrumento: inteiro(),
    nome: texto(),
    /** Definição completa (domínios, itens, faixas) em JSON. */
    definicao: texto(),
  }),
});

export const Aplicacoes = definirTabela({
  planilha: PLANILHA_SAUDE,
  aba: 'Aplicacoes',
  esquema: z.object({
    pessoa_id: texto(),
    instrumento: texto(),
    versao_instrumento: inteiro(),
    servico: texto(),
    servico_nome: texto(),
    periodo_inicio: data(),
    periodo_fim: data(),
    data_ingresso: data(),
    situacao: z.enum(SITUACOES),
    /** Id da aplicação fechada que esta corrige. */
    corrige: textoOpcional(),
    profissional: textoOpcional(),
    funcao: textoOpcional(),
    data_assinatura: dataOpcional(),
    ciente_por: textoOpcional(),
    ciente_em: textoOpcional(),
    justificativa: textoOpcional(),
    /** Por que uma aplicação aberta foi desistida (quando ativo = FALSE). */
    motivo_desistencia: textoOpcional(),
  }),
  sigilo: { pessoa_id: 'pessoal', justificativa: 'sensivel' },
});

export const Respostas = definirTabela({
  planilha: PLANILHA_SAUDE,
  aba: 'Respostas',
  esquema: z.object({
    aplicacao_id: texto(),
    item: inteiro(),
    valor: inteiro(),
  }),
  sigilo: { valor: 'sensivel' },
});

export const TABELAS_SAUDE = [Instrumentos, Aplicacoes, Respostas] as const;
