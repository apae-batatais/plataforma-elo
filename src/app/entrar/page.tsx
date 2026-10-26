import { redirect } from 'next/navigation';
import { modoLocal } from '@/nucleo/db/cliente';
import { usuarioLogado } from '@/nucleo/identidade/sessao';
import { listarUsuariosLocais } from '@/nucleo/identidade/usuarios-locais';
import { entrarComoUsuarioLocal } from '../acoes-sessao';

export default async function Entrar() {
  if (await usuarioLogado()) redirect('/');

  if (!modoLocal()) {
    return (
      <section className="mx-auto max-w-md">
        <h1 className="text-2xl font-semibold">Entrar</h1>
        <p className="mt-3 text-texto-suave">O login com e-mail e verificação em duas etapas será ativado junto com o Supabase.</p>
      </section>
    );
  }

  const usuarios = await listarUsuariosLocais();
  return (
    <section className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold">Entrar no modo local</h1>
      <p className="mt-2 text-texto-suave">
        Escolha um usuário fictício. Cada um tem um perfil diferente, para você conferir o que cada pessoa da equipe vai ver.
      </p>
      {usuarios.length === 0 ? (
        <p className="mt-6 rounded-lg border border-borda bg-superficie p-4">
          Nenhum usuário ainda. Rode <code className="font-mono">npm run dados:ficticios</code> e recarregue a página.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {usuarios.map((u) => (
            <li key={u.id}>
              <form action={entrarComoUsuarioLocal}>
                <input type="hidden" name="usuarioId" value={u.id} />
                <button className="w-full rounded-lg border border-borda bg-superficie p-4 text-left hover:border-destaque hover:bg-destaque-suave">
                  <span className="block font-medium">{u.nome}</span>
                  <span className="block text-sm text-texto-suave">{u.perfis ?? 'Sem perfil'}</span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
