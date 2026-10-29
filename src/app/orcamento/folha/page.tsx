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
import { TabelaDados } from '@/ui/tabela-dados';

export const metadata: Metadata = { title: 'Folha de Pagamento' };

type Filtros = { atalho?: string; mes?: string };

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
  const atalho = ATALHOS.find((a) => a.valor === (f.atalho ?? '')) ?? ATALHOS[0];
  const servicos = new Map(r.centros.map((c) => [c.codigo, c.nome]));

  const lista = r.postos.filter(atalho.filtro);
  const podeEditar = usuario.autorizador.temPermissao('orcamento.folha.editar');
  const link = (mudancas: Partial<Filtros>) => {
    const q = new URLSearchParams(Object.entries({ ...f, ...mudancas }).filter(([, v]) => v) as [string, string][]);
    return `/orcamento/folha${q.size ? `?${q}` : ''}`;
  };

  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento' }, { rotulo: 'Folha de Pagamento' }]}
        titulo={`Folha de Pagamento ${r.ano}`}
        descricao="Todas as colunas da aba Estudo, com filtro e classificação em cada coluna. As colunas destacadas são calculadas pelo app, como as fórmulas da planilha. São dados pessoais: cada consulta fica registrada."
        acoes={
          podeEditar ? (
            <LinkBotao href="/orcamento/folha/novo" className="!min-h-8 !px-3 !py-1 !text-sm">
              <IconeMais tamanho={16} />
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

      <form className="mb-4 flex items-end gap-2">
        {f.atalho && <input type="hidden" name="atalho" value={f.atalho} />}
        <Campo rotulo="Valores do mês">
          <select name="mes" defaultValue={r.mes} className={`${estiloEntrada} !min-h-9 !py-1.5`}>
            {MESES.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </Campo>
        <button className={estiloBotao('secundario', '!min-h-9')}>Ver</button>
      </form>

      {lista.length === 0 ? (
        <EstadoVazio
          titulo={atalho.alerta ? 'Nada pendente' : 'Ninguém aqui'}
          acao={r.postos.length === 0 && podeEditar ? <LinkBotao href="/orcamento/importar">Importar a planilha da folha</LinkBotao> : undefined}
        >
          {atalho.alerta ? 'Todos os funcionários ativos têm lotação somando 100%.' : undefined}
        </EstadoVazio>
      ) : (
        <TabelaDados
          grande
          legenda={`Folha de pagamento, valores de ${MESES[r.mes - 1]}`}
          totalRotulo="Total"
          colunas={[
            { chave: 'nome', rotulo: 'Nome' },
            { chave: 'codigo', rotulo: 'Código', tipo: 'numero' },
            ...COLUNAS.map((c) => ({
              chave: c.titulo,
              rotulo: c.titulo,
              tipo: c.tipo === 'reais' ? ('moeda' as const) : c.tipo === 'numero' || c.tipo === 'percentual' ? ('numero' as const) : ('texto' as const),
              somar: c.somar,
              calculada: c.calculado,
              secundaria: false,
            })),
          ]}
          linhas={lista.map((x) => ({
            id: x.id,
            valores: {
              nome: x.colaborador ?? 'Vaga prevista',
              codigo: x.ficha ? Number(x.ficha) || x.ficha : null,
              ...Object.fromEntries(COLUNAS.map((c) => [c.titulo, c.valor(x, servicos)])),
            },
            celulas: {
              nome: (
                <span className="inline-flex flex-col">
                  <Link href={`/orcamento/folha/${x.id}`} className="font-semibold text-destaque hover:underline">
                    {x.colaborador ?? 'Vaga prevista'}
                  </Link>
                  <span className="flex flex-wrap gap-1">
                    {!x.ficha && <Etiqueta tipo="info">vaga</Etiqueta>}
                    {x.situacaoRateio !== 'ok' && (
                      <Etiqueta tipo={x.situacaoRateio === 'sem_rateio' ? 'atencao' : 'erro'}>{x.situacaoRateio === 'sem_rateio' ? 'sem lotação' : 'lotação ≠ 100%'}</Etiqueta>
                    )}
                    {x.desligamento && <span className="text-xs text-texto-suave">Desligado em {data(x.desligamento)}</span>}
                  </span>
                </span>
              ),
              ...Object.fromEntries(
                COLUNAS.filter((c) => c.tipo !== 'reais').map((c) => [c.titulo, formatar(c.valor(x, servicos), c.tipo)]),
              ),
            },
          }))}
        />
      )}
    </div>
  );
}
