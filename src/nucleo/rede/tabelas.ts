/**
 * Abas da planilha "rede", da Operadora do Elo (ADR-012): o cadastro das
 * instituições e quem administra a rede. Não guarda dados de pessoas
 * atendidas, folha nem orçamento de nenhuma instituição.
 */
import { z } from 'zod';
import { definirTabela, texto, textoOpcional } from '@/nucleo/armazenamento/tabela';

export const SITUACOES_INSTITUICAO = ['preparacao', 'ativa', 'suspensa'] as const;

export const Instituicoes = definirTabela({
  planilha: 'rede',
  aba: 'Instituicoes',
  esquema: z.object({
    codigo: texto(),
    nome: texto(),
    nome_completo: textoOpcional(),
    dominio: texto(),
    /** Endereços de acesso, separados por vírgula (ex.: elo.instituicao.org.br). */
    enderecos: textoOpcional(),
    situacao: z.enum(SITUACOES_INSTITUICAO),
    /** IDs das planilhas no Drive da instituição, em JSON ({"nucleo":"…","auditoria":"…"}). */
    planilhas: texto(),
    /** ID da pasta da instituição no Drive compartilhado, onde o Elo cria as planilhas (ADR-018). */
    pasta: textoOpcional(),
    /** E-mails dos administradores iniciais, separados por vírgula. */
    administradores_iniciais: textoOpcional(),
    /** Unidades iniciais, "codigo=Nome" separadas por ponto e vírgula. */
    unidades: textoOpcional(),
  }),
});

export const AdministradoresRede = definirTabela({
  planilha: 'rede',
  aba: 'Administradores',
  esquema: z.object({
    email: texto(),
    nome: texto(),
  }),
  sigilo: { email: 'pessoal', nome: 'pessoal' },
});

export type RegInstituicao = z.infer<typeof Instituicoes.esquema> & { id: string; versao: number; ativo: boolean };
