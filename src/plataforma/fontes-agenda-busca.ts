/**
 * Quais módulos entram na agenda única e na busca única (ADR-024).
 * Só a plataforma conhece todos os módulos; cada um decide o que a pessoa vê.
 * Para um app novo entrar, exporte as funções no `index.ts` dele e liste aqui.
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import type { Planilhas } from '@/nucleo/armazenamento/tabela';
import type { ItemDaAgenda, OpcoesDaAgenda, ResultadoDaBusca } from '@/nucleo/modulos/agenda-busca';
import { itensDaAgenda as agendaAvaliacao } from '@/modulos/avaliacao';
import { buscar as buscaComunicacao, itensDaAgenda as agendaComunicacao } from '@/modulos/comunicacao';
import { buscar as buscaParcerias, itensDaAgenda as agendaParcerias } from '@/modulos/parcerias';
import { buscar as buscaProjetos, itensDaAgenda as agendaProjetos } from '@/modulos/projetos';
import { buscar as buscaRequisicoes, itensDaAgenda as agendaRequisicoes } from '@/modulos/requisicoes';

export interface FonteAgendaBusca {
  /** Id do módulo (o mesmo do manifesto). */
  id: string;
  agenda?: (p: Planilhas, quem: Autorizador, o: OpcoesDaAgenda) => Promise<ItemDaAgenda[]>;
  /** Recebe o termo já normalizado (sem acento, minúsculo). */
  busca?: (p: Planilhas, quem: Autorizador, termo: string) => Promise<ResultadoDaBusca[]>;
}

/** Na ordem do menu. O Orçamento não entra: hoje não tem data de entrega (especificação da agenda e busca). */
export const FONTES: readonly FonteAgendaBusca[] = [
  { id: 'parcerias', agenda: (p, q) => agendaParcerias(p, q), busca: buscaParcerias },
  { id: 'requisicoes', agenda: (p, q, o) => agendaRequisicoes(p, q, o), busca: buscaRequisicoes },
  { id: 'comunicacao', agenda: (p, q) => agendaComunicacao(p, q), busca: buscaComunicacao },
  { id: 'avaliacao', agenda: (p, q, o) => agendaAvaliacao(p, q, o) },
  { id: 'projetos', agenda: (p, q) => agendaProjetos(p, q), busca: buscaProjetos },
];
