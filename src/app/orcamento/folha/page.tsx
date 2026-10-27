import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listarPostos, type LinhaPosto } from '@/modulos/orcamento/aplicacao/folha';
import { data, MESES, percentual, reais } from '@/modulos/orcamento/telas/formato';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { estiloBotao, LinkBotao } from '@/ui/botao';
import { Campo, estiloEntrada } from '@/ui/campo';
import { IconeMais } from '@/ui/icones';
import { CabecalhoPagina, EstadoVazio, Etiqueta } from '@/ui/pagina';

export const metadata: Metadata = { title: 'Folha de Pagamento' };

type Filtros = { busca?: string; cargo?: string; area?: string; centro?: string; atalho?: string; mes?: string; vista?: string };

const ATALHOS: { valor: string; rotulo: string; filtro: (x: LinhaPosto) => boolean; alerta?: boolean }[] = [
  { valor: '', rotulo: 'Ativos', filtro: (x) => !x.desligamento },
  { valor: 'sem_rateio', rotulo: 'Sem lotação', filtro: (x) => !x.desligamento && x.situacaoRateio === 'sem_rateio', alerta: true },
  { valor: 'fora_de_100', rotulo: 'Lotação diferente de 100%', filtro: (x) => !x.desligamento && x.situacaoRateio === 'fora_de_100', alerta: true },
  { valor: 'vagas', rotulo: 'Vagas previstas', filtro: (x) => !x.desligamento && !x.ficha },
  { valor: 'desligados', rotulo: 'Desligados', filtro: (x) => Boolean(x.desligamento) },
];

type Tipo = 'texto' | 'reais' | 'numero' | 'data' | 'percentual';
interface Coluna {
  titulo: string;
  tipo: Tipo;
  valor: (x: LinhaPosto, servicos: Map<string, string>) => string | number | null;
  /** Na planilha era fórmula: aqui é calculado pelo app. */
  calculado?: boolean;
  /** Aparece também na vista resumida. */
  resumida?: boolean;
  somar?: boolean;
}

/** As colunas da aba Estudo, na mesma ordem. */
const COLUNAS: Coluna[] = [
  { titulo: 'Admissão', tipo: 'data', valor: (x) => x.inicio, resumida: true },
  { titulo: 'Cargo', tipo: 'texto', valor: (x) => x.cargo, resumida: true },
  { titulo: 'Departamento', tipo: 'texto', valor: (x) => x.departamento },
  { titulo: 'Lotação', tipo: 'texto', valor: (x, s) => x.centros.map((c) => s.get(c) ?? c).join(', ') || null, resumida: true },
  { titulo: 'Carga horária', tipo: 'numero', valor: (x) => x.cargaHoraria },
  { titulo: 'Valor hora', tipo: 'reais', valor: (x) => x.calculo.valorHora, calculado: true },
  { titulo: 'Salário atual', tipo: 'reais', valor: (x) => x.valores.salario_atual, somar: true },
  { titulo: 'Reajuste', tipo: 'percentual', valor: (x) => x.valores.reajuste },
  { titulo: 'Valor hora base', tipo: 'reais', valor: (x) => x.calculo.valorHoraBase, calculado: true },
  { titulo: 'Salário base', tipo: 'reais', valor: (x) => x.calculo.salarioBase, calculado: true, resumida: true, somar: true },
  { titulo: 'Adicional salarial', tipo: 'reais', valor: (x) => x.valores.adicional_salarial, somar: true },
  { titulo: 'Hora atividade', tipo: 'reais', valor: (x) => x.calculo.horaAtividade, calculado: true, somar: true },
  { titulo: 'Ajuda de custo', tipo: 'reais', valor: (x) => x.valores.ajuda_custo, somar: true },
  { titulo: 'Bolsa estágio', tipo: 'reais', valor: (x) => x.valores.bolsa_estagio, somar: true },
  { titulo: 'Insalubridade', tipo: 'reais', valor: (x) => x.valores.insalubridade, somar: true },
  { titulo: 'Periculosidade', tipo: 'reais', valor: (x) => x.valores.periculosidade, somar: true },
  { titulo: 'G. Função', tipo: 'reais', valor: (x) => x.valores.gratificacao_funcao, somar: true },
  { titulo: 'Plano de saúde', tipo: 'reais', valor: (x) => x.valores.plano_saude, somar: true },
  { titulo: 'Bolsa estudo', tipo: 'reais', valor: (x) => x.valores.bolsa_estudo, somar: true },
  { titulo: 'Locomoção', tipo: 'reais', valor: (x) => x.valores.locomocao, somar: true },
  { titulo: 'Alimentação', tipo: 'reais', valor: (x) => x.valores.alimentacao, somar: true },
  { titulo: 'Férias', tipo: 'reais', valor: (x) => x.valores.ferias, somar: true },
  { titulo: '1/3 férias', tipo: 'reais', valor: (x) => x.calculo.tercoFerias, calculado: true, somar: true },
  { titulo: 'Abono', tipo: 'reais', valor: (x) => x.valores.abono, somar: true },
  { titulo: 'Indenizações', tipo: 'reais', valor: (x) => x.valores.indenizacoes, somar: true },
  { titulo: '13º salário', tipo: 'reais', valor: (x) => x.calculo.decimoTerceiro, calculado: true, somar: true },
  { titulo: 'FGTS', tipo: 'reais', valor: (x) => x.calculo.fgts, calculado: true, somar: true },
  { titulo: 'Total', tipo: 'reais', valor: (x) => x.calculo.total, calculado: true, resumida: true, somar: true },
];

function formatar(v: string | number | null, tipo: Tipo) {
  if (v === null || v === '' || v === 0) return tipo === 'texto' || tipo === 'data' ? '—' : '';
  if (tipo === 'reais') return reais(Number(v));
  if (tipo === 'percentual') return percentual(Number(v));
  if (tipo === 'data') return data(String(v));
  return String(v);
}

export default async function FolhaDePagamento({ searchParams }: { searchParams: Promise<Filtros> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissao('orcamento.folha.ver_individual')) redirect('/orcamento');
  const app = await obterAplicacao();
  const f = await searchParams;
  const r = await listarPostos(app.planilhas, usuario.autorizador, Number(f.mes) || undefined);
  const busca = (f.busca ?? '').trim().toLowerCase();
  const atalho = ATALHOS.find((a) => a.valor === (f.atalho ?? '')) ?? ATALHOS[0];
  const temFiltro = Boolean(busca || f.cargo || f.area || f.centro);
  const resumida = f.vista === 'resumida';
  const colunas = COLUNAS.filter((c) => !resumida || c.resumida);
  const servicos = new Map(r.centros.map((c) => [c.codigo, c.nome]));

  const lista = r.postos.filter((x) => {
    if (!atalho.filtro(x)) return false;
    if (busca && !`${x.colaborador ?? ''} ${x.ficha ?? ''}`.toLowerCase().includes(busca)) return false;
    if (f.cargo && x.cargo !== f.cargo) return false;
    if (f.area && !x.areas.includes(f.area)) return false;
    if (f.centro && !x.centros.includes(f.centro)) return false;
    return true;
  });
  const podeEditar = usuario.autorizador.temPermissao('orcamento.folha.editar');
  const link = (mudancas: Partial<Filtros>) => {
    const q = new URLSearchParams(Object.entries({ ...f, ...mudancas }).filter(([, v]) => v) as [string, string][]);
    return `/orcamento/folha${q.size ? `?${q}` : ''}`;
  };
  const somaColuna = (c: Coluna) => lista.reduce((s, x) => s + Number(c.valor(x, servicos) ?? 0), 0);

  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento' }, { rotulo: 'Folha de Pagamento' }]}
        titulo={`Folha de Pagamento ${r.ano}`}
        descricao="Todas as colunas da aba Estudo. As colunas em azul-claro são calculadas pelo app, como as fórmulas da planilha. São dados pessoais: cada consulta fica registrada."
        acoes={
          podeEditar ? (
            <LinkBotao href="/orcamento/folha/novo">
              <IconeMais tamanho={18} />
              Cadastrar
            </LinkBotao>
          ) : undefined
        }
      />

      <nav aria-label="Situação" className="-mx-1 mb-4 overflow-x-auto px-1">
        <ul className="flex min-w-max gap-1 border-b border-borda">
          {ATALHOS.map((a) => {
            const n = r.postos.filter(a.filtro).length;
            const atual = a.valor === atalho.valor;
            return (
              <li key={a.valor}>
                <Link
                  href={link({ atalho: a.valor })}
                  aria-current={atual ? 'true' : undefined}
                  className={`-mb-px flex items-center gap-2 border-b-[3px] px-3 py-2.5 text-sm ${
                    atual ? 'border-destaque font-semibold text-texto' : 'border-transparent text-texto-suave hover:text-texto'
                  }`}
                >
                  {a.rotulo}
                  <span className={`rounded-full px-2 text-xs font-semibold tabular-nums ${a.alerta && n > 0 ? 'bg-aviso-fundo text-aviso' : 'bg-superficie-2 text-texto-suave'}`}>
                    {n}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <form className="flex items-end gap-2">
          {Object.entries(f)
            .filter(([k, v]) => k !== 'mes' && v)
            .map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
          <Campo rotulo="Valores do mês">
            <select name="mes" defaultValue={r.mes} className={estiloEntrada}>
              {MESES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </Campo>
          <button className={estiloBotao('secundario')}>Ver</button>
        </form>
        <div className="flex rounded-lg border border-borda bg-superficie p-1 text-sm" role="group" aria-label="Colunas">
          <Link href={link({ vista: '' })} aria-current={!resumida ? 'true' : undefined} className={`rounded-md px-3 py-1.5 ${!resumida ? 'bg-destaque font-semibold text-sobre-destaque' : 'text-texto-suave hover:text-texto'}`}>
            Todas as colunas
          </Link>
          <Link href={link({ vista: 'resumida' })} aria-current={resumida ? 'true' : undefined} className={`rounded-md px-3 py-1.5 ${resumida ? 'bg-destaque font-semibold text-sobre-destaque' : 'text-texto-suave hover:text-texto'}`}>
            Resumida
          </Link>
        </div>
      </div>

      <details className="mb-4 rounded-xl border border-borda bg-superficie" open={temFiltro}>
        <summary className="cursor-pointer select-none px-5 py-3 font-semibold">
          Filtrar {temFiltro && <Etiqueta tipo="info">filtros ativos</Etiqueta>}
        </summary>
        <form className="grid gap-4 border-t border-borda p-5 sm:grid-cols-2 lg:grid-cols-4">
          {(['atalho', 'mes', 'vista'] as const).map((k) => f[k] && <input key={k} type="hidden" name={k} value={f[k]} />)}
          <Campo rotulo="Nome ou código">
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
          <Campo rotulo="Serviço (lotação)">
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
              <Link href={link({ busca: '', cargo: '', area: '', centro: '' })} className={estiloBotao('fantasma')}>
                Limpar
              </Link>
            )}
          </div>
        </form>
      </details>

      {lista.length === 0 ? (
        <EstadoVazio
          titulo={temFiltro ? 'Ninguém com esses filtros' : atalho.alerta ? 'Nada pendente' : 'Ninguém aqui'}
          acao={
            r.postos.length === 0 && podeEditar ? <LinkBotao href="/orcamento/importar">Importar a planilha da folha</LinkBotao> : undefined
          }
        >
          {atalho.alerta && !temFiltro ? 'Todos os funcionários ativos têm lotação somando 100%.' : undefined}
        </EstadoVazio>
      ) : (
        <div className="max-h-[75vh] overflow-auto rounded-xl border border-borda bg-superficie">
          <table className="w-max min-w-full border-separate border-spacing-0 text-left text-sm">
            <caption className="sr-only">
              Folha de pagamento, valores de {MESES[r.mes - 1]}
            </caption>
            <thead className="sticky top-0 z-20">
              <tr className="bg-superficie-2 text-texto-suave">
                <th scope="col" className="sticky left-0 z-30 border-b border-borda bg-superficie-2 px-3 py-2.5 font-semibold">Código</th>
                <th scope="col" className="sticky left-[4.5rem] z-30 min-w-60 border-b border-r border-borda bg-superficie-2 px-3 py-2.5 font-semibold">Nome</th>
                {colunas.map((c) => (
                  <th
                    key={c.titulo}
                    scope="col"
                    title={c.calculado ? 'Calculado pelo app' : undefined}
                    className={`border-b border-borda px-3 py-2.5 font-semibold whitespace-nowrap ${c.tipo === 'texto' || c.tipo === 'data' ? '' : 'text-right'} ${c.calculado ? 'bg-destaque-suave text-destaque' : ''}`}
                  >
                    {c.titulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((x) => (
                <tr key={x.id} className="group">
                  <td className="sticky left-0 z-10 w-[4.5rem] border-b border-borda bg-superficie px-3 py-2 tabular-nums group-hover:bg-superficie-2">
                    {x.ficha ?? <Etiqueta tipo="info">vaga</Etiqueta>}
                  </td>
                  <td className="sticky left-[4.5rem] z-10 border-b border-r border-borda bg-superficie px-3 py-2 group-hover:bg-superficie-2">
                    <Link href={`/orcamento/folha/${x.id}`} className="font-semibold text-destaque hover:underline">
                      {x.colaborador ?? 'Vaga prevista'}
                    </Link>
                    {x.situacaoRateio !== 'ok' && (
                      <span className="ml-2">
                        <Etiqueta tipo={x.situacaoRateio === 'sem_rateio' ? 'atencao' : 'erro'}>
                          {x.situacaoRateio === 'sem_rateio' ? 'sem lotação' : 'lotação ≠ 100%'}
                        </Etiqueta>
                      </span>
                    )}
                    {x.desligamento && <span className="block text-xs text-texto-suave">Desligado em {data(x.desligamento)}</span>}
                  </td>
                  {colunas.map((c) => (
                    <td
                      key={c.titulo}
                      className={`border-b border-borda px-3 py-2 whitespace-nowrap group-hover:bg-superficie-2 ${
                        c.tipo === 'texto' || c.tipo === 'data' ? '' : 'text-right tabular-nums'
                      } ${c.calculado ? 'bg-destaque-suave/40' : ''} ${c.titulo === 'Total' ? 'font-bold' : ''}`}
                    >
                      {formatar(c.valor(x, servicos), c.tipo)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 z-20">
              <tr className="bg-superficie-2 font-bold">
                <th scope="row" colSpan={2} className="sticky left-0 z-30 border-t-2 border-r border-borda-forte bg-superficie-2 px-3 py-2.5 text-left">
                  Total ({lista.length})
                </th>
                {colunas.map((c) => (
                  <td key={c.titulo} className="border-t-2 border-borda-forte px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
                    {c.somar ? reais(somaColuna(c)) : ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
