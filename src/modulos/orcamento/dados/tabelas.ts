/**
 * Abas do módulo Orçamento.
 *
 * - Planilha "orcamento": cadastros não pessoais (centros de custo).
 * - Planilha "orcamento_folha": a folha. Salários são dados pessoais, então
 *   ficam numa planilha à parte, que pode ter compartilhamento mais restrito.
 *
 * Abas com vigência (Componentes, Rateios, TabelaSalarial) só recebem
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

export const CentrosCusto = definirTabela({
  planilha: PLANILHA_ORCAMENTO,
  aba: 'CentrosCusto',
  esquema: z.object({
    codigo: texto(),
    nome: texto(),
    /** Área do Núcleo (código). */
    area: textoOpcional(),
  }),
});

export const Cargos = definirTabela({
  planilha: PLANILHA_FOLHA,
  aba: 'Cargos',
  esquema: z.object({
    codigo: texto(),
    nome: texto(),
    grupo: textoOpcional(),
    requisitos: textoOpcional(),
    classe: textoOpcional(),
    carga_horaria_referencia: numeroOpcional(),
  }),
});

export const NIVEIS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'] as const;

export const TabelaSalarial = definirTabela({
  planilha: PLANILHA_FOLHA,
  aba: 'TabelaSalarial',
  esquema: z.object({
    cargo: texto(),
    nivel: z.enum(NIVEIS),
    valor: numero(),
    vigencia: data(),
  }),
});

export const Postos = definirTabela({
  planilha: PLANILHA_FOLHA,
  aba: 'Postos',
  esquema: z.object({
    /** Nº da ficha do colaborador. Vagas previstas ficam sem ficha. */
    ficha: textoOpcional(),
    /** Vazio = vaga prevista. */
    colaborador: textoOpcional(),
    cargo: texto(),
    nivel: textoOpcional(),
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
  aba: 'Componentes',
  esquema: z.object({
    posto_id: texto(),
    vigencia: data(),
    ...colunasComponentes,
    /** O salário base foi informado à mão, diferente da tabela salarial. */
    fora_da_tabela: booleano(),
  }),
  sigilo: Object.fromEntries(COMPONENTES.map((c) => [c.chave, 'pessoal'])),
});

export const Rateios = definirTabela({
  planilha: PLANILHA_FOLHA,
  aba: 'Rateios',
  esquema: z.object({
    posto_id: texto(),
    /** Identifica as linhas gravadas juntas (um rateio completo). */
    lote: texto(),
    centro_custo: texto(),
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

export type RegCentroCusto = Registro<typeof CentrosCusto.esquema>;
export type RegCargo = Registro<typeof Cargos.esquema>;
export type RegTabelaSalarial = Registro<typeof TabelaSalarial.esquema>;
export type RegPosto = Registro<typeof Postos.esquema>;
export type RegComponentes = Registro<typeof Componentes.esquema>;
export type RegRateio = Registro<typeof Rateios.esquema>;

export const TABELAS_ORCAMENTO = [CentrosCusto, Cargos, TabelaSalarial, Postos, Componentes, Rateios, Parametros] as const;
