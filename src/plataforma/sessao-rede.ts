/**
 * Sessão da Administração da rede (somente servidor): cookie próprio, que não
 * vale nas instituições, e vice-versa (ADR-012).
 */
import 'server-only';
import { cookies, headers } from 'next/headers';
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { autorizadorDaRede } from '@/nucleo/rede/rede';
import { assinarSessao, DURACAO_SESSAO_HORAS, lerSessao } from '@/nucleo/sessao/token';
import { configGeral } from './instituicao';
import { aplicacaoDaRede, type AplicacaoDaRede } from './rede';

export const COOKIE_SESSAO_REDE = 'elo_rede_sessao';
const MARCA_REDE = '__rede__';

export interface AdministradorDaRede {
  email: string;
  nome: string;
  autorizador: Autorizador;
  app: AplicacaoDaRede;
  demonstracao: boolean;
}

/** A área da rede pode ser aberta neste endereço? (com endereços configurados, só neles) */
export async function enderecoDaRede(): Promise<boolean> {
  const g = configGeral();
  const enderecos = g.rede?.enderecos ?? [];
  if (g.modo === 'demonstracao' || enderecos.length === 0) return true;
  const h = ((await headers()).get('x-forwarded-host') ?? (await headers()).get('host') ?? '').toLowerCase().replace(/:\d+$/, '');
  return enderecos.includes(h);
}

export async function aplicacaoDaRedeAtual(): Promise<AplicacaoDaRede | null> {
  return aplicacaoDaRede(configGeral());
}

export async function administradorDaRedeLogado(): Promise<AdministradorDaRede | null> {
  const app = await aplicacaoDaRedeAtual();
  if (!app) return null;
  const g = configGeral();
  const sessao = await lerSessao(g.segredoSessao, (await cookies()).get(COOKIE_SESSAO_REDE)?.value);
  if (!sessao || sessao.instituicao !== MARCA_REDE) return null;
  const autorizador = await autorizadorDaRede(app.planilhas, sessao.email, app.rede.administradores);
  if (!autorizador.temPermissao('rede.instituicoes.gerenciar')) return null;
  return { email: sessao.email, nome: sessao.nome, autorizador, app, demonstracao: g.modo === 'demonstracao' };
}

export async function iniciarSessaoRede(email: string, nome: string): Promise<void> {
  (await cookies()).set(COOKIE_SESSAO_REDE, await assinarSessao(configGeral().segredoSessao, email, nome, MARCA_REDE), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/rede',
    maxAge: DURACAO_SESSAO_HORAS * 3600,
  });
}

export async function encerrarSessaoRede(): Promise<void> {
  (await cookies()).delete({ name: COOKIE_SESSAO_REDE, path: '/rede' });
}
