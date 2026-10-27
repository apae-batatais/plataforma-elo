import Link from 'next/link';
import { redirect } from 'next/navigation';
import { usuarioLogado } from '@/plataforma/sessao';
import { menuDoUsuario } from '@/nucleo/modulos/registro';
import { APPS_PLANEJADOS } from '@/plataforma/apps-planejados';
import { MODULOS } from '@/plataforma/registro-modulos';

export default async function Portal() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (usuario.estruturaPendente) redirect('/admin/estrutura');

  const apps = menuDoUsuario(MODULOS, usuario.autorizador.permissoes());
  const podeGerenciar = usuario.autorizador.temPermissao('core.organizacao.gerenciar');
  const podeGerenciarAcessos = usuario.autorizador.temPermissao('core.acessos.gerenciar');
  const ativos = new Set(MODULOS.map((m) => m.nome));
  const planejados = APPS_PLANEJADOS.filter((a) => !ativos.has(a.nome));

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-semibold">Olá, {usuario.nome}</h1>
        <p className="mt-1 text-texto-suave">Seus apps aparecem aqui conforme o seu perfil de acesso.</p>
      </section>

      <section aria-labelledby="titulo-apps">
        <h2 id="titulo-apps" className="text-lg font-semibold">Seus apps</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Link
            href="/nucleo/pessoas"
            className="rounded-lg border border-borda bg-superficie p-5 hover:border-destaque hover:bg-destaque-suave"
          >
            <span className="block font-semibold">Pessoas</span>
            <span className="mt-1 block text-sm text-texto-suave">Cadastro Único: atendidos, familiares e equipe que você pode ver.</span>
          </Link>
          {podeGerenciarAcessos && (
            <Link
              href="/admin/acessos"
              className="rounded-lg border border-borda bg-superficie p-5 hover:border-destaque hover:bg-destaque-suave"
            >
              <span className="block font-semibold">Acessos</span>
              <span className="mt-1 block text-sm text-texto-suave">Quem entra na plataforma e com qual perfil.</span>
            </Link>
          )}
          {podeGerenciar && (
            <Link
              href="/admin/servicos"
              className="rounded-lg border border-borda bg-superficie p-5 hover:border-destaque hover:bg-destaque-suave"
            >
              <span className="block font-semibold">Serviços</span>
              <span className="mt-1 block text-sm text-texto-suave">Serviços da instituição, por eixo e unidade.</span>
            </Link>
          )}
          {podeGerenciar && (
            <Link
              href="/admin/estrutura"
              className="rounded-lg border border-borda bg-superficie p-5 hover:border-destaque hover:bg-destaque-suave"
            >
              <span className="block font-semibold">Estrutura das planilhas</span>
              <span className="mt-1 block text-sm text-texto-suave">Cria as abas que faltam no Drive e a configuração inicial.</span>
            </Link>
          )}
          {apps.map((app) => (
            <Link
              key={app.id}
              href={app.rota}
              className="rounded-lg border border-borda bg-superficie p-5 hover:border-destaque hover:bg-destaque-suave"
            >
              <span className="block font-semibold">{app.nome}</span>
              <span className="mt-1 block text-sm text-texto-suave">{app.descricao}</span>
            </Link>
          ))}
        </div>
      </section>

      {planejados.length > 0 && (
        <section aria-labelledby="titulo-planejados">
          <h2 id="titulo-planejados" className="text-lg font-semibold">Em construção</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {planejados.map((app) => (
              <li key={app.nome} className="rounded-lg border border-dashed border-borda p-5">
                <span className="block font-semibold">
                  {app.nome} <span className="ml-1 text-sm font-normal text-texto-suave">· {app.fase}</span>
                </span>
                <span className="mt-1 block text-sm text-texto-suave">{app.descricao}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="titulo-acesso" className="rounded-lg border border-borda bg-superficie p-5">
        <h2 id="titulo-acesso" className="text-lg font-semibold">Seu acesso</h2>
        {usuario.perfis.length === 0 ? (
          <p className="mt-2 text-texto-suave">Você ainda não tem perfil atribuído. Fale com a administração da plataforma.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {usuario.perfis.map((p) => (
              <li key={`${p.nome}-${p.escopo}`}>
                <span className="font-medium">{p.nome}</span>
                <span className="text-texto-suave"> em {p.escopo}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
