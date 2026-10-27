/**
 * Auditoria: registra quem leu, incluiu, alterou ou exportou o quê.
 * Fica na planilha "auditoria", que só recebe inclusões.
 * Nunca guarda VALORES dos dados, só os nomes das colunas alteradas.
 */
import { inserir, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { RegistrosAuditoria, type ACOES_AUDITORIA } from '@/nucleo/estrutura/tabelas';

export interface EventoAuditoria {
  usuario: string;
  acao: (typeof ACOES_AUDITORIA)[number];
  entidade: string;
  registroId?: string | null;
  /** Ex.: { colunas: ['telefone'] } ou { motivo: 'revisão' }. Nunca valores de dados pessoais. */
  detalhes?: Record<string, unknown>;
}

export async function registrarAuditoria(p: Planilhas, e: EventoAuditoria, agora = new Date()): Promise<void> {
  await inserir(
    p,
    RegistrosAuditoria,
    {
      ocorrido_em: agora.toISOString(),
      usuario: e.usuario,
      acao: e.acao,
      entidade: e.entidade,
      registro_id: e.registroId ?? null,
      detalhes: e.detalhes ? JSON.stringify(e.detalhes) : null,
    },
    { email: e.usuario, agora: () => agora },
  );
}
