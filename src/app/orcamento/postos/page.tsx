import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listarPostos } from '@/modulos/orcamento/aplicacao/folha';
import { data, reais } from '@/modulos/orcamento/telas/formato';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { estiloBotao, estiloCampo, Mensagem } from '../../admin/mensagem';

type Filtros = { ok?: string; busca?: string; cargo?: string; area?: string; centro?: string; atalho?: string };

const ATALHOS = [
  { valor: '', rotulo: 'Todos' },
  { valor: 'sem_rateio', rotulo: 'Sem rateio' },
  { valor: 'fora_de_100', rotulo: 'Rateio diferente de 100%' },
  { valor: 'vagas', rotulo: 'Vagas previstas' },
  { valor: 'desligados', rotulo: 'Desligados' },
];

const SITUACAO = {
  ok: null,
  sem_rateio: 'Sem rateio',
  fora_de_100: 'Rateio ≠ 100%',
} as const;

export default async function Postos({ searchParams }: { searchParams: Promise<Filtros> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissao('orcamento.folha.ver_individual')) redirect('/orcamento');
  const app = await obterAplicacao();
  const r = await listarPostos(app.planilhas, usuario.autorizador);
  const f = await searchParams;
  const busca = (f.busca ?? '').trim().toLowerCase();

  const lista = r.postos.filter((x) => {
    if (busca && !`${x.colaborador ?? ''} ${x.ficha ?? ''}`.toLowerCase().includes(busca)) return false;
    if (f.cargo && x.cargo !== f.cargo) return false;
    if (f.area && !x.areas.includes(f.area)) return false;
    if (f.centro && !x.centros.includes(f.centro)) return false;
    if (f.atalho === 'desligados') return Boolean(x.desligamento);
    if (x.desligamento && f.atalho !== undefined && f.atalho !== '') return false;
    if (f.atalho === 'sem_rateio' || f.atalho === 'fora_de_100') return x.situacaoRateio === f.atalho;
    if (f.atalho === 'vagas') return !x.colaborador;
    return true;
  });
  const total = lista.reduce((s, x) => s + x.custoAnual, 0);
  const podeEditar = usuario.autorizador.temPermissao('orcamento.folha.editar');
  const contagem = (atalho: string) =>
    atalho === 'sem_rateio' || atalho === 'fora_de_100' ? r.postos.filter((x) => !x.desligamento && x.situacaoRateio === atalho).length : null;
  const link = (atalho: string) => `/orcamento/postos${atalho ? `?atalho=${atalho}` : ''}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Postos da folha · {r.ano}</h2>
          <p className="mt-1 text-texto-suave">Cada colaborador ou vaga prevista, com o custo e o rateio. Dados pessoais: o acesso fica registrado.</p>
        </div>
        {podeEditar && (
          <Link href="/orcamento/postos/novo" className={estiloBotao}>
            Cadastrar posto
          </Link>
        )}
      </div>

      <Mensagem ok={f.ok} />

      <ul className="flex flex-wrap gap-2" aria-label="Atalhos">
        {ATALHOS.map((a) => {
          const n = contagem(a.valor);
          const atual = (f.atalho ?? '') === a.valor;
          return (
            <li key={a.valor}>
              <Link
                href={link(a.valor)}
                aria-current={atual ? 'true' : undefined}
                className={`inline-block rounded-full border px-3 py-1 text-sm ${atual ? 'border-destaque bg-destaque-suave font-semibold' : 'border-borda hover:bg-destaque-suave'}`}
              >
                {a.rotulo}
                {n ? <span className={`ml-1.5 rounded-full px-1.5 text-xs ${n > 0 ? 'bg-aviso-fundo text-aviso' : ''}`}>{n}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>

      <form className="grid gap-3 rounded-lg border border-borda bg-superficie p-4 sm:grid-cols-5">
        <input type="hidden" name="atalho" value={f.atalho ?? ''} />
        <label className="text-sm sm:col-span-2">
          Nome ou ficha
          <input name="busca" defaultValue={f.busca} className={estiloCampo} />
        </label>
        <label className="text-sm">
          Cargo
          <select name="cargo" defaultValue={f.cargo ?? ''} className={estiloCampo}>
            <option value="">Todos</option>
            {r.cargos.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Área
          <select name="area" defaultValue={f.area ?? ''} className={estiloCampo}>
            <option value="">Todas</option>
            {r.areas.map((a) => (
              <option key={a.codigo} value={a.codigo}>
                {a.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Centro de custo
          <select name="centro" defaultValue={f.centro ?? ''} className={estiloCampo}>
            <option value="">Todos</option>
            {r.centros.map((c) => (
              <option key={c.codigo} value={c.codigo}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2 sm:col-span-5">
          <button className="rounded-md border border-borda px-3 py-2 text-sm hover:bg-destaque-suave">Filtrar</button>
          <Link href={link(f.atalho ?? '')} className="px-3 py-2 text-sm text-destaque hover:underline">
            Limpar filtros
          </Link>
        </div>
      </form>

      <p className="text-sm text-texto-suave">
        {lista.length} {lista.length === 1 ? 'posto' : 'postos'} · custo no ano {reais(total)}
      </p>

      {lista.length === 0 ? (
        <p className="rounded-lg border border-dashed border-borda p-6">Nenhum posto com esses filtros.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-borda bg-superficie">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-borda text-texto-suave">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Colaborador</th>
                <th scope="col" className="px-4 py-3 font-medium">Cargo</th>
                <th scope="col" className="px-4 py-3 font-medium">Início</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Custo mensal</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">No ano</th>
                <th scope="col" className="px-4 py-3 font-medium">Rateio</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((x) => (
                <tr key={x.id} className="border-b border-borda last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/orcamento/postos/${x.id}`} className="font-medium text-destaque hover:underline">
                      {x.colaborador ?? 'Vaga prevista'}
                    </Link>
                    {x.ficha && <span className="block text-xs text-texto-suave">Ficha {x.ficha}</span>}
                    {x.desligamento && <span className="block text-xs text-texto-suave">Desligado em {data(x.desligamento)}</span>}
                  </td>
                  <td className="px-4 py-2">
                    {x.cargo}
                    {x.nivel && <span className="text-texto-suave"> · nível {x.nivel}</span>}
                  </td>
                  <td className="px-4 py-2 tabular-nums">{data(x.inicio)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{reais(x.custoMensal)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{reais(x.custoAnual)}</td>
                  <td className="px-4 py-2">
                    {SITUACAO[x.situacaoRateio] ? (
                      <span className="rounded bg-aviso-fundo px-2 py-0.5 text-xs font-semibold text-aviso">{SITUACAO[x.situacaoRateio]}</span>
                    ) : (
                      <span className="text-texto-suave">
                        {x.centros.length} {x.centros.length === 1 ? 'centro' : 'centros'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
