import Link from 'next/link';
import { redirect } from 'next/navigation';
import { painelDeAcessos } from '@/nucleo/acesso/gestao';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { acaoAtribuirPerfil, acaoCadastrarUsuario, acaoDesativarUsuario, acaoEncerrarAtribuicao } from '../acoes';
import { estiloBotao, estiloBotaoSecundario, estiloCampo, Mensagem } from '../mensagem';

export default async function Acessos({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (usuario.estruturaPendente) redirect('/admin/estrutura');
  if (!usuario.autorizador.temPermissao('core.acessos.gerenciar')) redirect('/');
  const app = await obterAplicacao();
  const painel = await painelDeAcessos(app.planilhas, usuario.autorizador);
  const { ok, erro } = await searchParams;
  const dominio = app.config.modo === 'producao' ? app.config.dominio : null;
  const ativos = painel.usuarios.filter((u) => u.ativo);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="text-sm text-destaque hover:underline">
          ← Portal
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Acessos</h1>
        <p className="mt-1 text-texto-suave">
          Quem pode entrar na plataforma e com qual perfil. Um perfil vale para toda a instituição ou só para uma unidade,
          área ou serviço.
        </p>
      </div>

      <Mensagem ok={ok} erro={erro} />

      <section className="rounded-lg border border-borda bg-superficie p-5">
        <h2 className="text-lg font-semibold">Dar acesso a uma pessoa</h2>
        <form action={acaoCadastrarUsuario} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="text-sm">
            Nome completo
            <input name="nome" required className={estiloCampo} />
          </label>
          <label className="text-sm">
            E-mail {dominio ? `@${dominio}` : ''}
            <input name="email" type="email" required className={estiloCampo} />
          </label>
          <button className={estiloBotao}>Cadastrar</button>
        </form>
      </section>

      <section className="rounded-lg border border-borda bg-superficie p-5">
        <h2 className="text-lg font-semibold">Atribuir perfil</h2>
        <form action={acaoAtribuirPerfil} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <label className="text-sm">
            Pessoa
            <select name="email" required className={estiloCampo}>
              {ativos.map((u) => (
                <option key={u.id} value={u.email}>
                  {u.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Perfil
            <select name="perfil" required className={estiloCampo}>
              {painel.perfis.map((x) => (
                <option key={x.codigo} value={x.codigo}>
                  {x.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Vale para
            <select name="escopo" required className={estiloCampo}>
              <option value="global:">Toda a instituição</option>
              {(['unidade', 'area', 'servico'] as const).map((tipo) => (
                <optgroup key={tipo} label={{ unidade: 'Unidades', area: 'Áreas', servico: 'Serviços' }[tipo]}>
                  {painel.escopos
                    .filter((e) => e.tipo === tipo)
                    .map((e) => (
                      <option key={`${tipo}:${e.codigo}`} value={`${tipo}:${e.codigo}`}>
                        {e.nome}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          <button className={estiloBotao}>Atribuir</button>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Pessoas com acesso</h2>
        <ul className="mt-4 space-y-3">
          {painel.usuarios.map((u) => (
            <li key={u.id} className={`rounded-lg border border-borda bg-superficie p-4 ${u.ativo ? '' : 'opacity-60'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-medium">{u.nome}</span>
                  <span className="ml-2 text-sm text-texto-suave">{u.email}</span>
                  {!u.ativo && <span className="ml-2 text-sm text-aviso">acesso desativado</span>}
                </div>
                {u.ativo && u.email !== usuario.email && (
                  <form action={acaoDesativarUsuario}>
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="versao" value={u.versao} />
                    <button className={estiloBotaoSecundario}>Desativar acesso</button>
                  </form>
                )}
              </div>
              {u.atribuicoes.length > 0 && (
                <ul className="mt-3 space-y-2 text-sm">
                  {u.atribuicoes.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span className={a.vigente ? '' : 'text-texto-suave line-through'}>
                        {a.perfil} · {a.escopo}
                        {!a.vigente && a.fim ? ` (até ${a.fim})` : ''}
                      </span>
                      {a.vigente && (
                        <form action={acaoEncerrarAtribuicao}>
                          <input type="hidden" name="id" value={a.id} />
                          <input type="hidden" name="versao" value={a.versao} />
                          <button className={estiloBotaoSecundario}>Retirar perfil</button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
