import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listarPostos, type LinhaPosto } from '@/modulos/orcamento/aplicacao/folha';
import { data, reais } from '@/modulos/orcamento/telas/formato';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { estiloBotao, LinkBotao } from '@/ui/botao';
import { Campo, estiloEntrada } from '@/ui/campo';
import { IconeMais } from '@/ui/icones';
import { CabecalhoPagina, EstadoVazio, Etiqueta, tabela } from '@/ui/pagina';

export const metadata: Metadata = { title: 'Postos da folha' };

type Filtros = { busca?: string; cargo?: string; area?: string; centro?: string; atalho?: string };

const ATALHOS: { valor: string; rotulo: string; filtro: (x: LinhaPosto) => boolean; alerta?: boolean }[] = [
  { valor: '', rotulo: 'Ativos', filtro: (x) => !x.desligamento },
  { valor: 'sem_rateio', rotulo: 'Sem rateio', filtro: (x) => !x.desligamento && x.situacaoRateio === 'sem_rateio', alerta: true },
  { valor: 'fora_de_100', rotulo: 'Rateio diferente de 100%', filtro: (x) => !x.desligamento && x.situacaoRateio === 'fora_de_100', alerta: true },
  { valor: 'vagas', rotulo: 'Vagas previstas', filtro: (x) => !x.desligamento && !x.colaborador },
  { valor: 'desligados', rotulo: 'Desligados', filtro: (x) => Boolean(x.desligamento) },
];

export default async function Postos({ searchParams }: { searchParams: Promise<Filtros> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissao('orcamento.folha.ver_individual')) redirect('/orcamento');
  const app = await obterAplicacao();
  const r = await listarPostos(app.planilhas, usuario.autorizador);
  const f = await searchParams;
  const busca = (f.busca ?? '').trim().toLowerCase();
  const atalho = ATALHOS.find((a) => a.valor === (f.atalho ?? '')) ?? ATALHOS[0];
  const temFiltro = Boolean(busca || f.cargo || f.area || f.centro);

  const lista = r.postos.filter((x) => {
    if (!atalho.filtro(x)) return false;
    if (busca && !`${x.colaborador ?? 'vaga prevista'} ${x.ficha ?? ''}`.toLowerCase().includes(busca)) return false;
    if (f.cargo && x.cargo !== f.cargo) return false;
    if (f.area && !x.areas.includes(f.area)) return false;
    if (f.centro && !x.centros.includes(f.centro)) return false;
    return true;
  });
  const total = lista.reduce((s, x) => s + x.custoAnual, 0);
  const podeEditar = usuario.autorizador.temPermissao('orcamento.folha.editar');
  const link = (valor: string) => `/orcamento/postos${valor ? `?atalho=${valor}` : ''}`;

  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento' }, { rotulo: 'Postos' }]}
        titulo={`Postos da folha ${r.ano}`}
        descricao="Cada colaborador ou vaga prevista, com o custo e o rateio. São dados pessoais: cada consulta fica registrada."
        acoes={
          podeEditar ? (
            <LinkBotao href="/orcamento/postos/novo">
              <IconeMais tamanho={18} />
              Cadastrar posto
            </LinkBotao>
          ) : undefined
        }
      />

      <nav aria-label="Situação dos postos" className="-mx-1 mb-4 overflow-x-auto px-1">
        <ul className="flex min-w-max gap-1 border-b border-borda">
          {ATALHOS.map((a) => {
            const n = r.postos.filter(a.filtro).length;
            const atual = a.valor === atalho.valor;
            return (
              <li key={a.valor}>
                <Link
                  href={link(a.valor)}
                  aria-current={atual ? 'true' : undefined}
                  className={`-mb-px flex items-center gap-2 border-b-[3px] px-3 py-2.5 text-sm ${
                    atual ? 'border-destaque font-semibold text-texto' : 'border-transparent text-texto-suave hover:text-texto'
                  }`}
                >
                  {a.rotulo}
                  <span
                    className={`rounded-full px-2 text-xs font-semibold tabular-nums ${a.alerta && n > 0 ? 'bg-aviso-fundo text-aviso' : 'bg-superficie-2 text-texto-suave'}`}
                  >
                    {n}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <details className="mb-4 rounded-xl border border-borda bg-superficie" open={temFiltro}>
        <summary className="cursor-pointer select-none px-5 py-3 font-semibold">
          Filtrar {temFiltro && <Etiqueta tipo="info">filtros ativos</Etiqueta>}
        </summary>
        <form className="grid gap-4 border-t border-borda p-5 sm:grid-cols-2 lg:grid-cols-4">
          {f.atalho && <input type="hidden" name="atalho" value={f.atalho} />}
          <Campo rotulo="Nome ou ficha">
            <input name="busca" defaultValue={f.busca} className={estiloEntrada} />
          </Campo>
          <Campo rotulo="Cargo">
            <select name="cargo" defaultValue={f.cargo ?? ''} className={estiloEntrada}>
              <option value="">Todos</option>
              {r.cargos.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Área">
            <select name="area" defaultValue={f.area ?? ''} className={estiloEntrada}>
              <option value="">Todas</option>
              {r.areas.map((a) => (
                <option key={a.codigo} value={a.codigo}>
                  {a.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Centro de custo">
            <select name="centro" defaultValue={f.centro ?? ''} className={estiloEntrada}>
              <option value="">Todos</option>
              {r.centros.map((c) => (
                <option key={c.codigo} value={c.codigo}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Campo>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
            <button className={estiloBotao('primario')}>Aplicar filtros</button>
            {temFiltro && (
              <Link href={link(f.atalho ?? '')} className={estiloBotao('fantasma')}>
                Limpar
              </Link>
            )}
          </div>
        </form>
      </details>

      {lista.length === 0 ? (
        <EstadoVazio
          titulo={temFiltro ? 'Nenhum posto com esses filtros' : atalho.alerta ? 'Nenhum posto pendente' : 'Nenhum posto aqui'}
          acao={
            temFiltro ? (
              <Link href={link(f.atalho ?? '')} className={estiloBotao('secundario')}>
                Limpar filtros
              </Link>
            ) : r.postos.length === 0 && podeEditar ? (
              <LinkBotao href="/orcamento/importar">Importar a planilha da folha</LinkBotao>
            ) : undefined
          }
        >
          {atalho.alerta && !temFiltro ? 'Todos os postos ativos têm rateio somando 100%.' : undefined}
        </EstadoVazio>
      ) : (
        <div className={tabela.moldura}>
          <table className={tabela.tabela}>
            <caption className="sr-only">{atalho.rotulo}</caption>
            <thead className={tabela.cabeca}>
              <tr>
                <th scope="col" className={tabela.th}>Colaborador</th>
                <th scope="col" className={tabela.th}>Cargo</th>
                <th scope="col" className={`${tabela.th} hidden lg:table-cell`}>Início</th>
                <th scope="col" className={`${tabela.th} text-right`}>Custo mensal</th>
                <th scope="col" className={`${tabela.th} hidden text-right sm:table-cell`}>No ano</th>
                <th scope="col" className={tabela.th}>Rateio</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((x) => (
                <tr key={x.id} className={`${tabela.linha} relative`}>
                  <td className={tabela.td}>
                    <Link href={`/orcamento/postos/${x.id}`} className="font-semibold text-destaque after:absolute after:inset-0 hover:underline">
                      {x.colaborador ?? 'Vaga prevista'}
                    </Link>
                    <span className="block text-xs text-texto-suave">
                      {x.ficha ? `Ficha ${x.ficha}` : `A partir de ${data(x.inicio)}`}
                      {x.desligamento && ` · desligado em ${data(x.desligamento)}`}
                    </span>
                  </td>
                  <td className={tabela.td}>
                    {x.cargo}
                    {x.nivel && <span className="block text-xs text-texto-suave">Nível {x.nivel}</span>}
                  </td>
                  <td className={`${tabela.td} hidden tabular-nums lg:table-cell`}>{data(x.inicio)}</td>
                  <td className={`${tabela.td} ${tabela.numero}`}>{reais(x.custoMensal)}</td>
                  <td className={`${tabela.td} ${tabela.numero} hidden text-texto-suave sm:table-cell`}>{reais(x.custoAnual)}</td>
                  <td className={tabela.td}>
                    {x.situacaoRateio === 'sem_rateio' ? (
                      <Etiqueta tipo="atencao">Sem rateio</Etiqueta>
                    ) : x.situacaoRateio === 'fora_de_100' ? (
                      <Etiqueta tipo="erro">Diferente de 100%</Etiqueta>
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
          <p className="flex flex-wrap justify-between gap-2 border-t border-borda px-4 py-3 text-sm">
            <span className="text-texto-suave">
              {lista.length} {lista.length === 1 ? 'posto' : 'postos'}
            </span>
            <span className="font-semibold tabular-nums">Custo no ano: {reais(total)}</span>
          </p>
        </div>
      )}
    </div>
  );
}
