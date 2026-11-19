/**
 * Leitura de anexo para mostrar no Elo (ADR-033): confere a faixa pedida, lê o trecho e
 * grava a leitura na auditoria, qualquer que seja o ponto do arquivo onde o pedido começa.
 * Quem pode ver o registro dono é conferido por quem chama (cada módulo tem a sua regra).
 */
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import type { ArmazenamentoArquivos, TrechoLido } from './arquivos';
import type { Planilhas } from './tabela';

/** Maior trecho entregue de uma vez (o servidor da hospedagem limita o tamanho da resposta). */
export const TRECHO_MAXIMO = 4 * 1024 * 1024;

/** Texto único que o navegador recebe quando o arquivo falha; o detalhe técnico vai só para o registro do servidor. */
export const MENSAGEM_ERRO_LEITURA = 'Não foi possível abrir o arquivo agora. Tente de novo; se continuar, avise a Administração.';

/** Faixa pedida fora do arquivo (responde 416). */
export class ErroFaixaInvalida extends Error {
  constructor(readonly total: number) {
    super('Trecho do arquivo fora do tamanho dele.');
  }
}

export interface AnexoParaLer {
  id: string;
  arquivo_id: string;
  tamanho: number;
  mime: string;
}

export async function lerTrechoDeAnexo(
  p: Planilhas,
  arquivos: ArmazenamentoArquivos,
  anexo: AnexoParaLer,
  pedido: { inicio: number; fim: number | null },
  auditoria: { usuario: string; entidade: string },
): Promise<TrechoLido> {
  const { inicio } = pedido;
  if (!Number.isInteger(inicio) || inicio < 0 || inicio >= anexo.tamanho || (pedido.fim !== null && pedido.fim < inicio)) {
    throw new ErroFaixaInvalida(anexo.tamanho);
  }
  const fim = Math.min(pedido.fim ?? anexo.tamanho - 1, inicio + TRECHO_MAXIMO - 1, anexo.tamanho - 1);
  const trecho = await arquivos.ler(anexo.arquivo_id, { inicio, fim });
  await registrarAuditoria(p, {
    usuario: auditoria.usuario,
    acao: 'leitura',
    entidade: auditoria.entidade,
    registroId: anexo.id,
    detalhes: { faixa: `${inicio}-${fim}` },
  });
  return { ...trecho, tipo: anexo.mime };
}
