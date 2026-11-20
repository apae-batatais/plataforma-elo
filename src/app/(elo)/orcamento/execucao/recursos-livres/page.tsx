import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { lerRecursosLivres, type RecursosLivres } from '@/modulos/orcamento/aplicacao/execucao';
import { adiantamentoEmAtencao } from '@/modulos/orcamento/dominio/execucao';
import { Bloco, CartaoNumero, GraficoComLeitura, listaDeMeses, textoDoPeriodo } from '@/modulos/orcamento/telas/execucao-partes';
import { MESES, percentual, reais } from '@/modulos/orcamento/telas/formato';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { LinkBotao } from '@/ui/botao';
import { BarrasAgrupadas, BarrasHorizontais, Linhas } from '@/ui/graficos';
import { CabecalhoPagina, EstadoVazio, Etiqueta } from '@/ui/pagina';
import { SeletorAno } from '@/ui/seletor-ano';
import { TabelaDados, type ColunaDados, type LinhaDados } from '@/ui/tabela-dados';

export const metadata: Metadata = { title: 'Recursos livres' };

const nomeMes = (n: number) => MESES[n - 1].toLowerCase();

function Comparacao({ r, todos }: { r: RecursosLivres; todos: boolean }) {
  const c = r.comparacao!;
  const b = todos ? c.todos : c.semNaoRecorrentes;
  const v = todos ? c.variacaoDespesa.todos : c.variacaoDespesa.sem;
  const vr = c.variacaoReceita ? (todos ? c.variacaoReceita.todos : c.variacaoReceita.sem) : null;
  const sinal = (x: number | null) => (x === null ? 'sem base de comparação' : `${x > 0 ? '+' : ''}${x.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);
  return (
    <GraficoComLeitura
      titulo={`Despesa livre ${v === null ? 'sem base para comparar' : v > 0 ? 'subiu' : v < 0 ? 'caiu' : 'ficou igual'} contra ${c.anoAnterior}${v ? ` (${sinal(v)})` : ''}`}
      descricao={`Só os meses informados nos dois anos: ${c.mesesComparados.map(nomeMes).join(', ')}.${c.parcial ? ` ${c.anoAtual} é parcial.` : ''}`}
      leitura={
        <>
          <p>Despesa livre: <strong>{sinal(v)}</strong></p>
          {vr !== null || c.variacaoReceita ? <p>Receita livre: <strong>{sinal(vr)}</strong></p> : null}
          {c.pesoAtual !== null && c.pesoAnterior !== null && (
            <p>
              A despesa livre pesa {percentual(c.pesoAtual)} da receita livre (era {percentual(c.pesoAnterior)}):{' '}
              {Math.round((c.pesoAtual - c.pesoAnterior) * 10) / 10} pontos de diferença.
            </p>
          )}
        </>
      }
    >
      <BarrasAgrupadas
        categorias={[String(c.anoAnterior), String(c.anoAtual)]}
        formato="moeda"
        rotuloCategoria="Ano"
        descricao={`Despesa e receita livres de ${c.anoAnterior} e ${c.anoAtual} nos meses informados nos dois anos`}
        series={[
          { nome: 'Despesa livre', valores: [b.despesaAnterior, b.despesaAtual], cor: 2 },
          ...(b.receitaAtual !== null ? [{ nome: 'Receita livre', valores: [b.receitaAnterior ?? 0, b.receitaAtual], cor: 1 as const }] : []),
        ]}
      />
    </GraficoComLeitura>
  );
}

export default async function RecursosLivresPagina({ searchParams }: { searchParams: Promise<{ ano?: string; nr?: string }> }) {
  const sp = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const app = await obterAplicacao();
  let r: RecursosLivres;
  try {
    r = await lerRecursosLivres(app.planilhas, usuario.autorizador, { ano: Number(sp.ano) || undefined });
  } catch (erro) {
    if (erro instanceof ErroPermissao) redirect('/orcamento/execucao/painel');
    throw erro;
  }
  const semNr = sp.nr !== '0';
  const trilha = [{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento' }, { rotulo: 'Execução' }, { rotulo: 'Recursos livres' }];
  const cabecalho = (
    <CabecalhoPagina
      trilha={trilha}
      titulo={`Recursos livres de ${r.ano}`}
      descricao={`${textoDoPeriodo(r.ano, r.periodo)}. Quanto recurso livre cada serviço consome, o que falta ressarcir dos termos e como estamos contra o ano passado.`}
      acoes={
        <>
          <SeletorAno anos={r.anos} atual={r.ano} href={(a) => `/orcamento/execucao/recursos-livres?ano=${a}`} />
          <LinkBotao href={`/orcamento/execucao/painel?ano=${r.ano}`} variante="secundario">
            Painel de execução
          </LinkBotao>
        </>
      }
    />
  );
  if (!r.temRealizado) {
    return (
      <div>
        {cabecalho}
        <EstadoVazio titulo={`Ainda não há realizado em ${r.ano}`}>O Financeiro informa mês a mês em Informar realizado.</EstadoVazio>
      </div>
    );
  }

  const comScopo = r.receitaLivre !== null;
  const informados = r.porMes.filter((m) => m.informado);
  const colunas: ColunaDados[] = [
    { chave: 'servico', rotulo: 'Serviço' },
    ...r.naturezas.map((n) => ({ chave: n.codigo, rotulo: n.rotulo, tipo: 'moeda' as const, somar: true })),
    { chave: 'total', rotulo: 'Total', tipo: 'moeda', somar: true, calculada: true },
    { chave: 'peso', rotulo: 'Peso no total (%)', tipo: 'numero', calculada: true },
  ];
  const linhas: LinhaDados[] = r.porServico.map((s) => ({
    id: s.servico,
    valores: { servico: s.servico, ...Object.fromEntries(r.naturezas.map((n) => [n.codigo, s.naturezas[n.codigo] ?? 0])), total: s.total, peso: s.peso },
  }));
  const ad = r.adiantamentos;
  const dominante = r.porServico[0];

  return (
    <div className="space-y-6">
      {cabecalho}
      {!comScopo && <Aviso tipo="info">Você vê só a despesa livre dos serviços do seu escopo. Receitas e adiantamentos não aparecem.</Aviso>}
      {r.periodo.semDado.length > 0 && (
        <Aviso tipo="atencao" titulo="Mês sem realizado">
          Sem dado em {listaDeMeses(r.periodo.semDado)}: esses meses ficam fora das contas.
        </Aviso>
      )}

      <dl className={`grid gap-3 ${comScopo ? 'sm:grid-cols-3' : ''}`}>
        {comScopo && <CartaoNumero rotulo="Receita livre" valor={r.receitaLivre} chave="rl:receita">Entrou de fonte de uso livre no período</CartaoNumero>}
        <CartaoNumero rotulo="Despesa livre" valor={r.despesaLivre} chave="rl:despesa">Gasta com fonte de uso livre no período</CartaoNumero>
        {comScopo && (
          <CartaoNumero rotulo="Resultado do recurso livre" valor={r.resultado} chave="rl:resultado" alerta={(r.resultado ?? 0) < 0 ? 'Déficit' : null}>
            Receita livre menos despesa livre
          </CartaoNumero>
        )}
      </dl>

      {ad && (
        <p id="adiantamentos-resumo" className="rounded-cartao border border-borda bg-superficie px-5 py-3">
          {ad.termosEmAberto === 0
            ? 'Nenhum adiantamento em aberto.'
            : `Falta ressarcir ${reais(ad.totalEmAberto)} em ${ad.termosEmAberto} ${ad.termosEmAberto === 1 ? 'termo' : 'termos'}${ad.maisAntigoDias !== null ? `; o mais antigo está há ${ad.maisAntigoDias} dias` : ''}.`}
        </p>
      )}

      <GraficoComLeitura
        titulo="Receita livre e despesa livre, mês a mês"
        descricao="Só os meses com realizado informado; os sem dado ficam de fora, nunca viram zero."
        leitura={
          <>
            <p>{informados.length} de 12 meses informados.</p>
            <p>Abra “Ver os números” para ver cada mês.</p>
          </>
        }
      >
        <Linhas
          categorias={informados.map((m) => m.rotulo)}
          formato="moeda"
          descricao={`Receita livre e despesa livre de cada mês de ${r.ano}`}
          series={[
            ...(comScopo ? [{ nome: 'Receita livre', valores: informados.map((m) => m.receita ?? 0), cor: 1 as const }] : []),
            { nome: 'Despesa livre', valores: informados.map((m) => m.despesa ?? 0), cor: 2 as const },
          ]}
        />
      </GraficoComLeitura>

      {r.porServico.length > 0 && (
        <GraficoComLeitura
          titulo={dominante.peso === null ? `${dominante.servico} é o maior consumidor do recurso livre` : `${dominante.servico} consome ${percentual(dominante.peso)} do recurso livre`}
          descricao="Despesa livre de cada serviço, maior primeiro."
          leitura={
            <>
              <p className="text-2xl font-bold tabular-nums">{reais(dominante.total)}</p>
              <p>{dominante.servico}{dominante.naturezaDominante ? `, sobretudo com ${dominante.naturezaDominante.toLowerCase()}` : ''}.</p>
            </>
          }
        >
          <BarrasHorizontais
            rotuloCategoria="Serviço"
            formato="moeda"
            descricao="Despesa livre de cada serviço no período"
            categorias={r.porServico.map((s) => s.servico)}
            notas={r.porServico.map((s) => (s.naturezaDominante ? `Mais: ${s.naturezaDominante}` : null))}
            series={[{ nome: 'Despesa livre', valores: r.porServico.map((s) => s.total), cor: 1 }]}
          />
        </GraficoComLeitura>
      )}

      <Bloco titulo="Despesa livre por serviço e natureza" descricao="Despesa sem serviço entra em “Comum”.">
        <TabelaDados colunas={colunas} linhas={linhas} legenda="Despesa livre por serviço e natureza" vazio="Nenhuma despesa livre no período." />
      </Bloco>

      {r.comparacao && (
        <section aria-label={`Comparação com ${r.comparacao.anoAnterior}`} className="space-y-3">
          <h2 className="text-lg font-bold">Comparação com {r.comparacao.anoAnterior}</h2>
          {r.comparacao.semAnoAnterior ? (
            <EstadoVazio titulo={`Sem realizado de ${r.comparacao.anoAnterior} no Elo`}>Quando o ano anterior for informado, a comparação aparece aqui.</EstadoVazio>
          ) : r.comparacao.mesesComparados.length === 0 ? (
            <EstadoVazio titulo="Nenhum mês informado nos dois anos">A comparação usa só os meses que têm realizado em {r.comparacao.anoAtual} e em {r.comparacao.anoAnterior}.</EstadoVazio>
          ) : (
            <>
              <nav aria-label="Não recorrentes" className="flex gap-2">
                {[{ rotulo: 'Sem não recorrentes', nr: '1' }, { rotulo: 'Com todos', nr: '0' }].map((o) => (
                  <a key={o.nr} href={`/orcamento/execucao/recursos-livres?ano=${r.ano}&nr=${o.nr}#comparacao`} aria-current={(o.nr === '1') === semNr ? 'page' : undefined}
                    className={`inline-flex min-h-11 items-center rounded-full border px-3 text-sm ${(o.nr === '1') === semNr ? 'border-destaque bg-superficie-2 font-bold' : 'border-borda text-texto-suave'}`}>
                    {o.rotulo}
                  </a>
                ))}
              </nav>
              <div id="comparacao" className="scroll-mt-20"><Comparacao r={r} todos={!semNr} /></div>
              {(r.comparacao.mesesFora.length > 0 || r.comparacao.naoRecorrentes.length > 0) && (
                <Aviso tipo="info" titulo="Fora da comparação">
                  {r.comparacao.mesesFora.length > 0 && <>Meses informados em só um dos anos: {r.comparacao.mesesFora.map(nomeMes).join(', ')}. </>}
                  {r.comparacao.naoRecorrentes.length > 0 && <>Não recorrentes: {r.comparacao.naoRecorrentes.map((n) => `${n.descricao} (${reais(n.valor)})`).join('; ')}.</>}
                </Aviso>
              )}
            </>
          )}
        </section>
      )}

      {ad && (
        <section id="adiantamentos" aria-label="Adiantamentos e ressarcimentos" className="scroll-mt-20 space-y-3">
          <h2 className="text-lg font-bold">Adiantamentos e ressarcimentos</h2>
          {ad.termos.length === 0 ? (
            <EstadoVazio titulo="Nenhum adiantamento em aberto.">Quando o recurso livre adiantar um termo, ele aparece aqui até ser ressarcido.</EstadoVazio>
          ) : (
            <TabelaDados
              legenda="Adiantado, ressarcido e em aberto por termo, somando todos os anos"
              colunas={[
                { chave: 'termo', rotulo: 'Termo' },
                { chave: 'adiantado', rotulo: 'Adiantado', tipo: 'moeda', somar: true },
                { chave: 'ressarcido', rotulo: 'Ressarcido', tipo: 'moeda', somar: true },
                { chave: 'aberto', rotulo: 'Em aberto', tipo: 'moeda', somar: true, calculada: true },
                { chave: 'dias', rotulo: 'Há quantos dias', tipo: 'numero' },
                { chave: 'situacao', rotulo: 'Situação' },
              ]}
              linhas={ad.termos.map((t) => ({
                id: t.termoId ?? 'sem-termo',
                valores: { termo: t.nome, adiantado: t.adiantado, ressarcido: t.ressarcido, aberto: t.emAberto, dias: t.dias, situacao: t.ressarcidoAMais ? 'Ressarcido a mais' : t.atencao ? 'Atenção' : 'Em dia' },
                celulas: {
                  situacao: t.ressarcidoAMais ? <Etiqueta tipo="info">Ressarcido a mais</Etiqueta> : t.emAberto <= 0 ? <Etiqueta tipo="sucesso">Em dia</Etiqueta> : adiantamentoEmAtencao(t.dias ?? 0) ? <Etiqueta tipo="atencao">Atenção</Etiqueta> : <Etiqueta tipo="sucesso">Em dia</Etiqueta>,
                },
              }))}
            />
          )}
        </section>
      )}
    </div>
  );
}
