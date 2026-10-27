import { redirect } from 'next/navigation';
import { lerTabelas } from '@/nucleo/armazenamento/tabela';
import { Atribuicoes, Perfis, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { USUARIOS_FICTICIOS } from '@/nucleo/estrutura/dados-ficticios';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { entrarNaDemonstracao } from '../acoes-sessao';
import { BotaoGoogle } from './botao-google';

export default async function Entrar() {
  if (await usuarioLogado()) redirect('/');
  const app = await obterAplicacao();

  if (app.config.modo === 'producao') {
    return (
      <section className="mx-auto max-w-md space-y-4">
        <h1 className="text-2xl font-semibold">Entrar</h1>
        <p className="text-texto-suave">Use sua conta institucional @{app.config.dominio}.</p>
        <BotaoGoogle clientId={app.config.googleClientId} dominio={app.config.dominio} />
      </section>
    );
  }

  const [usuarios, atribuicoes, perfis, servicos] = await lerTabelas(app.planilhas, [Usuarios, Atribuicoes, Perfis, Servicos] as const);
  const nomePerfil = new Map(perfis.todos().map((p) => [p.codigo, p.nome]));
  const nomeServico = new Map(servicos.todos().map((s) => [s.codigo, s.nome]));
  const nomeUsuario = new Map<string, string>(USUARIOS_FICTICIOS.map((u) => [u.email, u.nome]));

  return (
    <section className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold">Entrar na demonstração</h1>
      <p className="mt-2 text-texto-suave">
        Escolha um usuário fictício. Cada um tem um perfil diferente, para você conferir o que cada pessoa da equipe vai ver.
      </p>
      <ul className="mt-6 space-y-3">
        {usuarios.ativos().map((u) => {
          const perfisDele = atribuicoes
            .ativos()
            .filter((a) => a.usuario_email === u.email)
            .map((a) => `${nomePerfil.get(a.perfil) ?? a.perfil}${a.escopo ? ` · ${nomeServico.get(a.escopo) ?? a.escopo}` : ''}`)
            .join(', ');
          const nome = nomeUsuario.get(u.email) ?? u.email;
          return (
            <li key={u.id}>
              <form action={entrarNaDemonstracao}>
                <input type="hidden" name="email" value={u.email} />
                <input type="hidden" name="nome" value={nome} />
                <button className="w-full rounded-lg border border-borda bg-superficie p-4 text-left hover:border-destaque hover:bg-destaque-suave">
                  <span className="block font-medium">{nome}</span>
                  <span className="block text-sm text-texto-suave">{perfisDele || 'Sem perfil'}</span>
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
