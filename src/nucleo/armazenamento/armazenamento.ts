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
  /**
   * Cria as abas que não existem e grava o cabeçalho das que estão vazias,
   * com o mínimo de chamadas. Devolve os nomes das abas criadas ou preenchidas.
   * Nunca altera aba que já tem conteúdo.
   */
  garantirAbas(planilha: string, abas: readonly { aba: string; cabecalho: readonly string[] }[]): Promise<string[]>;
  /** Nomes das abas da planilha (confere se ela existe e está compartilhada, sem ler dados). */
  listarAbas(planilha: string): Promise<string[]>;
}

/** Erro de armazenamento com mensagem em português para a Diretoria. */
export class ErroArmazenamento extends Error {}

/** A aba procurada ainda não existe (planilha nova): é preciso rodar "Preparar estrutura". */
export class ErroEstruturaAusente extends ErroArmazenamento {}
