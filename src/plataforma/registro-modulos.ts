/**
 * Composição da plataforma: a lista de módulos ativos.
 *
 * Este é o ÚNICO lugar (junto com as rotas em src/app) que conhece os
 * módulos. Para ativar um app novo, importe aqui o manifesto e as tabelas
 * dele. A validação roda ao carregar: um manifesto inconsistente impede o
 * app de subir, em vez de falhar escondido em produção.
 */
import type { z } from 'zod';
import type { DefinicaoTabela } from '@/nucleo/armazenamento/tabela';
import type { Manifesto } from '@/nucleo/modulos/manifesto';
import { validarRegistro } from '@/nucleo/modulos/registro';

import type { EstruturaDosModulos } from '@/nucleo/estrutura/preparar';
import { manifesto as orcamento, popularCedidosFicticia, popularFolhaFicticia, popularHistoricoFicticia, popularPrevisaoFicticia, popularRealizadoFicticio, popularTesourariaFicticia, TABELAS_ORCAMENTO } from '@/modulos/orcamento';
import { manifesto as comunicacao, popularComunicacaoFicticia, TABELAS_COMUNICACAO } from '@/modulos/comunicacao';
import { manifesto as requisicoes, lerFeriadosAntigos, popularRequisicoesFicticias, TABELAS_REQUISICOES } from '@/modulos/requisicoes';
import { manifesto as parcerias, popularParceriasFicticias, TABELAS_PARCERIAS } from '@/modulos/parcerias';
import { manifesto as avaliacao, popularAplicacoesFicticias, popularAvaliacoesFicticias, TABELAS_AVALIACAO } from '@/modulos/avaliacao';
import { manifesto as educacao, popularEducacaoFicticia, TABELAS_EDUCACAO } from '@/modulos/educacao';
import { manifesto as projetos, popularProjetosFicticios, TABELAS_PROJETOS } from '@/modulos/projetos';
import { manifesto as saude, popularSaudeFicticia, TABELAS_SAUDE } from '@/modulos/saude';
import type { Planilhas } from '@/nucleo/armazenamento/tabela';

export const MODULOS: readonly Manifesto[] = [orcamento, parcerias, requisicoes, comunicacao, avaliacao, saude, educacao, projetos];

/** Tabelas (abas) de todos os módulos ativos, usadas por "Preparar estrutura". */
export const TABELAS_DOS_MODULOS: readonly DefinicaoTabela<z.ZodObject>[] = [...TABELAS_ORCAMENTO, ...TABELAS_PARCERIAS, ...TABELAS_REQUISICOES, ...TABELAS_COMUNICACAO, ...TABELAS_AVALIACAO, ...TABELAS_SAUDE, ...TABELAS_EDUCACAO, ...TABELAS_PROJETOS] as DefinicaoTabela<z.ZodObject>[];

/** Abas, perfis e permissões que os módulos acrescentam em "Preparar estrutura". */
export const ESTRUTURA_DOS_MODULOS: EstruturaDosModulos = {
  tabelas: TABELAS_DOS_MODULOS,
  perfis: MODULOS.flatMap((m) => m.perfis),
  permissoes: MODULOS.flatMap((m) => Object.entries(m.permissoesPorPerfil).flatMap(([perfil, lista]) => lista.map((permissao) => ({ perfil, permissao })))),
  permissoesRetiradas: MODULOS.flatMap((m) =>
    Object.entries(m.permissoesRetiradas).flatMap(([perfil, lista]) => lista.map((permissao) => ({ perfil, permissao }))),
  ),
  // Só enquanto o app Requisições estiver ativo: copia os feriados que ele guardava na aba própria.
  feriadosAntigos: { planilha: 'requisicoes', ler: lerFeriadosAntigos },
};

/** Dados fictícios dos módulos, gravados só na demonstração (em memória). */
export async function popularDemonstracaoDosModulos(p: Planilhas): Promise<void> {
  await popularFolhaFicticia(p);
  await popularPrevisaoFicticia(p);
  await popularTesourariaFicticia(p);
  await popularRealizadoFicticio(p);
  await popularCedidosFicticia(p);
  await popularHistoricoFicticia(p);
  await popularParceriasFicticias(p);
  await popularRequisicoesFicticias(p);
  await popularComunicacaoFicticia(p);
  await popularAvaliacoesFicticias(p);
  await popularAplicacoesFicticias(p);
  await popularSaudeFicticia(p);
  await popularEducacaoFicticia(p);
  await popularProjetosFicticios(p);
}

validarRegistro(MODULOS);
