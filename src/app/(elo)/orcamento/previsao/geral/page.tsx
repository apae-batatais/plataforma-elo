import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { painelGeral, variacao, type ResumoDoAno } from '@/modulos/orcamento/aplicacao/painel-geral';
import { REFERENCIAS } from '@/modulos/orcamento/dominio/previsao';
import { MESES, reais } from '@/modulos/orcamento/telas/formato';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { LinkBotao } from '@/ui/botao';
import { Barras100, BarrasHorizontais, Indicadores, Linhas, ResultadoMensal } from '@/ui/graficos';
import { CabecalhoPagina, EstadoVazio, Etiqueta } from '@/ui/pagina';
import { SeletorAno } from '@/ui/seletor-ano';
import { TabelaDados } from '@/ui/tabela-dados';
import { outroValor, SeletorCedidos } from '@/modulos/orcamento/telas/seletor-cedidos';
import { AtalhosSecoes } from '@/ui/atalhos-secoes';
import { NumeroQueConta } from '@/ui/numero-que-conta';

export const metadata: Metadata = { title: 'Painel geral' };

const SECOES = [
  { id: 'indicadores', rotulo: 'Indicadores' },
  { id: 'ano-em-foco', rotulo: 'O ano em foco' },
  { id: 'comparar', rotulo: 'Comparar exercícios' },
  { id: 'receita', rotulo: 'Receita' },
  { id: 'resumo', rotulo: 'Resumo' },
];

const SITUACAO = { elaboracao: 'Em elaboração', aprovado: 'Aprovado', encerrado: 'Encerrado' } as const;

function Bloco({ titulo, descricao, children, className = '', tituloOculto = false }: { titulo: string; descricao?: string; children: ReactNode; className?: string; tituloOculto?: boolean }) {
  return (
    <section className={`rounded-cartao border border-borda bg-superficie p-5 ${className}`} aria-label={titulo}>
      <h3 className={tituloOculto ? 'sr-only' : 'font-bold'}>{titulo}</h3>
      {descricao && <p className="mb-4 mt-0.5 text-sm text-texto-suave">{descricao}</p>}
      {!descricao && <div className="mb-4" />}
      {children}
    </section>
  );
}

/** Seção do painel: título e âncora da faixa "Neste painel". */
function SecaoDoPainel({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`t-${id}`} tabIndex={-1} className="scroll-mt-32 space-y-4 outline-none lg:scroll-mt-20">
      <h2 id={`t-${id}`} className="text-lg font-bold">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

/** Variação em relação ao ano anterior: seta + percentual + "vs ano". */
function Variacao({ atual, anterior, anoAnterior, pontos }: { atual: number | null; anterior: number | null | undefined; anoAnterior?: number; pontos?: boolean }) {
  if (atual === null || anterior === null || anterior === undefined || !anoAnterior) return <span className="text-xs text-texto-suave">sem ano anterior</span>;
  const d = pontos ? Math.round((atual - anterior) * 10) / 10 : variacao(atual, anterior);
  if (d === null) return null;
  const seta = d > 0 ? '▲' : d < 0 ? '▼' : '■';
  return (
    <span className="text-xs text-texto-suave">
      <span aria-hidden="true">{seta}</span> {d > 0 ? '+' : ''}
      {d.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
      {pontos ? ' p.p.' : '%'} vs {anoAnterior}
    </span>
  );
}

export default async function PainelGeral({ searchParams }: { searchParams: Promise<{ ano?: string; cedidos?: string }> }) {
  const sp = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const app = await obterAplicacao();
  const incluir = sp.cedidos !== '0';
  const painel = await painelGeral(app.planilhas, usuario.autorizador, { incluirCedidos: incluir });
  const anos = painel.anos.slice(-4);

  if (anos.length === 0) {
    return (
      <div>
        <CabecalhoPagina trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento' }, { rotulo: 'Painel geral' }]} titulo="Painel geral" />
        <EstadoVazio titulo="Nenhum exercício aberto" acao={<LinkBotao href="/orcamento/previsao">Ir para a Previsão</LinkBotao>}>
          Abra o primeiro exercício na tela Previsão do ano. O painel compara os anos lado a lado.
        </EstadoVazio>
      </div>
    );
  }

  // Ano em foco (escolhido no topo) e o anterior a ele, para as variações.
  const posicao = Math.max(anos.findIndex((a) => a.ano === Number(sp.ano)), -1);
  const iFoco = posicao >= 0 ? posicao : anos.length - 1;
  const atual = anos[iFoco];
  const anterior: ResumoDoAno | undefined = anos[iFoco - 1];
  const anteriores = anos.slice(0, iFoco).reverse();
  const rotulos = anos.map((a) => String(a.ano));
  // Anos numa escala de um tom só: o mais recente é o mais forte; os anteriores, mais claros.
  const corDoAno = (i: number) => (['ano-3', 'ano-2', 'ano-1'] as const)[Math.min(anos.length - 1 - i, 2)];
  const meses = MESES.map((m) => m.slice(0, 3));

  const cartoes = [
    { rotulo: 'Receita prevista', valor: reais(atual.receita), var: <Variacao atual={atual.receita} anterior={anterior?.receita} anoAnterior={anterior?.ano} /> },
    { rotulo: 'Despesa prevista', valor: reais(atual.despesa), var: <Variacao atual={atual.despesa} anterior={anterior?.despesa} anoAnterior={anterior?.ano} /> },
    {
      rotulo: 'Resultado',
      valor: reais(atual.resultado),
      alerta: atual.resultado < 0 ? 'Déficit' : null,
      var: <Variacao atual={atual.resultado} anterior={anterior?.resultado} anoAnterior={anterior?.ano} />,
    },
  ];

  // Saldo acumulado no ano: mostra se algum mês fica "no vermelho" mesmo com resultado anual positivo.
  let saldo = 0;
  let menor = { valor: Infinity, mes: 0 };
  atual.receitaMensal.forEach((r, k) => {
    saldo += r - atual.despesaMensal[k];
    if (saldo < menor.valor) menor = { valor: saldo, mes: k };
  });
  const mesesComFalta = atual.receitaMensal.filter((r, k) => r < atual.despesaMensal[k]).length;

  const areas = painel.areas.slice(0, 10);
  const grupos = painel.grupos.slice(0, 8);
  const fontes = atual.porFonte;

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento' }, { rotulo: 'Painel geral' }]}
        titulo={
          <span className="flex flex-wrap items-center gap-3">
            Painel geral {atual.ano}
            <Etiqueta tipo={atual.situacao === 'elaboracao' ? 'info' : 'sucesso'}>{SITUACAO[atual.situacao]}</Etiqueta>
          </span>
        }
        descricao={anterior ? `Números de ${atual.ano} comparados com ${anterior.ano}. Os gráficos de vários anos mostram ${rotulos.join(', ')}.` : `Números de ${atual.ano}.`}
        acoes={
          <div className="flex flex-wrap items-center gap-3">
            <SeletorCedidos temCedidos={painel.anos.some((a) => a.temCedidos)} incluir={incluir} total={atual.cedidos} href={(i) => `/orcamento/previsao/geral?ano=${atual.ano}${i ? '' : '&cedidos=0'}`} />
            <SeletorAno anos={anos.map((a) => a.ano)} atual={atual.ano} href={(a) => `/orcamento/previsao/geral?ano=${a}${incluir ? '' : '&cedidos=0'}`} />
          </div>
        }
      />

      <dl className="grid gap-3 sm:grid-cols-3">
        {cartoes.map((c) => (
          <div key={c.rotulo} className={`rounded-cartao border bg-superficie px-5 py-4 ${c.alerta ? 'border-erro' : 'border-borda'}`}>
            <dt className="text-sm text-texto-suave">{c.rotulo}</dt>
            <dd className={`mt-0.5 text-2xl font-bold leading-tight tabular-nums ${c.alerta ? 'text-erro' : ''}`}><NumeroQueConta texto={c.valor} chave={`cartao:${c.rotulo}`} /></dd>
            <dd className="mt-1 flex flex-wrap items-center gap-2">
              {c.var}
              {c.alerta && <Etiqueta tipo="erro">{c.alerta}</Etiqueta>}
            </dd>
          </div>
        ))}
      </dl>

      <AtalhosSecoes secoes={SECOES} />

      <SecaoDoPainel id="indicadores" titulo="Indicadores">
      <Bloco tituloOculto titulo="Indicadores" descricao="Percentuais sobre a receita total. A barra é o ano em foco, o tracejado é o limite de referência e os traços finos são os anos anteriores.">
        <Indicadores
          itens={[
            {
              nome: 'Folha sobre a receita',
              valor: atual.indicadores.folhaSobreReceita,
              referencia: { valor: REFERENCIAS.folhaSobreReceita, sentido: 'ate' },
              anteriores: anteriores.map((a) => ({ rotulo: String(a.ano), valor: a.indicadores.folhaSobreReceita })),
              explicacao: `Recursos Humanos (folha + itens de RH${atual.cedidos ? ' + cedidos' : ''}: ${reais(atual.rh)}) ÷ receita.${outroValor(atual.indicadoresSemCedidos.folhaSobreReceita, incluir, atual.temCedidos)}`,
            },
            {
              nome: 'Dependência de recursos públicos',
              valor: atual.indicadores.dependenciaPublica,
              referencia: { valor: REFERENCIAS.dependenciaPublica, sentido: 'ate' },
              anteriores: anteriores.map((a) => ({ rotulo: String(a.ano), valor: a.indicadores.dependenciaPublica })),
              explicacao: `Receita de fontes públicas (inclui Projeto Incentivado e cedidos do poder público) ÷ receita.${outroValor(atual.indicadoresSemCedidos.dependenciaPublica, incluir, atual.temCedidos)}`,
            },
            {
              nome: 'Recursos livres',
              valor: atual.indicadores.recursosLivres,
              anteriores: anteriores.map((a) => ({ rotulo: String(a.ano), valor: a.indicadores.recursosLivres })),
              explicacao: `Receita de uso livre ÷ receita: o que pode pagar qualquer despesa. Cedido nunca é recurso livre.${outroValor(atual.indicadoresSemCedidos.recursosLivres, incluir, atual.temCedidos)}`,
            },
            {
              nome: 'Receita garantida',
              valor: atual.indicadores.receitaGarantida,
              anteriores: anteriores.map((a) => ({ rotulo: String(a.ano), valor: a.indicadores.receitaGarantida })),
              explicacao: `Receita com termo ou contrato assinado ÷ receita.${outroValor(atual.indicadoresSemCedidos.receitaGarantida, incluir, atual.temCedidos)}`,
            },
          ]}
        />
      </Bloco>
      </SecaoDoPainel>

      <SecaoDoPainel id="ano-em-foco" titulo="O ano em foco">
      <div className="grid gap-4 xl:grid-cols-2">
        <Bloco titulo={`Receita e despesa em ${atual.ano}, mês a mês`} descricao="Onde as linhas se cruzam, a despesa do mês passa a receita do mês.">
          <Linhas
            descricao={`Receita e despesa previstas por mês em ${atual.ano}`}
            formato="moeda"
            categorias={meses}
            series={[
              { nome: 'Receita', valores: atual.receitaMensal, cor: 1 },
              { nome: 'Despesa', valores: atual.despesaMensal, cor: 2 },
            ]}
          />
        </Bloco>
        <Bloco titulo="Sobra ou falta em cada mês" descricao="Receita menos despesa de cada mês. Passe o mouse para ver o saldo acumulado no ano.">
          <ResultadoMensal descricao={`Resultado de cada mês em ${atual.ano}`} categorias={meses} receita={atual.receitaMensal} despesa={atual.despesaMensal} />
          <p className="mt-3 text-sm">
            {mesesComFalta === 0 ? (
              'Todos os meses têm sobra.'
            ) : (
              <>
                <strong>{mesesComFalta}</strong> {mesesComFalta === 1 ? 'mês fecha' : 'meses fecham'} com falta.{' '}
                {menor.valor < 0 ? (
                  <span className="text-erro">
                    O saldo acumulado fica negativo, chegando a <strong>{reais(menor.valor)}</strong> em {MESES[menor.mes].toLowerCase()}.
                  </span>
                ) : (
                  <>O saldo acumulado do ano nunca fica negativo (menor: {reais(menor.valor)}, em {MESES[menor.mes].toLowerCase()}).</>
                )}
              </>
            )}
          </p>
        </Bloco>
      </div>

      <Bloco titulo="Fontes de recurso: quanto entra e quanto já está comprometido" descricao={`Em ${atual.ano}, a receita de cada fonte ao lado da despesa que ela paga.`}>
        <BarrasHorizontais
          descricao={`Receita e despesa por fonte de recurso em ${atual.ano}`}
          formato="moeda"
          rotuloCategoria="Fonte"
          categorias={fontes.map((f) => f.nome)}
          series={[
            { nome: 'Receita', valores: fontes.map((f) => f.receita), cor: 1 },
            { nome: 'Despesa', valores: fontes.map((f) => f.despesa), cor: 2 },
          ]}
          notas={fontes.map((f) =>
            f.receita === 0 && f.nome === 'A definir' ? (
              <span key={f.nome} className="text-aviso">Despesa ainda sem fonte</span>
            ) : f.despesa > f.receita ? (
              <span key={f.nome} className="text-erro">Despesa passa a receita em {reais(f.despesa - f.receita)}</span>
            ) : (
              `Sobram ${reais(f.receita - f.despesa)}`
            ),
          )}
        />
      </Bloco>
      </SecaoDoPainel>

      <SecaoDoPainel id="comparar" titulo="Comparar exercícios">
      <Bloco titulo="Despesa mês a mês, por exercício" descricao="Uma linha por ano: mostra a sazonalidade e onde cada ano gasta mais.">
        <Linhas
          descricao="Despesa prevista por mês em cada exercício"
          formato="moeda"
          categorias={meses}
          series={anos.map((a, i) => ({ nome: String(a.ano), valores: a.despesaMensal, cor: corDoAno(i) }))}
          altura={260}
        />
      </Bloco>

      <div className="grid gap-4 xl:grid-cols-2">
        <Bloco titulo="Despesa por área" descricao="Inclui a folha de pagamento de cada área.">
          <BarrasHorizontais
            descricao="Despesa por área em cada exercício"
            formato="moeda"
            rotuloCategoria="Área"
            categorias={areas}
            series={anos.map((a, i) => ({ nome: String(a.ano), valores: areas.map((n) => a.porArea[n] ?? 0), cor: corDoAno(i) }))}
          />
        </Bloco>
        <Bloco titulo="Despesa por grupo de gasto" descricao="Recursos Humanos soma a folha e os grupos marcados como RH.">
          <BarrasHorizontais
            descricao="Despesa por grupo de gasto em cada exercício"
            formato="moeda"
            rotuloCategoria="Grupo"
            categorias={grupos}
            series={anos.map((a, i) => ({ nome: String(a.ano), valores: grupos.map((n) => a.porGrupo[n] ?? 0), cor: corDoAno(i) }))}
          />
        </Bloco>
      </div>
      </SecaoDoPainel>

      <SecaoDoPainel id="receita" titulo="Receita">
      <div className="grid gap-4 xl:grid-cols-3">
        <Bloco titulo="Segurança da receita" descricao="Garantida: termo ou contrato assinado. Em negociação e a captar ainda podem não vir.">
          <Barras100
            descricao="Receita por situação da captação em cada ano"
            rotuloCategoria="Ano"
            categorias={rotulos}
            series={[
              { nome: 'Garantida', valores: anos.map((a) => a.porCaptacao.garantida), cor: 'ano-3' },
              { nome: 'Em negociação', valores: anos.map((a) => a.porCaptacao.negociacao), cor: 'ano-2' },
              { nome: 'A captar', valores: anos.map((a) => a.porCaptacao.a_captar), cor: 'ano-1' },
            ]}
          />
        </Bloco>
        <Bloco titulo="De onde vem a receita" descricao="Pública (governo, convênios, Projeto Incentivado) × própria (doações, eventos, vendas).">
          <Barras100
            descricao="Composição da receita por natureza em cada ano"
            rotuloCategoria="Ano"
            categorias={rotulos}
            series={[
              { nome: 'Pública', valores: anos.map((a) => a.receitaPublica), cor: 1 },
              { nome: 'Própria', valores: anos.map((a) => a.receitaPropria), cor: 3 },
            ]}
          />
        </Bloco>
        <Bloco titulo="Liberdade de uso da receita" descricao="Restrita: só paga o que o termo permite. Livre: paga qualquer despesa.">
          <Barras100
            descricao="Composição da receita por uso em cada ano"
            rotuloCategoria="Ano"
            categorias={rotulos}
            series={[
              { nome: 'Restrita', valores: anos.map((a) => a.receitaRestrita), cor: 4 },
              { nome: 'Livre', valores: anos.map((a) => a.receitaLivre), cor: 2 },
            ]}
          />
        </Bloco>
      </div>
      </SecaoDoPainel>

      <SecaoDoPainel id="resumo" titulo="Resumo">
      <Bloco tituloOculto titulo="Resumo dos exercícios">
        <TabelaDados
          legenda="Resumo dos exercícios"
          colunas={[
            { chave: 'ano', rotulo: 'Ano', tipo: 'numero' },
            { chave: 'situacao', rotulo: 'Situação' },
            { chave: 'receita', rotulo: 'Receita', tipo: 'moeda' },
            { chave: 'despesa', rotulo: 'Despesa', tipo: 'moeda' },
            { chave: 'resultado', rotulo: 'Resultado', tipo: 'moeda' },
            { chave: 'rh', rotulo: 'Recursos Humanos', tipo: 'moeda' },
            { chave: 'folha', rotulo: 'Folha / receita (%)', tipo: 'numero' },
            { chave: 'dependencia', rotulo: 'Dependência pública (%)', tipo: 'numero' },
            { chave: 'livres', rotulo: 'Recursos livres (%)', tipo: 'numero' },
            { chave: 'garantida', rotulo: 'Receita garantida (%)', tipo: 'numero', secundaria: true },
          ]}
          linhas={[...painel.anos].reverse().map((a) => ({
            id: String(a.ano),
            valores: {
              ano: a.ano,
              situacao: SITUACAO[a.situacao],
              receita: a.receita,
              despesa: a.despesa,
              resultado: a.resultado,
              rh: a.rh,
              folha: a.indicadores.folhaSobreReceita,
              dependencia: a.indicadores.dependenciaPublica,
              livres: a.indicadores.recursosLivres,
              garantida: a.indicadores.receitaGarantida,
            },
            celulas: {
              ano: <span className="font-semibold">{a.ano}</span>,
              resultado: <span className={a.resultado < 0 ? 'font-semibold text-erro' : ''}>{reais(a.resultado)}</span>,
            },
          }))}
        />
      </Bloco>
      </SecaoDoPainel>
    </div>
  );
}
