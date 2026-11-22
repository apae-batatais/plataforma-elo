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
import { rodarEnvios } from '@/modulos/comunicacao/aplicacao/envios';
import { tarefaDeAvisosDaComunicacao } from './avisos-comunicacao';
import { tarefaDeCredenciais } from './credenciais';
import { tarefaDePublicacoes, tarefaDeResultadosDoInstagram } from './publicacoes';
import type { TarefaDaRotina } from './tarefa-da-rotina';

export type { TarefaDaRotina };
import { configGeral } from './instituicao';
import { instituicoesDoElo } from './rede';


/** Envio automático de release e artigo da Comunicação (ADR-027). */
export const tarefaDeEnviosDaComunicacao: TarefaDaRotina = {
  id: 'comunicacao.envios',
  executar: (app, agora) => rodarEnvios(app.planilhas, { email: app.email, arquivos: app.arquivos }, agora),
};

/** Tarefas da plataforma e dos apps. */
export const TAREFAS_DA_ROTINA: readonly TarefaDaRotina[] = [tarefaDeCredenciais, tarefaDePublicacoes, tarefaDeEnviosDaComunicacao, tarefaDeAvisosDaComunicacao, tarefaDeResultadosDoInstagram];

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
