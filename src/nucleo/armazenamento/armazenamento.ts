/**
 * Contrato do armazenamento (ADR-011).
 *
 * As planilhas são SÓ armazenamento: guardam linhas e colunas. Toda regra de
 * negócio, permissão e auditoria fica na camada de aplicação, acima daqui.
 *
 * Valores trafegam como texto, número ou booleano, como o Google Planilhas devolve.
 */
export type Celula = string | number | boolean | null;
export type Linha = Celula[];

export interface Armazenamento {
  /** Lê várias abas de uma planilha de uma só vez (linha 1 = cabeçalho). */
  lerAbas(planilha: string, abas: readonly string[]): Promise<Record<string, Linha[]>>;
  /** Acrescenta linhas ao final da aba. */
  acrescentar(planilha: string, aba: string, linhas: Linha[]): Promise<void>;
  /** Regrava uma linha inteira. `numero` começa em 1 (1 = cabeçalho). */
  gravarLinha(planilha: string, aba: string, numero: number, valores: Linha): Promise<void>;
  /** Cria a aba se não existir e grava o cabeçalho se ela estiver vazia. */
  garantirAba(planilha: string, aba: string, cabecalho: readonly string[]): Promise<'criada' | 'ja_existia'>;
}

/** Erro de armazenamento com mensagem em português para a Diretoria. */
export class ErroArmazenamento extends Error {}
