import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { painelPorArea } from '@/modulos/orcamento/aplicacao/analise-area';
import { BASE_RATEIO, type BaseRateio, type Matriz } from '@/modulos/orcamento/dominio/analise-area';
import { ORIGEM_RATEIO } from '@/modulos/orcamento/dominio/rateio-custos';
import { CATEGORIA, type Categoria } from '@/modulos/orcamento/dominio/previsao';
import { reais } from '@/modulos/orcamento/telas/formato';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { Botao } from '@/ui/botao';
import { estiloEntrada } from '@/ui/campo';
import { CabecalhoPagina, EstadoVazio, Etiqueta, Secao } from '@/ui/pagina';
import { TabelaDados, type ColunaDados } from '@/ui/tabela-dados';

export const metadata: Metadata = { title: 'Análise por área' };
const pct = (v: number) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const arred1 = (v: number) => Math.round(v * 1000) / 10;

/** Matriz grupos (linhas) × centros (colunas), com total e % de cada grupo. */
function TabelaMatriz({ matriz, legenda, totalRotulo }: { matriz: Matriz; legenda: string; totalRotulo: string }) {
  const colunas: ColunaDados[] = [
    { chave: 'grupo', rotulo: 'Grupo de gasto' },
    ...matriz.colunas.map((c, i) => ({ chave: `c${i}`, rotulo: c.nome, tipo: 'moeda' as const, somar: true })),
    ...(matriz.colunas.length > 1 ? [{ chave: 'total', rotulo: 'Total', tipo: 'moeda' as const, somar: true }] : []),
    { chave: 'pct', rotulo: '%', tipo: 'numero' as const },
  ];
  return (
    <TabelaDados
      legenda={legenda}
      totalRotulo={totalRotulo}
      vazio="Nada lançado."
      colunas={colunas}
      linhas={matriz.linhas.map((l) => ({
        id: l.grupo,
        valores: { grupo: l.grupo, total: l.total, pct: arred1(l.percentual), ...Object.fromEntries(l.valores.map((v, i) => [`c${i}`, v])) },
        celulas: { grupo: <span className="font-semibold">{l.grupo}</span>, pct: <span className="text-texto-suave">{pct(l.percentual)}</span> },
      }))}
    />
  );
}

export default async function AnalisePorArea({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string; area?: string; base?: string; categoria?: string | string[] }>;
}) {
  const sp = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const app = await obterAplicacao();
  const categorias = ([] as string[]).concat(sp.categoria ?? []).filter((c): c is Categoria => c === 'operacional' || c === 'projetos');
  const painel = await painelPorArea(app.planilhas, usuario.autorizador, {
    ano: Number(sp.ano) || undefined,
    area: sp.area,
    base: sp.base as BaseRateio | undefined,
    categorias,
  });
  const a = painel.analise;

  const cards = a
    ? [
        { rotulo: 'Resultado', valor: a.cards.resultado, nota: 'Receita restrita − gastos', forte: true },
        { rotulo: 'Receita (restrita)', valor: a.cards.receitaRestrita, nota: 'Receitas da área com fonte de uso restrito' },
        { rotulo: 'Gastos', valor: a.cards.gastos, nota: 'Custos + despesas' },
        { rotulo: 'Custos', valor: a.cards.custos, nota: 'Diretos + indiretos da área' },
        { rotulo: 'Despesas', valor: a.cards.despesas, nota: `Rateio do administrativo (${pct(a.totais.percentualCustoArea)} do custo total)` },
      ]
    : [];

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento/previsao' }, { rotulo: 'Análise por área' }]}
        titulo={`Análise por área ${painel.ano}`}
        descricao="Custo direto de cada centro, rateio do custo indireto da área e das despesas administrativas, custo per capita e resultado da área."
      />

      <form className="flex flex-wrap items-end gap-4 rounded-cartao border border-borda bg-superficie px-4 py-3" action="/orcamento/previsao/areas">
        <input type="hidden" name="ano" value={painel.ano} />
        <label className="block text-sm">
          <span className="font-semibold">Área</span>
          <select name="area" defaultValue={painel.area?.codigo} className={`${estiloEntrada} !mt-1 !min-h-9 !py-1.5`}>
            {painel.areas.map((x) => (
              <option key={x.codigo} value={x.codigo}>
                {x.nome}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="text-sm">
          <legend className="font-semibold">Categoria</legend>
          <div className="mt-2 flex gap-4">
            {(Object.keys(CATEGORIA) as Categoria[]).map((c) => (
              <label key={c} className="flex items-center gap-1.5">
                <input type="checkbox" name="categoria" value={c} defaultChecked={painel.categorias.includes(c)} />
                {CATEGORIA[c]}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm">
          <span className="font-semibold">Base de rateio</span>
          <select name="base" defaultValue={painel.base} className={`${estiloEntrada} !mt-1 !min-h-9 !py-1.5`}>
            {(Object.keys(BASE_RATEIO) as BaseRateio[]).map((b) => (
              <option key={b} value={b}>
                {BASE_RATEIO[b]}
              </option>
            ))}
          </select>
        </label>
        <Botao type="submit" variante="secundario" className="!min-h-9">
          Aplicar
        </Botao>
      </form>

      {painel.semClassificacao > 0 && (
        <Aviso tipo="info">
          {painel.semClassificacao} {painel.semClassificacao === 1 ? 'serviço sem classificação conta' : 'serviços sem classificação contam'} como custo direto.{' '}
          <Link href="/orcamento/previsao/centros" className="font-semibold underline">
            Classificar os centros de custo
          </Link>
        </Aviso>
      )}

      {!a ? (
        <EstadoVazio titulo="Nenhuma área com centros de custo">Cadastre os serviços e classifique os centros de custo para ver a análise.</EstadoVazio>
      ) : (
        <>
          {a.baseUsada !== a.base && (
            <Aviso tipo="atencao">
              Os centros desta área não têm “{BASE_RATEIO[a.base]}” informado: o rateio usou{' '}
              {a.baseUsada === 'igual' ? 'partes iguais' : `“${BASE_RATEIO[a.baseUsada]}”`}.
            </Aviso>
          )}
          {a.indiretoSemRateio > 0 && (
            <Aviso tipo="atencao">A área não tem centro de custo direto: {reais(a.indiretoSemRateio)} de custo indireto ficaram sem rateio.</Aviso>
          )}

          {painel.avisosRegras.map((m) => (
            <Aviso key={m} tipo="atencao">
              {m}
            </Aviso>
          ))}

          <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {cards.map((c) => (
              <div key={c.rotulo} className={`rounded-cartao border px-4 py-3 ${c.forte && c.valor < 0 ? 'border-erro bg-erro-fundo' : 'border-borda bg-superficie'}`}>
                <dt className="text-sm text-texto-suave">{c.rotulo}</dt>
                <dd className={`mt-0.5 text-xl font-bold tabular-nums ${c.forte && c.valor < 0 ? 'text-erro' : ''}`}>{reais(c.valor)}</dd>
                <dd className="text-xs text-texto-suave">{c.nota}</dd>
                {c.forte && (
                  <dd className="mt-1">{c.valor < 0 ? <Etiqueta tipo="erro">Déficit na área</Etiqueta> : <Etiqueta tipo="sucesso">Receita cobre os gastos</Etiqueta>}</dd>
                )}
              </div>
            ))}
          </dl>

          <Secao titulo="Custo direto por centro" descricao={`Grupos de gasto × centros de custo diretos de ${painel.area?.nome}. A folha entra como “Recursos Humanos – folha”.`}>
            <TabelaMatriz matriz={a.direta} legenda="Custo direto por grupo e centro" totalRotulo="Custo direto" />
          </Secao>

          <Secao
            titulo="Rateio e custo total por centro"
            descricao={`A = custo direto · R = recebido por regra de rateio · B = custo indireto da área · C = A + R + B · D = despesas administrativas. Base: ${BASE_RATEIO[a.baseUsada === 'igual' ? 'custo' : a.baseUsada]}${a.baseUsada === 'igual' ? ' (partes iguais)' : ''}.`}
          >
            <TabelaDados
              legenda="Rateio por centro de custo"
              totalRotulo="Área"
              colunas={[
                { chave: 'nome', rotulo: 'Centro' },
                { chave: 'peso', rotulo: 'Rateio %', tipo: 'numero' },
                { chave: 'A', rotulo: 'A · Direto', tipo: 'moeda', somar: true },
                { chave: 'R', rotulo: 'R · Por regra', tipo: 'moeda', somar: true },
                { chave: 'B', rotulo: 'B · Indireto', tipo: 'moeda', somar: true },
                { chave: 'C', rotulo: 'C · Custo', tipo: 'moeda', somar: true },
                { chave: 'D', rotulo: 'D · Despesa', tipo: 'moeda', somar: true },
                { chave: 'total', rotulo: 'Total', tipo: 'moeda', somar: true },
                { chave: 'atendidos', rotulo: 'Atendidos', tipo: 'numero', secundaria: true },
                { chave: 'profissionais', rotulo: 'Profissionais', tipo: 'numero', secundaria: true },
                { chave: 'perCapita', rotulo: 'Per capita mensal', tipo: 'moeda' },
                { chave: 'porSessao', rotulo: 'Por sessão', tipo: 'moeda', secundaria: true },
              ]}
              linhas={a.rateio.map((r) => ({
                id: r.codigo,
                valores: {
                  nome: r.nome,
                  peso: arred1(r.peso),
                  A: r.A,
                  R: r.R,
                  B: r.B,
                  C: r.C,
                  D: r.D,
                  total: r.total,
                  atendidos: r.atendidos,
                  profissionais: r.profissionais,
                  perCapita: r.perCapitaMensal,
                  porSessao: r.porSessao,
                },
                celulas: {
                  nome: <span className="font-semibold">{r.nome}</span>,
                  R: r.R > 0 ? <span title={r.regras.map((x) => `${x.nome} (${ORIGEM_RATEIO[x.origem]}): ${reais(x.valor)}`).join('\n')}>{reais(r.R)}<span className="block text-xs text-texto-suave">{r.regras.map((x) => x.nome).join(', ')}</span></span> : reais(0),
                  peso: <span className="text-texto-suave">{pct(r.peso)}</span>,
                  total: <strong>{reais(r.total)}</strong>,
                  perCapita: r.perCapitaMensal === null ? <span className="text-texto-suave">sem atendidos</span> : reais(r.perCapitaMensal),
                },
              }))}
            />
          </Secao>

          {a.indireta.colunas.length > 0 && (
            <Secao titulo="Detalhamento do custo indireto" descricao="Centros de apoio da área. O total é rateado entre os centros diretos (coluna B acima).">
              <TabelaMatriz matriz={a.indireta} legenda="Custo indireto por grupo e centro" totalRotulo="Custo indireto" />
            </Secao>
          )}

          <Secao
            titulo="Despesas administrativas"
            descricao={`Centros do tipo despesa, de toda a instituição. A área recebe ${pct(a.totais.percentualCustoArea)} delas, a proporção do seu custo no custo total.`}
          >
            <TabelaDados
              legenda="Despesas administrativas por centro e grupo"
              totalRotulo="Total de despesas"
              vazio="Nenhum centro classificado como despesa."
              colunas={[
                { chave: 'centro', rotulo: 'Centro' },
                ...a.despesasAdministrativas.linhas.map((l, i) => ({ chave: `g${i}`, rotulo: l.grupo, tipo: 'moeda' as const, somar: true })),
                { chave: 'total', rotulo: 'Total', tipo: 'moeda', somar: true },
              ]}
              linhas={a.despesasAdministrativas.colunas.map((c, j) => ({
                id: c.codigo,
                valores: {
                  centro: c.nome,
                  total: a.despesasAdministrativas.totais[j],
                  ...Object.fromEntries(a.despesasAdministrativas.linhas.map((l, i) => [`g${i}`, l.valores[j]])),
                },
                celulas: { centro: <span className="font-semibold">{c.nome}</span> },
              }))}
            />
          </Secao>

          <dl className="grid gap-3 text-sm sm:grid-cols-4">
            {[
              ['Total geral do orçamento', reais(a.totais.orcamento)],
              ['Total geral de custos', reais(a.totais.custoGeral)],
              ['Total geral de despesas', reais(a.totais.despesaGeral)],
              [`${painel.area?.nome} sobre o orçamento`, pct(a.totais.percentualOrcamento)],
            ].map(([r, v]) => (
              <div key={r} className="rounded-cartao border border-borda bg-superficie px-4 py-3">
                <dt className="text-texto-suave">{r}</dt>
                <dd className="text-lg font-bold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </div>
  );
}
