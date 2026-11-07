/**
 * Abas do módulo Avaliação de Serviços Sociais, na planilha própria "avaliacao_assistencia"
 * (dados sensíveis de atendidos ficam separados das demais planilhas — ADR-011).
 *
 * - Avaliacoes: uma linha por questionário aplicado. O índice de necessidade de
 *   cuidado NÃO é guardado: é calculado pela camada de aplicação a cada leitura.
 *   Avaliação retirada fica com ativo = FALSE e o motivo (nada é apagado).
 */
import { z } from 'zod';
import { definirTabela, texto, textoOpcional } from '@/nucleo/armazenamento/tabela';
import { EVOLUCOES, GRAUS_DEFICIENCIA, GRAUS_DEPENDENCIA, SEXOS, SIM_NAO, TIPOS_AVALIACAO, TRANSPORTES } from '../dominio/avaliacao';

export const PLANILHA_AVALIACAO = 'avaliacao_assistencia';

const data = () =>
  z.preprocess((v) => (v === undefined || v === null ? '' : String(v).trim()), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data no formato AAAA-MM-DD'));

export const Avaliacoes = definirTabela({
  planilha: PLANILHA_AVALIACAO,
  aba: 'Avaliacoes',
  esquema: z.object({
    iniciais: texto(),
    nascimento: data(),
    sexo: z.enum(SEXOS),
    prontuario: textoOpcional(),
    /** Serviço atual (código do Núcleo) e o nome dele no dia da avaliação. */
    servico: texto(),
    servico_nome: texto(),
    data_avaliacao: data(),
    /** Inicial (entrada no serviço) ou acompanhamento anual. Linhas anteriores à coluna contam como inicial. */
    tipo: z.preprocess((v) => (v === undefined || v === null || v === '' ? 'Inicial' : String(v).trim()), z.enum(TIPOS_AVALIACAO)),
    evolucao_usuario: z.enum(EVOLUCOES),
    evolucao_familia: z.enum(EVOLUCOES),
    cuidador: texto(),
    bpc: z.enum(SIM_NAO),
    mae_solo: z.enum(SIM_NAO),
    rede_apoio: z.enum(SIM_NAO),
    cuidador_idoso: z.enum(SIM_NAO),
    nucleo_mais_pcd: z.enum(SIM_NAO),
    adultos_30: z.enum(SIM_NAO),
    isolamento: z.enum(SIM_NAO),
    enfermagem: z.enum(SIM_NAO),
    grau_deficiencia: z.enum(GRAUS_DEFICIENCIA),
    grau_dependencia: z.enum(GRAUS_DEPENDENCIA),
    ostomia: z.enum(SIM_NAO),
    ostomia_tipo: textoOpcional(),
    transporte: z.enum(TRANSPORTES),
    /** Códigos das barreiras separados por vírgula, ou "nenhuma". */
    barreiras: texto(),
    observacoes: textoOpcional(),
    profissional: textoOpcional(),
    registro_profissional: textoOpcional(),
    /** Por que a avaliação foi retirada (quando ativo = FALSE). */
    motivo_retirada: textoOpcional(),
  }),
  sigilo: {
    iniciais: 'pessoal',
    nascimento: 'pessoal',
    sexo: 'pessoal',
    prontuario: 'pessoal',
    cuidador: 'pessoal',
    bpc: 'sensivel',
    mae_solo: 'sensivel',
    rede_apoio: 'sensivel',
    cuidador_idoso: 'sensivel',
    nucleo_mais_pcd: 'sensivel',
    isolamento: 'sensivel',
    enfermagem: 'sensivel',
    grau_deficiencia: 'sensivel',
    grau_dependencia: 'sensivel',
    ostomia: 'sensivel',
    ostomia_tipo: 'sensivel',
    barreiras: 'sensivel',
    observacoes: 'sensivel',
    evolucao_usuario: 'sensivel',
    evolucao_familia: 'sensivel',
  },
});

export const TABELAS_AVALIACAO = [Avaliacoes] as const;
