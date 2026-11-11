/**
 * Qual instituição está sendo usada nesta requisição.
 * Em produção, pelo endereço acessado; na demonstração, pela escolha feita na
 * tela de entrada (cookie). Somente servidor.
 */
import 'server-only';
import { cookies, headers } from 'next/headers';
import { acharInstituicao, lerConfigGeral, type ConfigGeral, type Instituicao } from '@/nucleo/config';
import { instituicoesDoElo } from './rede';

export type { Instituicao };
export const COOKIE_INSTITUICAO_DEMONSTRACAO = 'elo_instituicao';

/** O endereço acessado não pertence a nenhuma instituição, ou a instituição está suspensa. */
export class ErroInstituicao extends Error {
  constructor(
    message: string,
    readonly motivo: 'desconhecida' | 'suspensa' | 'preparacao',
  ) {
    super(message);
  }
}

let geral: ConfigGeral | undefined;
export function configGeral(): ConfigGeral {
  geral ??= lerConfigGeral();
  return geral;
}

export async function instituicaoAtual(): Promise<Instituicao> {
  const g = configGeral();
  const host = (await headers()).get('x-forwarded-host') ?? (await headers()).get('host');
  const escolha = g.modo === 'demonstracao' ? (await cookies()).get(COOKIE_INSTITUICAO_DEMONSTRACAO)?.value : undefined;
  const inst = acharInstituicao({ modo: g.modo, instituicoes: await instituicoesDoElo(g) }, host, escolha);
  if (!inst) throw new ErroInstituicao('Este endereço não pertence a nenhuma instituição do Elo.', 'desconhecida');
  if (inst.situacao === 'preparacao') throw new ErroInstituicao(`A ${inst.nome} ainda está em preparação no Elo.`, 'preparacao');
  if (inst.situacao === 'suspensa') throw new ErroInstituicao(`O acesso da ${inst.nome} ao Elo está suspenso. Os dados continuam no Drive da instituição.`, 'suspensa');
  return inst;
}
