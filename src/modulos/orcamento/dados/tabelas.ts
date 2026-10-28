/**
 * Abas do módulo Orçamento.
 *
 * - Planilha "orcamento_folha": a folha. Salários são dados pessoais, então
 *   ficam numa planilha à parte, que pode ter compartilhamento mais restrito.
 * - Os "centros de custo" são os Serviços do Núcleo (Administração › Serviços).
 * - A planilha "orcamento" será usada a partir da Entrega 1B (previsão).
 *
 * Abas com vigência (Componentes e Lotacoes) só recebem
 * inclusões: mudar um valor grava uma linha nova, e a mais recente vale a
 * partir da sua vigência. Assim o histórico mês a mês é preservado.
 */
import { z } from 'zod';
import { booleano, dataOpcional, definirTabela, numeroOpcional, texto, textoOpcional, type Registro } from '@/nucleo/armazenamento/tabela';
import { COMPONENTES } from '../dominio/folha';

const vazio = (v: unknown) => v === undefined || v === null || v === '';
const numero = () => z.preprocess((v) => (vazio(v) ? undefined : typeof v === 'number' ? v : Number(String(v).replace(',', '.'))), z.number());
const data = () => z.preprocess((v) => (vazio(v) ? undefined : String(v).trim()), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data no formato AAAA-MM-DD'));

export const PLANILHA_ORCAMENTO = 'orcamento';
export const PLANILHA_FOLHA = 'orcamento_folha';

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
  }),
  sigilo: { colaborador: 'pessoal' },
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

export const Parametros = definirTabela({
  planilha: PLANILHA_FOLHA,
  aba: 'Parametros',
  esquema: z.object({
    chave: texto(),
    valor: numero(),
  }),
});

export type RegPosto = Registro<typeof Postos.esquema>;
export type RegComponentes = Registro<typeof Componentes.esquema>;
export type RegRateio = Registro<typeof Rateios.esquema>;

export const TABELAS_ORCAMENTO = [Postos, Componentes, Rateios, Parametros] as const;
