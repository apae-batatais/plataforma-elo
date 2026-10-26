/**
 * Sessão do usuário (somente servidor).
 *
 * - Modo local: o usuário é escolhido na tela de entrada entre os usuários
 *   fictícios e guardado em um cookie. Não há senha, porque não há dado real.
 * - Produção: o login será feito pelo Supabase Auth, com verificação em duas
 *   etapas. Essa ligação entra quando a conta do Supabase for criada
 *   (portão da Fase 0). Até lá, sem DATABASE_URL a plataforma só roda local.
 */
import 'server-only';
import { cookies } from 'next/headers';
import { modoLocal, obterBanco } from '@/nucleo/db/cliente';
import { carregarContextoUsuario, type ContextoUsuario } from './contexto-usuario';

export const COOKIE_USUARIO_LOCAL = 'plataforma_usuario_local';

export async function usuarioLogado(): Promise<ContextoUsuario | null> {
  if (!modoLocal()) {
    // TODO(Fase 0 · portão): ler a sessão do Supabase Auth com @supabase/ssr.
    throw new Error('Login de produção ainda não configurado: defina o Supabase Auth antes de usar DATABASE_URL.');
  }
  const id = (await cookies()).get(COOKIE_USUARIO_LOCAL)?.value;
  if (!id) return null;
  try {
    return await carregarContextoUsuario(await obterBanco(), id);
  } catch {
    return null;
  }
}
