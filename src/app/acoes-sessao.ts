'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { modoDemonstracao } from '@/nucleo/db/cliente';
import { COOKIE_USUARIO_LOCAL } from '@/nucleo/identidade/sessao';
import { listarUsuariosLocais } from '@/nucleo/identidade/usuarios-locais';

export async function entrarComoUsuarioLocal(formulario: FormData) {
  if (!modoDemonstracao()) throw new Error('Entrada por usuário fictício só existe no modo demonstração.');
  const id = String(formulario.get('usuarioId') ?? '');
  const existe = (await listarUsuariosLocais()).some((u) => u.id === id);
  if (!existe) throw new Error('Usuário fictício não encontrado.');
  (await cookies()).set(COOKIE_USUARIO_LOCAL, id, { httpOnly: true, sameSite: 'lax', path: '/' });
  redirect('/');
}

export async function sair() {
  (await cookies()).delete(COOKIE_USUARIO_LOCAL);
  redirect('/entrar');
}
