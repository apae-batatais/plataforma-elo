/**
 * Resumo diário por e-mail de Requisições (entrega 7, ADR-027).
 *
 * - Roda na rotina (a cada 15 minutos), mas só envia em dia útil (sem fim de semana nem feriado do Núcleo), entre 7h e 12h
 *   de Brasília e uma vez por dia por instituição: o dia é gravado em `ResumosEnviados` antes de enviar.
 * - Cada pessoa recebe um e-mail só dela, e só se tiver algo: requisição esperando a aprovação dela, devolvida para ela
 *   ajustar ou atrasada no escopo dela. O texto é fixo (sem dado do pedido).
 * - Falha ao enviar para uma pessoa não impede as outras. Sem remetente cadastrado, nada acontece (sem erro).
 * - Gravação com auditoria só de colunas. Nada é apagado.
 */
import { inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import type { EnviadorDeEmail } from '@/nucleo/email/email';
import { ResumosEnviados } from '../dados/tabelas';
import { conteudoDoResumo, HORA_DO_RESUMO, HORA_LIMITE_DO_RESUMO } from '../dominio/resumo';
import { contagensDoResumo, diaSemExpediente } from './requisicoes';

const SISTEMA = 'rotina@elo';

export interface MeiosDoResumo {
  email: EnviadorDeEmail | null;
  /** Endereço público do Elo, para o link do e-mail. Nulo: nada é enviado. */
  urlBase: string | null;
}

export async function rodarResumoDiario(p: Planilhas, meios: MeiosDoResumo, agora: Date = new Date()): Promise<Record<string, number>> {
  const r = { enviados: 0, falhas: 0 };
  if (!meios.email || !meios.urlBase) return r;
  const brasilia = new Date(agora.getTime() - 3 * 3600_000);
  const hora = brasilia.getUTCHours();
  if (hora < HORA_DO_RESUMO || hora >= HORA_LIMITE_DO_RESUMO) return r;
  if (await diaSemExpediente(p, agora)) return r;
  const dia = brasilia.toISOString().slice(0, 10);
  const [feitos] = await lerTabelas(p, [ResumosEnviados] as const);
  if (feitos.ativos().some((x) => x.dia === dia)) return r;

  const contagens = await contagensDoResumo(p, agora);
  const destinos = [...contagens.entries()];
  // O dia é gravado antes de enviar: se a rotina cair no meio, o resumo não sai duas vezes.
  const linha = await inserir(p, ResumosEnviados, { dia, pessoas: destinos.length }, { email: SISTEMA, agora: () => agora });
  await registrarAuditoria(p, { usuario: SISTEMA, acao: 'inclusao', entidade: 'ResumosEnviados', registroId: linha.id, detalhes: { colunas: ['dia', 'pessoas'] } }, agora);
  for (const [email, c] of destinos) {
    try {
      await meios.email.enviar({ para: [email], ...conteudoDoResumo(c, meios.urlBase) });
      r.enviados++;
    } catch {
      r.falhas++;
    }
  }
  return r;
}
