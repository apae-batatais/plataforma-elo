/**
 * Resultado de uma leitura de ligação entre apps (ADR-022).
 *
 * O app dono do dado devolve `ok` com os números ou `sem_permissao` (sem nenhum valor). A plataforma devolve
 * `indisponivel` quando o app não está ativo e `erro` quando a leitura falhou: um bloco nunca derruba a tela.
 */
export type Ligacao<T> = { estado: 'ok'; dados: T } | { estado: 'sem_permissao' } | { estado: 'indisponivel' };

/** O que a plataforma entrega a uma tela: a ligação, ou `erro` se a leitura falhou. */
export type LigacaoLida<T> = Ligacao<T> | { estado: 'erro' };

export const ligacaoOk = <T>(dados: T): Ligacao<T> => ({ estado: 'ok', dados });
export const ligacaoSemPermissao = <T>(): Ligacao<T> => ({ estado: 'sem_permissao' });
