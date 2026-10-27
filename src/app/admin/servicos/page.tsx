import Link from 'next/link';
import { redirect } from 'next/navigation';
import { lerTabelas } from '@/nucleo/armazenamento/tabela';
import { Areas, EIXOS, Servicos, Unidades } from '@/nucleo/estrutura/tabelas';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { acaoCadastrarServico } from '../acoes';
import { estiloBotao, estiloCampo, Mensagem } from '../mensagem';

const NOME_EIXO: Record<(typeof EIXOS)[number], string> = {
  assistencia_social: 'Assistência Social',
  educacao: 'Educação',
  saude: 'Saúde',
};

export default async function ServicosAdmin({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissao('core.organizacao.gerenciar')) redirect('/');
  const app = await obterAplicacao();
  const [servicos, unidades, areas] = await lerTabelas(app.planilhas, [Servicos, Unidades, Areas] as const);
  const { ok, erro } = await searchParams;
  const nomeUnidade = new Map(unidades.todos().map((u) => [u.codigo, u.nome]));

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="text-sm text-destaque hover:underline">
          ← Portal
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Serviços</h1>
        <p className="mt-1 text-texto-suave">Os serviços da instituição. Eles organizam atendidos, equipes e perfis de acesso.</p>
      </div>

      <Mensagem ok={ok} erro={erro} />

      <section className="rounded-lg border border-borda bg-superficie p-5">
        <h2 className="text-lg font-semibold">Cadastrar serviço</h2>
        <form action={acaoCadastrarServico} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Nome
            <input name="nome" required className={estiloCampo} />
          </label>
          <label className="text-sm">
            Código (minúsculas, sem espaços)
            <input name="codigo" required pattern="[a-z0-9_]+" placeholder="ex.: centro_dia" className={estiloCampo} />
          </label>
          <label className="text-sm">
            Eixo
            <select name="eixo" required className={estiloCampo}>
              {EIXOS.map((e) => (
                <option key={e} value={e}>
                  {NOME_EIXO[e]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Unidade
            <select name="unidade" required className={estiloCampo}>
              {unidades.ativos().map((u) => (
                <option key={u.codigo} value={u.codigo}>
                  {u.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Área
            <select name="area" className={estiloCampo}>
              <option value="">—</option>
              {areas.ativos().map((a) => (
                <option key={a.codigo} value={a.codigo}>
                  {a.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Vagas (opcional)
            <input name="vagas" type="number" min="0" step="1" className={estiloCampo} />
          </label>
          <div className="sm:col-span-2">
            <button className={estiloBotao}>Cadastrar</button>
          </div>
        </form>
      </section>

      <div className="overflow-x-auto rounded-lg border border-borda bg-superficie">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-borda text-texto-suave">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Serviço</th>
              <th scope="col" className="px-4 py-3 font-medium">Eixo</th>
              <th scope="col" className="px-4 py-3 font-medium">Unidade</th>
              <th scope="col" className="px-4 py-3 font-medium">Vagas</th>
            </tr>
          </thead>
          <tbody>
            {servicos.ativos().map((s) => (
              <tr key={s.id} className="border-b border-borda last:border-0">
                <td className="px-4 py-3">
                  {s.nome} <span className="text-texto-suave">({s.codigo})</span>
                </td>
                <td className="px-4 py-3">{NOME_EIXO[s.eixo]}</td>
                <td className="px-4 py-3">{nomeUnidade.get(s.unidade) ?? s.unidade}</td>
                <td className="px-4 py-3">{s.vagas ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
