import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { painelGeral, variacao, type ResumoDoAno } from '@/modulos/orcamento/aplicacao/painel-geral';
import { REFERENCIAS } from '@/modulos/orcamento/dominio/previsao';
import { MESES, reais } from '@/modulos/orcamento/telas/formato';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { LinkBotao } from '@/ui/botao';
import { BarrasAgrupadas, Barras100, BarrasHorizontais, Linhas } from '@/ui/graficos';
import { CabecalhoPagina, EstadoVazio, Etiqueta } from '@/ui/pagina';
import { TabelaDados } from '@/ui/tabela-dados';

export const metadata: Metadata = { title: 'Painel geral' };

const SITUACAO = { elaboracao: 'Em elaboração', aprovado: 'Aprovado', encerrado: 'Encerrado' } as const;
const pct = (v: number | null) => (v === null ? '—' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);

function Bloco({ titulo, descricao, children, className = '' }: { titulo: string; descricao?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-borda bg-superficie p-5 ${className}`} aria-label={titulo}>
      <h2 className="font-bold">{titulo}</h2>
      {descricao && <p className="mb-4 mt-0.5 text-sm text-texto-suave">{descricao}</p>}
      {!descricao && <div className="mb-4" />}
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

export default async function PainelGeral() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const app = await obterAplicacao();
  const painel = await painelGeral(app.planilhas, usuario.autorizador);
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

  const atual = anos.at(-1)!;
  const anterior: ResumoDoAno | undefined = anos.at(-2);
  const rotulos = anos.map((a) => String(a.ano));
  // Cor fixa por ano: o mais recente é sempre azul, o anterior laranja…
  // Anos numa escala de um tom só: o exercício atual é o mais forte; os anteriores, mais claros.
  const corDoAno = (i: number) => (['ano-3', 'ano-2', 'ano-1'] as const)[Math.min(anos.length - 1 - i, 2)];

  const cartoes = [
    { rotulo: 'Receita prevista', valor: reais(atual.receita), var: <Variacao atual={atual.receita} anterior={anterior?.receita} anoAnterior={anterior?.ano} /> },
    { rotulo: 'Despesa prevista', valor: reais(atual.despesa), var: <Variacao atual={atual.despesa} anterior={anterior?.despesa} anoAnterior={anterior?.ano} /> },
    {
      rotulo: 'Resultado',
      valor: reais(atual.resultado),
      alerta: atual.resultado < 0 ? 'Déficit' : null,
      var: <Variacao atual={atual.resultado} anterior={anterior?.resultado} anoAnterior={anterior?.ano} />,
    },
    {
      rotulo: 'Folha sobre a receita',
      valor: pct(atual.indicadores.folhaSobreReceita),
      alerta: (atual.indicadores.folhaSobreReceita ?? 0) > REFERENCIAS.folhaSobreReceita ? `Acima de ${REFERENCIAS.folhaSobreReceita}%` : null,
      var: <Variacao pontos atual={atual.indicadores.folhaSobreReceita} anterior={anterior?.indicadores.folhaSobreReceita} anoAnterior={anterior?.ano} />,
    },
    {
      rotulo: 'Dependência de recursos públicos',
      valor: pct(atual.indicadores.dependenciaPublica),
      alerta: (atual.indicadores.dependenciaPublica ?? 0) > REFERENCIAS.dependenciaPublica ? `Acima de ${REFERENCIAS.dependenciaPublica}%` : null,
      var: <Variacao pontos atual={atual.indicadores.dependenciaPublica} anterior={anterior?.indicadores.dependenciaPublica} anoAnterior={anterior?.ano} />,
    },
    {
      rotulo: 'Recursos livres',
      valor: pct(atual.indicadores.recursosLivres),
      var: <Variacao pontos atual={atual.indicadores.recursosLivres} anterior={anterior?.indicadores.recursosLivres} anoAnterior={anterior?.ano} />,
    },
  ];

  const areas = painel.areas.slice(0, 10);
  const grupos = painel.grupos.slice(0, 8);

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento' }, { rotulo: 'Painel geral' }]}
        titulo="Painel geral"
        descricao={`Compara os exercícios ${rotulos.join(', ')}. Os cartões mostram ${atual.ano} e a variação em relação a ${anterior?.ano ?? 'o ano anterior'}.`}
        acoes={
          <span className="flex items-center gap-2 text-sm text-texto-suave">
            {atual.ano}: <Etiqueta tipo={atual.situacao === 'elaboracao' ? 'info' : 'sucesso'}>{SITUACAO[atual.situacao]}</Etiqueta>
          </span>
        }
      />

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {cartoes.map((c) => (
          <div key={c.rotulo} className={`rounded-xl border bg-superficie px-4 py-3.5 ${c.alerta ? 'border-aviso' : 'border-borda'}`}>
            <dt className="text-sm text-texto-suave">{c.rotulo}</dt>
            <dd className="mt-0.5 text-[1.35rem] font-bold leading-tight tabular-nums">{c.valor}</dd>
            <dd className="mt-1 flex flex-wrap items-center gap-2">
              {c.var}
              {c.alerta && <Etiqueta tipo="atencao">{c.alerta}</Etiqueta>}
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-4 xl:grid-cols-2">
        <Bloco titulo="Receita e despesa por ano" descricao="Previsão de cada exercício. A diferença é o resultado.">
          <BarrasAgrupadas
            descricao="Receita e despesa previstas por ano"
            formato="moeda"
            categorias={rotulos}
            series={[
              { nome: 'Receita', valores: anos.map((a) => a.receita), cor: 1 },
              { nome: 'Despesa', valores: anos.map((a) => a.despesa), cor: 2 },
            ]}
          />
        </Bloco>
        <Bloco titulo="Indicadores ao longo dos anos" descricao="Percentual sobre a receita total. Tracejado: limite de referência.">
          <Linhas
            descricao="Folha sobre a receita, dependência de recursos públicos e recursos livres por ano"
            formato="pct"
            rotuloCategoria="Ano"
            categorias={rotulos}
            minimo={0}
            maximo={100}
            referencias={[
              { valor: REFERENCIAS.dependenciaPublica, rotulo: `Dependência: até ${REFERENCIAS.dependenciaPublica}%` },
              { valor: REFERENCIAS.folhaSobreReceita, rotulo: `Folha: até ${REFERENCIAS.folhaSobreReceita}%` },
            ]}
            series={[
              { nome: 'Dependência de recursos públicos', valores: anos.map((a) => a.indicadores.dependenciaPublica ?? 0), cor: 1 },
              { nome: 'Folha sobre a receita', valores: anos.map((a) => a.indicadores.folhaSobreReceita ?? 0), cor: 2 },
              { nome: 'Recursos livres', valores: anos.map((a) => a.indicadores.recursosLivres ?? 0), cor: 3 },
            ]}
          />
        </Bloco>
      </div>

      <Bloco titulo="Despesa mês a mês" descricao="Uma linha por exercício: mostra a sazonalidade e onde cada ano gasta mais.">
        <Linhas
          descricao="Despesa prevista por mês em cada exercício"
          formato="moeda"
          categorias={MESES.map((m) => m.slice(0, 3))}
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

      <div className="grid gap-4 xl:grid-cols-2">
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

      <Bloco titulo="Resumo dos exercícios">
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
    </div>
  );
}
