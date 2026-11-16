import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { formatarIndicador, situacaoDe, TEXTO_DA_SITUACAO, ultimoEAnterior, type IndicadorCalculado } from '@/capacidades/indicadores';
import { anoDoPainel, painelDeIndicadores, PERMISSAO_INDICADORES, type BlocoDoPainel } from '@/plataforma/indicadores';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { LinkBotao } from '@/ui/botao';
import { BarrasAgrupadas, Linhas } from '@/ui/graficos';
import { NumeroQueConta } from '@/ui/numero-que-conta';
import { CabecalhoPagina, EstadoVazio, Secao } from '@/ui/pagina';
import { SeletorAno } from '@/ui/seletor-ano';
import { TabelaDados } from '@/ui/tabela-dados';

export const metadata: Metadata = { title: 'Indicadores' };

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const nomeMes = (m: string) => `${MESES[Number(m.slice(5)) - 1]}/${m.slice(2, 4)}`;
const achar = (b: BlocoDoPainel, id: string): IndicadorCalculado | undefined => b.indicadores.find((i) => i.definicao.id === id);

/** Número de destaque com a situação escrita e a comparação com o período anterior. */
function Destaque({ rotulo, ind, valor, texto, comparar = true }: { rotulo: string; ind: IndicadorCalculado; valor?: number | null; texto?: string; comparar?: boolean }) {
  const { atual, anterior } = ultimoEAnterior(ind.pontos);
  const v = valor !== undefined ? valor : (atual?.valor ?? null);
  const f = ind.definicao.formato;
  const ref = atual ? (periodo: string) => (ind.definicao.periodicidade === 'mes' ? nomeMes(periodo) : periodo) : () => '';
  return (
    <div className="rounded-cartao border border-borda bg-superficie px-5 py-4">
      <dt className="text-sm text-texto-suave">{rotulo}</dt>
      <dd className="mt-0.5 text-2xl font-bold leading-tight tabular-nums">
        <NumeroQueConta texto={texto ?? formatarIndicador(f, v)} chave={`indicador:${ind.definicao.id}`} />
      </dd>
      <dd className="mt-1 text-sm text-texto-suave">
        {texto === undefined && atual ? `Em ${ref(atual.periodo)}${atual.base ? ` (${atual.base})` : ''} · ` : ''}
        {TEXTO_DA_SITUACAO[situacaoDe(ind.definicao, v)]}
        {comparar && texto === undefined && anterior ? ` · antes (${ref(anterior.periodo)}): ${formatarIndicador(f, anterior.valor)}` : ''}
      </dd>
    </div>
  );
}

function AvisoDoBloco({ b }: { b: BlocoDoPainel }) {
  if (b.estado === 'sem_acesso') return <Aviso tipo="info" titulo={`Sem acesso a este app`}>Você não tem permissão para ver os indicadores de {b.nome}. Peça à administração se precisar.</Aviso>;
  return <Aviso tipo="atencao" titulo={`Não foi possível ler: ${b.nome}`}>Os outros apps continuam abaixo. Tente de novo em instantes.</Aviso>;
}

function TabelaDaSerie({ legenda, itens }: { legenda: string; itens: IndicadorCalculado[] }) {
  const periodos = itens[0]?.pontos.map((p) => p.periodo) ?? [];
  const mensal = itens[0]?.definicao.periodicidade === 'mes';
  return (
    <TabelaDados
      legenda={legenda}
      colunas={[{ chave: 'periodo', rotulo: mensal ? 'Mês' : 'Exercício' }, ...itens.map((i) => ({ chave: i.definicao.id, rotulo: i.definicao.nome }))]}
      linhas={periodos.map((per, idx) => ({
        id: per,
        valores: {
          periodo: mensal ? `${nomeMes(per)}${itens[0].pontos[idx].parcial ? ' (até hoje)' : ''}` : per,
          ...Object.fromEntries(
            itens.map((i) => {
              const pt = i.pontos[idx];
              return [i.definicao.id, `${formatarIndicador(i.definicao.formato, pt.valor)}${pt.base ? ` (${pt.base})` : ''}`];
            }),
          ),
        },
      }))}
    />
  );
}

/** Pontos que têm valor em todas as séries (um mês sem dado não é 0; a tabela mostra todos). */
function comTodos(itens: IndicadorCalculado[]) {
  const n = itens[0]?.pontos.length ?? 0;
  return Array.from({ length: n }, (_, i) => i).filter((i) => itens.every((it) => it.pontos[i].valor !== null));
}

export default async function PainelDeIndicadores({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const sp = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (usuario.estruturaPendente) redirect('/admin/estrutura');
  const trilha = [{ rotulo: 'Início', href: '/' }, { rotulo: 'Indicadores' }];
  if (!usuario.autorizador.temPermissao(PERMISSAO_INDICADORES)) {
    return (
      <div className="space-y-6">
        <CabecalhoPagina trilha={trilha} titulo="Indicadores da instituição" />
        <EstadoVazio titulo="Este painel é da Diretoria.">Se você precisa dele, peça à administração da plataforma. Os indicadores de cada app continuam no próprio app.</EstadoVazio>
      </div>
    );
  }

  const { planilhas } = await obterAplicacao();
  const agora = new Date();
  const ano = anoDoPainel(sp.ano, agora);
  const atual = anoDoPainel(undefined, agora);
  const blocos = await painelDeIndicadores(planilhas, usuario.autorizador, { ano, agora });
  const orc = blocos.find((b) => b.id === 'orcamento')!;
  const req = blocos.find((b) => b.id === 'requisicoes')!;
  const com = blocos.find((b) => b.id === 'comunicacao')!;
  const aprovadas = achar(req, 'requisicoes_aprovacao_no_prazo');
  const atendidas = achar(req, 'requisicoes_atendimento_no_prazo');
  const volume = achar(com, 'comunicacao_volume');
  const resultado = achar(orc, 'resultado_previsto');
  const totalVolume = volume ? volume.pontos.reduce((s, p) => s + (p.valor ?? 0), 0) : 0;
  const algumDado = blocos.some((b) => b.indicadores.some((i) => i.pontos.some((p) => p.valor !== null)));
  const hrefAno = (a: number) => `/indicadores?ano=${a}`;

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={trilha}
        titulo="Indicadores da instituição"
        descricao="Os números dos apps num lugar só, mês a mês. São os mesmos que cada app mostra: aqui você só os junta para acompanhar a evolução."
        acoes={<SeletorAno anos={[atual - 2, atual - 1, atual]} atual={ano} href={hrefAno} />}
      />

      {!algumDado && blocos.every((b) => b.estado === 'ok') && (
        <EstadoVazio titulo={`Sem dados em ${ano}`} acao={ano !== atual ? <LinkBotao href={hrefAno(atual)} variante="secundario">Ver {atual}</LinkBotao> : undefined}>
          Quando os apps tiverem movimento neste ano, os números aparecem aqui.
        </EstadoVazio>
      )}

      <dl className="grid gap-3 md:grid-cols-3" aria-label="Resumo">
        {aprovadas && <Destaque rotulo="Requisições aprovadas no prazo" ind={aprovadas} />}
        {volume && <Destaque rotulo={`Pedidos de comunicação em ${ano} (até hoje)`} ind={volume} valor={totalVolume} texto={String(totalVolume)} comparar={false} />}
        {resultado && <Destaque rotulo="Resultado previsto do último exercício" ind={resultado} />}
      </dl>
      <p className="text-sm text-texto-suave">O mês em andamento aparece marcado como &quot;até hoje&quot; e fica fora da comparação com o mês anterior.</p>

      <Secao
        titulo={req.indicadores.length ? tituloRequisicoes(aprovadas, atendidas) : 'Requisições'}
        descricao="Estamos aprovando e atendendo dentro do prazo?"
        id="ind-requisicoes"
        acoes={<LinkBotao href={req.rota} variante="secundario">Abrir Requisições</LinkBotao>}
      >
        {req.estado !== 'ok' ? (
          <AvisoDoBloco b={req} />
        ) : (
          <div className="space-y-4">
            {(() => {
              const idx = comTodos(req.indicadores);
              return idx.length >= 2 ? (
                <Linhas
                  descricao={`Percentual de requisições aprovadas e atendidas no prazo, por mês, em ${ano}`}
                  formato="pct"
                  minimo={0}
                  maximo={100}
                  categorias={idx.map((i) => nomeMes(req.indicadores[0].pontos[i].periodo) + (req.indicadores[0].pontos[i].parcial ? ' (até hoje)' : ''))}
                  series={req.indicadores.map((it, n) => ({ nome: it.definicao.nome, valores: idx.map((i) => it.pontos[i].valor ?? 0), cor: n + 1 }))}
                />
              ) : (
                <EstadoVazio titulo="Sem requisições decididas e concluídas nos mesmos meses">Com pelo menos dois meses de movimento, o gráfico aparece. A tabela abaixo mostra todos os meses.</EstadoVazio>
              );
            })()}
            <p className="text-sm text-texto-suave">Meses sem decisão ou sem conclusão ficam fora do gráfico; a tabela mostra todos.</p>
            <TabelaDaSerie legenda={`Requisições no prazo, por mês, em ${ano}`} itens={req.indicadores} />
          </div>
        )}
      </Secao>

      <Secao
        titulo="Comunicação"
        descricao="Quanto pedimos e quanto demoramos?"
        id="ind-comunicacao"
        acoes={<LinkBotao href={com.rota} variante="secundario">Abrir Comunicação</LinkBotao>}
      >
        {com.estado !== 'ok' ? (
          <AvisoDoBloco b={com} />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-6 lg:grid-cols-2">
              {volume && (
                <Linhas
                  descricao={`Pedidos de comunicação enviados por mês, em ${ano}`}
                  formato="numero"
                  categorias={volume.pontos.map((p, i) => ({ p, i })).filter((x) => x.p.valor !== null).map((x) => nomeMes(x.p.periodo) + (x.p.parcial ? ' (até hoje)' : ''))}
                  series={[{ nome: 'Pedidos', valores: volume.pontos.filter((p) => p.valor !== null).map((p) => p.valor ?? 0), cor: 'destaque' }]}
                />
              )}
              <dl className="grid content-start gap-3 sm:grid-cols-2">
                {com.indicadores
                  .filter((i) => ['comunicacao_tempo_revisao', 'comunicacao_tempo_aprovacao', 'comunicacao_tempo_publicacao', 'comunicacao_publicados_com_atraso'].includes(i.definicao.id))
                  .map((i) => (
                    <Destaque key={i.definicao.id} rotulo={i.definicao.nome} ind={i} />
                  ))}
              </dl>
            </div>
            <TabelaDaSerie legenda={`Comunicação, por mês, em ${ano}`} itens={com.indicadores} />
          </div>
        )}
      </Secao>

      <Secao
        titulo="Orçamento"
        descricao="A receita sustenta a folha?"
        id="ind-orcamento"
        acoes={<LinkBotao href={orc.rota} variante="secundario">Abrir Orçamento</LinkBotao>}
      >
        {orc.estado !== 'ok' ? (
          <AvisoDoBloco b={orc} />
        ) : orc.indicadores.length === 0 || orc.indicadores[0].pontos.length === 0 ? (
          <EstadoVazio titulo="Nenhum exercício cadastrado">Quando houver um exercício no Orçamento, os percentuais aparecem aqui.</EstadoVazio>
        ) : (
          <div className="space-y-4">
            <BarrasAgrupadas
              descricao="Folha sobre a receita, dependência de recursos públicos e recursos livres, em percentual da receita prevista de cada exercício"
              formato="pct"
              categorias={orc.indicadores[0].pontos.map((p) => p.periodo)}
              series={orc.indicadores
                .filter((i) => i.definicao.formato === 'pct')
                .map((i, n) => ({ nome: i.definicao.nome, valores: i.pontos.map((p) => p.valor ?? 0), cor: n + 1 }))}
            />
            <ul className="space-y-1 text-sm text-texto-suave">
              {orc.indicadores.filter((i) => i.definicao.formato === 'pct').map((i) => (
                <li key={i.definicao.id}><strong className="text-texto">{i.definicao.nome}:</strong> {i.definicao.explicacao}</li>
              ))}
            </ul>
            <TabelaDaSerie legenda="Orçamento, por exercício" itens={orc.indicadores} />
            <p className="text-sm text-texto-suave">Valores previstos para cada exercício, não realizados. Exercício sem receita prevista aparece como 0% no gráfico e como &quot;Sem dados&quot; na tabela.</p>
          </div>
        )}
      </Secao>
    </div>
  );
}

/** Título em conclusão para Requisições, a partir do último mês fechado. */
function tituloRequisicoes(aprovadas?: IndicadorCalculado, atendidas?: IndicadorCalculado): string {
  const a = atendidas ? ultimoEAnterior(atendidas.pontos) : null;
  if (!a?.atual) return aprovadas && ultimoEAnterior(aprovadas.pontos).atual ? 'Requisições' : 'Requisições: ainda sem dados no ano';
  const mes = nomeMes(a.atual.periodo);
  if (!a.anterior || a.atual.valor === a.anterior.valor) return `Atendimento no prazo ficou estável em ${mes}`;
  return `Atendimento no prazo ${(a.atual.valor ?? 0) > (a.anterior.valor ?? 0) ? 'subiu' : 'caiu'} em ${mes}`;
}
