/**
 * Quem está usando a plataforma agora (somente servidor).
 */
import 'server-only';
import { cookies } from 'next/headers';
import { carregarUsuario, type UsuarioCarregado } from '@/nucleo/sessao/carregar';
import { assinarSessao, DURACAO_SESSAO_HORAS, lerSessao, sessaoValeNa } from '@/nucleo/sessao/token';
import { obterAplicacao } from './aplicacao';

export const COOKIE_SESSAO = 'plataforma_sessao';

export type UsuarioLogado = UsuarioCarregado & { demonstracao: boolean };

export async function usuarioLogado(): Promise<UsuarioLogado | null> {
  const app = await obterAplicacao();
  const sessao = await lerSessao(app.config.segredoSessao, (await cookies()).get(COOKIE_SESSAO)?.value);
  if (!sessao || !sessaoValeNa(sessao, app.instituicao.codigo, app.unica)) return null;
  const administradorInicial = app.config.modo === 'producao' && app.config.administradoresIniciais.includes(sessao.email);
  const usuario = await carregarUsuario(app.planilhas, { email: sessao.email, nome: sessao.nome }, { administradorInicial });
  return usuario ? { ...usuario, demonstracao: app.config.modo === 'demonstracao' } : null;
}

export async function iniciarSessao(email: string, nome: string): Promise<void> {
  const app = await obterAplicacao();
  (await cookies()).set(COOKIE_SESSAO, await assinarSessao(app.config.segredoSessao, email, nome, app.instituicao.codigo), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DURACAO_SESSAO_HORAS * 3600,
  });
}

export async function encerrarSessao(): Promise<void> {
  (await cookies()).delete(COOKIE_SESSAO);
}
