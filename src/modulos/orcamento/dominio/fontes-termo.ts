/**
 * Fontes dos termos (R3a, #140): regras puras da ligação entre a fonte de um termo, a Fonte do cadastro
 * e a conta vinculada da Tesouraria. Sem planilha e sem permissão: quem chama já conferiu.
 */

export type SituacaoLigacao = 'sem_ligacao' | 'ligada' | 'nao_combina';

export interface ContaParaLigacao {
  id: string;
  classe: string;
  /** Fonte do cadastro a que a conta está ligada na Tesouraria. */
  fonteId: string | null;
}

export interface LigacaoDaFonte {
  fonteTermoId: string;
  fonteId: string | null;
  contaId: string | null;
}

/**
 * "Sem ligação" quando a fonte do termo não escolheu a Fonte do cadastro. "Conta e fonte não combinam"
 * quando a conta escolhida pertence, na Tesouraria, a outra Fonte (pega o fundo errado no cabeçalho de um documento).
 */
export function situacaoDaLigacao(l: LigacaoDaFonte | undefined, contas: ReadonlyMap<string, ContaParaLigacao>): SituacaoLigacao {
  if (!l || !l.fonteId) return 'sem_ligacao';
  if (!l.contaId) return 'ligada';
  const conta = contas.get(l.contaId);
  return conta && conta.fonteId === l.fonteId ? 'ligada' : 'nao_combina';
}

/** A conta escolhida precisa ser vinculada. Devolve a mensagem de erro, ou null se serve. */
export function erroDaConta(conta: ContaParaLigacao | undefined): string | null {
  if (!conta) return 'A conta escolhida não existe ou foi excluída.';
  if (conta.classe !== 'vinculada') return 'Escolha uma conta vinculada. Só ela recebe o repasse de um termo.';
  return null;
}

/** Contas usadas por mais de uma fonte de termo ao mesmo tempo (aviso, nunca bloqueia): conta → fontes. */
export function contasRepetidas(ligacoes: readonly LigacaoDaFonte[]): Map<string, string[]> {
  const porConta = new Map<string, string[]>();
  for (const l of ligacoes) if (l.contaId) porConta.set(l.contaId, [...(porConta.get(l.contaId) ?? []), l.fonteTermoId]);
  return new Map([...porConta].filter(([, fontes]) => fontes.length > 1));
}

export const ORIGEM_FOLHA = 'folha';
export const origemDoGrupo = (grupoId: string) => `grupo:${grupoId}`;

/** Origens sem repetição e sem lixo; "folha" ou "grupo:<id>" com id conhecido. Devolve as válidas, em ordem estável. */
export function origensValidas(origens: readonly string[], gruposAtivos: ReadonlySet<string>): string[] {
  const vistas = new Set<string>();
  for (const o of origens) {
    if (o === ORIGEM_FOLHA || (o.startsWith('grupo:') && gruposAtivos.has(o.slice(6)))) vistas.add(o);
  }
  return [...vistas].sort();
}

/** Diferença entre as origens guardadas e as novas de uma categoria. */
export function diferencaDeOrigens(atuais: readonly string[], novas: readonly string[]): { incluir: string[]; encerrar: string[] } {
  const a = new Set(atuais);
  const n = new Set(novas);
  return { incluir: [...n].filter((o) => !a.has(o)), encerrar: [...a].filter((o) => !n.has(o)) };
}
