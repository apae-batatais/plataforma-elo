/**
 * Abas do módulo Parcerias, na planilha própria "parcerias". Sem dados pessoais:
 * valores de termos, vagas e equipe por função (sem nomes).
 */
import { z } from 'zod';
import { booleano, dataOpcional, definirTabela, numeroOpcional, texto, textoOpcional, type Registro } from '@/nucleo/armazenamento/tabela';
import { TIPOS_APORTE, TIPOS_INSTRUMENTO } from '../dominio/termos';

export const PLANILHA_PARCERIAS = 'parcerias';

const vazio = (v: unknown) => v === undefined || v === null || v === '';
const numero = () => z.preprocess((v) => (vazio(v) ? undefined : typeof v === 'number' ? v : Number(String(v).replace(',', '.'))), z.number());
const data = () => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data no formato AAAA-MM-DD');
const mes = () => z.string().regex(/^\d{4}-\d{2}$/, 'mês no formato AAAA-MM');

export const Termos = definirTabela({
  planilha: PLANILHA_PARCERIAS,
  aba: 'Termos',
  esquema: z.object({
    parceiro: texto(),
    numero: texto(),
    objeto: textoOpcional(),
    tipo: z.enum(TIPOS_INSTRUMENTO),
    tipo_descricao: textoOpcional(),
    inicio: data(),
    fim: data(),
    situacao: z.enum(['em_vigor', 'encerrado']),
    unidade_meta: texto(),
    recursos_proprios: numeroOpcional(),
    limite_ocupacao: numeroOpcional(),
  }),
});

export const TermoServicos = definirTabela({
  planilha: PLANILHA_PARCERIAS,
  aba: 'TermoServicos',
  esquema: z.object({
    termo_id: texto(),
    servico: texto(),
    inicio: dataOpcional(),
    fim: dataOpcional(),
    vagas_oferecidas: numeroOpcional(),
    vagas_custeadas: numeroOpcional(),
  }),
});

export const TermoFontes = definirTabela({
  planilha: PLANILHA_PARCERIAS,
  aba: 'TermoFontes',
  esquema: z.object({
    termo_id: texto(),
    nome: texto(),
    forma: z.enum(['global', 'per_capita']),
    valor_inicial: numeroOpcional(),
    per_capita: numeroOpcional(),
    periodicidade: z.preprocess((v) => (vazio(v) ? null : v), z.enum(['mensal', 'anual']).nullable()),
    cronograma: z.enum(['iguais', 'digitado']),
    recursos_proprios: numeroOpcional(),
    permite_remanejar: booleano(),
  }),
});

export const TermoFonteParcelas = definirTabela({
  planilha: PLANILHA_PARCERIAS,
  aba: 'TermoFonteParcelas',
  esquema: z.object({ fonte_id: texto(), mes: mes(), valor: numero() }),
});

export const TermoFonteCategorias = definirTabela({
  planilha: PLANILHA_PARCERIAS,
  aba: 'TermoFonteCategorias',
  esquema: z.object({ fonte_id: texto(), categoria: texto(), valor: numero() }),
});

export const Aportes = definirTabela({
  planilha: PLANILHA_PARCERIAS,
  aba: 'Aportes',
  esquema: z.object({
    termo_id: texto(),
    fonte_id: texto(),
    tipo: z.enum(TIPOS_APORTE),
    registrado_em: data(),
    inicio: data(),
    fim: data(),
    valor: numero(),
    cronograma: z.enum(['iguais', 'digitado']),
    categoria: textoOpcional(),
    descricao: textoOpcional(),
  }),
});

export const AporteParcelas = definirTabela({
  planilha: PLANILHA_PARCERIAS,
  aba: 'AporteParcelas',
  esquema: z.object({ aporte_id: texto(), mes: mes(), valor: numero() }),
});

export const TermoEquipe = definirTabela({
  planilha: PLANILHA_PARCERIAS,
  aba: 'TermoEquipe',
  esquema: z.object({ termo_id: texto(), funcao: texto(), pessoas: numero(), horas_semanais: numero() }),
});

export const Metas = definirTabela({
  planilha: PLANILHA_PARCERIAS,
  aba: 'Metas',
  esquema: z.object({
    termo_id: texto(),
    servico: textoOpcional(),
    descricao: texto(),
    unidade: texto(),
    quantidade: numeroOpcional(),
    quantidade_texto: textoOpcional(),
  }),
});

export const TABELAS_PARCERIAS = [
  Termos,
  TermoServicos,
  TermoFontes,
  TermoFonteParcelas,
  TermoFonteCategorias,
  Aportes,
  AporteParcelas,
  TermoEquipe,
  Metas,
] as const;

export type RegTermo = Registro<typeof Termos.esquema>;
export type RegTermoServico = Registro<typeof TermoServicos.esquema>;
export type RegFonte = Registro<typeof TermoFontes.esquema>;
export type RegParcela = Registro<typeof TermoFonteParcelas.esquema>;
export type RegCategoria = Registro<typeof TermoFonteCategorias.esquema>;
export type RegAporte = Registro<typeof Aportes.esquema>;
export type RegAporteParcela = Registro<typeof AporteParcelas.esquema>;
export type RegEquipe = Registro<typeof TermoEquipe.esquema>;
export type RegMeta = Registro<typeof Metas.esquema>;
