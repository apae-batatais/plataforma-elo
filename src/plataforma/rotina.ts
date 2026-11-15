/**
 * Rotina agendada (ADR-027): o GitHub Actions chama `POST /api/rotina` a cada 15 minutos e a plataforma
 * roda as tarefas de cada instituição ativa. Somente servidor.
 *
 * Cada tarefa é idempotente (rodar duas vezes não repete o efeito) e devolve só contagens, nunca dados.
 * Um app que precisa de rotina (envio agendado, lembretes) acrescenta a tarefa dele em TAREFAS_DA_ROTINA.
 */
import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import type { Aplicacao } from './aplicacao';
import { aplicacaoDa } from './aplicacao';
import { configGeral } from './instituicao';
import { instituicoesDoElo } from './rede';

export interface TarefaDaRotina {
  /** Identificador estável, usado no resultado (ex.: "comunicacao.envios"). */
  id: string;
  /** Roda a tarefa da instituição; devolve contagens (ex.: { enviados: 2 }). */
  executar(app: Aplicacao, agora: Date): Promise<Record<string, number>>;
}

/** Tarefas dos apps. Vazia até a entrega 2 da proposta #63 (envios da Comunicação). */
export const TAREFAS_DA_ROTINA: readonly TarefaDaRotina[] = [];

export interface ResultadoDaRotina {
  instituicoes: number;
  /** Por instituição (código) e tarefa: contagens, ou "falhou". */
  tarefas: Record<string, Record<string, Record<string, number> | 'falhou'>>;
}

/** Confere a chave da rotina em tempo constante. Sem `ROTINA_TOKEN` configurado, nenhuma chamada passa. */
export function chaveDaRotinaValida(recebida: string | null, esperada: string | undefined = process.env.ROTINA_TOKEN): boolean {
  const e = (esperada ?? '').trim();
  if (e.length < 32 || !recebida) return false;
  const a = Buffer.from(recebida);
  const b = Buffer.from(e);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function rodarRotina(agora = new Date(), tarefas: readonly TarefaDaRotina[] = TAREFAS_DA_ROTINA): Promise<ResultadoDaRotina> {
  const geral = configGeral();
  const ativas = (await instituicoesDoElo(geral)).filter((i) => i.situacao === 'ativa');
  const resultado: ResultadoDaRotina = { instituicoes: ativas.length, tarefas: {} };
  for (const inst of ativas) {
    resultado.tarefas[inst.codigo] = {};
    if (tarefas.length === 0) continue;
    let app: Aplicacao;
    try {
      app = await aplicacaoDa(geral, inst);
    } catch {
      // Uma instituição com problema não impede as outras.
      for (const t of tarefas) resultado.tarefas[inst.codigo][t.id] = 'falhou';
      continue;
    }
    for (const t of tarefas) {
      try {
        resultado.tarefas[inst.codigo][t.id] = await t.executar(app, agora);
      } catch {
        resultado.tarefas[inst.codigo][t.id] = 'falhou';
      }
    }
  }
  return resultado;
}
