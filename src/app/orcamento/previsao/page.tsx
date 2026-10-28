import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { lerPrevisao, type Grupamento } from '@/modulos/orcamento/aplicacao/previsao';
import { REFERENCIAS } from '@/modulos/orcamento/dominio/previsao';
import { MESES, reais } from '@/modulos/orcamento/telas/formato';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { LinkBotao } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { CabecalhoPagina, EstadoVazio, Etiqueta, tabela } from '@/ui/pagina';
import { acaoAbrirExercicio } from './acoes';

export const metadata: Metadata = { title: 'Previsão' };
const pequeno = '!min-h-8 !px-3 !py-1 !text-sm';
const pct = (v: number | null) => (v === null ? '—' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);
const SITUACAO = { elaboracao: 'Em elaboração', aprovado: 'Aprovado', encerrado: 'Encerrado' } as const;

function Quebra({ titulo, linhas, total, legenda }: { titulo: string; linhas: Grupamento[]; total: number; legenda: string }) {
  return (
    <section className="rounded-xl border border-borda bg-superficie" aria-label={titulo}>
      <h2 className="border-b border-borda px-5 py-3 font-bold">{titulo}</h2>
      {linhas.length === 0 ? (
        <p className="px-5 py-4 text-sm text-texto-suave">Nada lançado.</p>
      ) : (
        <table className="w-full text-sm">
          <caption className="sr-only">{legenda}</caption>
          <tbody>
            {linhas.map((l) => {
              const parte = total > 0 ? l.anual / total : 0;
              return (
                <tr key={l.chave} className="border-b border-borda last:border-0">
                  <th scope="row" className="w-1/2 px-5 py-2 text-left font-normal">
                    {l.nome === 'A definir' ? <Etiqueta tipo="atencao">A definir</Etiqueta> : l.nome}
                    <span className="mt-1 block h-1.5 rounded-full bg-superficie-2" aria-hidden="true">
                      <span className="block h-1.5 rounded-full bg-destaque" style={{ width: `${Math.max(parte * 100, 1)}%` }} />
                    </span>
                  </th>
                  <td className="px-3 py-2 text-right tabular-nums">{reais(l.anual)}</td>
                  <td className="w-16 px-5 py-2 text-right tabular-nums text-texto-suave">{pct(Math.round(parte * 1000) / 10)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default async function PainelPrevisao({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const sp = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const app = await obterAplicacao();
  const prev = await lerPrevisao(app.planilhas, usuario.autorizador, Number(sp.ano) || undefined);
  const podeAbrir = usuario.autorizador.temPermissao('orcamento.previsao.editar');
  const t = prev.totais;
  const i = prev.indicadores;
  const vazio = prev.despesas.length === 0 && prev.receitas.length === 0 && !prev.folha?.anual;

  const indicadores = [
    {
      nome: 'Folha sobre a receita',
      valor: i.folhaSobreReceita,
      ref: `Referência: até ${REFERENCIAS.folhaSobreReceita}%`,
      alerta: i.folhaSobreReceita !== null && i.folhaSobreReceita > REFERENCIAS.folhaSobreReceita,
      dica: `RH (folha + itens de RH): ${reais(t.rh)}`,
    },
    {
      nome: 'Dependência de recursos públicos',
      valor: i.dependenciaPublica,
      ref: `Referência: até ${REFERENCIAS.dependenciaPublica}%`,
      alerta: i.dependenciaPublica !== null && i.dependenciaPublica > REFERENCIAS.dependenciaPublica,
      dica: 'Receita de fontes públicas (inclui Projeto Incentivado) ÷ receita total',
    },
    { nome: 'Recursos livres', valor: i.recursosLivres, ref: 'Informativo', alerta: null, dica: 'Receita de uso livre ÷ receita total' },
    { nome: 'Receita garantida', valor: i.receitaGarantida, ref: 'Informativo', alerta: null, dica: 'Com termo ou contrato assinado' },
  ];

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento' }, { rotulo: `Previsão ${prev.ano}` }]}
        titulo={
          <span className="flex flex-wrap items-center gap-3">
            Previsão {prev.ano}
            {prev.exercicio && <Etiqueta tipo={prev.exercicio.situacao === 'aprovado' ? 'sucesso' : 'info'}>{SITUACAO[prev.exercicio.situacao]}</Etiqueta>}
          </span>
        }
        descricao="Despesas (itens lançados + folha de pagamento automática), receitas e indicadores do exercício."
        acoes={
          <>
            {prev.anos.length > 1 &&
              prev.anos.map((a) => (
                <LinkBotao key={a} href={`/orcamento/previsao?ano=${a}`} variante={a === prev.ano ? 'primario' : 'secundario'} className={pequeno}>
                  {a}
                </LinkBotao>
              ))}
            {podeAbrir && prev.exercicio && (
              <form action={acaoAbrirExercicio}>
                <input type="hidden" name="ano" value={Math.max(...prev.anos) + 1} />
                <BotaoEnviar variante="fantasma" className={pequeno} enviando="Abrindo…">
                  Abrir exercício {Math.max(...prev.anos) + 1}
                </BotaoEnviar>
              </form>
            )}
          </>
        }
      />

      {!prev.exercicio ? (
        <EstadoVazio
          titulo={`O exercício ${prev.ano} ainda não foi aberto`}
          acao={
            podeAbrir ? (
              <form action={acaoAbrirExercicio}>
                <input type="hidden" name="ano" value={prev.ano} />
                <BotaoEnviar enviando="Abrindo…">Abrir o exercício {prev.ano}</BotaoEnviar>
              </form>
            ) : undefined
          }
        >
          {podeAbrir
            ? 'Abra o exercício para começar a lançar despesas e receitas. Antes, cadastre os grupos de gasto e as fontes de recurso.'
            : 'O Financeiro ainda não abriu o exercício.'}
        </EstadoVazio>
      ) : (
        <>
          {(t.aDefinir.itens > 0 || prev.avisoFolha) && (
            <div className="space-y-2">
              {t.aDefinir.itens > 0 && (
                <Aviso
                  tipo="atencao"
                  titulo={`${reais(t.aDefinir.valor)} em despesas com fonte “a definir”`}
                  acao={<LinkBotao href={`/orcamento/previsao/despesas?ano=${prev.ano}&fonte=__a_definir__#t-folha`} variante="secundario">Escolher as fontes</LinkBotao>}
                >
                  {t.aDefinir.itens} {t.aDefinir.itens === 1 ? 'linha' : 'linhas'} (itens ou folha de um serviço). O exercício só é aprovado com todas as fontes escolhidas.
                </Aviso>
              )}
              {prev.avisoFolha && <Aviso tipo="info">{prev.avisoFolha}</Aviso>}
            </div>
          )}

          <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-borda bg-superficie px-5 py-4">
              <dt className="text-sm text-texto-suave">Despesa prevista</dt>
              <dd className="mt-0.5 text-2xl font-bold tabular-nums">{reais(t.despesa.anual)}</dd>
              <dd className="text-sm text-texto-suave">
                <Link href={`/orcamento/previsao/despesas?ano=${prev.ano}`} className="underline">
                  {prev.despesas.length} itens
                </Link>{' '}
                + folha {reais(prev.folha?.anual ?? 0)}
              </dd>
            </div>
            <div className="rounded-xl border border-borda bg-superficie px-5 py-4">
              <dt className="text-sm text-texto-suave">Receita prevista</dt>
              <dd className="mt-0.5 text-2xl font-bold tabular-nums">{reais(t.receita.anual)}</dd>
              <dd className="text-sm text-texto-suave">
                <Link href={`/orcamento/previsao/receitas?ano=${prev.ano}`} className="underline">
                  {prev.receitas.length} receitas
                </Link>
              </dd>
            </div>
            <div className={`rounded-xl border px-5 py-4 ${i.resultado < 0 ? 'border-erro bg-erro-fundo' : 'border-borda bg-superficie'}`}>
              <dt className="text-sm text-texto-suave">Resultado previsto</dt>
              <dd className={`mt-0.5 text-2xl font-bold tabular-nums ${i.resultado < 0 ? 'text-erro' : ''}`}>{reais(i.resultado)}</dd>
              <dd className="mt-1">
                {i.resultado < 0 ? <Etiqueta tipo="erro">Déficit: despesa maior que a receita</Etiqueta> : <Etiqueta tipo="sucesso">Receita cobre a despesa</Etiqueta>}
              </dd>
            </div>
            <div className="rounded-xl border border-borda bg-superficie px-5 py-4">
              <dt className="text-sm text-texto-suave">Recursos Humanos</dt>
              <dd className="mt-0.5 text-2xl font-bold tabular-nums">{reais(t.rh)}</dd>
              <dd className="text-sm text-texto-suave">{t.despesa.anual > 0 ? `${pct(Math.round((t.rh / t.despesa.anual) * 1000) / 10)} da despesa` : '—'}</dd>
            </div>
          </dl>

          <section aria-labelledby="t-ind" className="space-y-3">
            <h2 id="t-ind" className="text-lg font-bold">
              Indicadores
            </h2>
            <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {indicadores.map((x) => (
                <div key={x.nome} className={`rounded-xl border px-5 py-4 ${x.alerta ? 'border-aviso bg-aviso-fundo' : 'border-borda bg-superficie'}`}>
                  <dt className="text-sm font-semibold">{x.nome}</dt>
                  <dd className="mt-0.5 text-2xl font-bold tabular-nums">{pct(x.valor)}</dd>
                  <dd className="mt-1 flex flex-wrap items-center gap-2 text-xs text-texto-suave">
                    {x.alerta === true && <Etiqueta tipo="atencao">Acima da referência</Etiqueta>}
                    {x.alerta === false && <Etiqueta tipo="sucesso">Dentro da referência</Etiqueta>}
                    {x.ref}
                  </dd>
                  <dd className="mt-1 text-xs text-texto-suave">{x.dica}</dd>
                </div>
              ))}
            </dl>
          </section>

          {!vazio && (
            <section aria-labelledby="t-meses" className="space-y-3">
              <h2 id="t-meses" className="text-lg font-bold">
                Mês a mês
              </h2>
              <div className={tabela.moldura}>
                <table className={tabela.tabela}>
                  <caption className="sr-only">Despesa, receita e resultado por mês em {prev.ano}</caption>
                  <thead className={tabela.cabeca}>
                    <tr>
                      <th scope="col" className={`${tabela.th} sticky left-0 bg-superficie-2`}>
                        <span className="sr-only">Linha</span>
                      </th>
                      {MESES.map((m) => (
                        <th key={m} scope="col" className={`${tabela.th} text-right`}>
                          {m.slice(0, 3)}
                        </th>
                      ))}
                      <th scope="col" className={`${tabela.th} text-right`}>
                        Ano
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { rotulo: 'Receita', v: t.receita.mensal, ano: t.receita.anual },
                      { rotulo: 'Despesa', v: t.despesa.mensal, ano: t.despesa.anual },
                      { rotulo: 'Resultado', v: t.receita.mensal.map((r, k) => Math.round((r - t.despesa.mensal[k]) * 100) / 100), ano: i.resultado, forte: true },
                    ].map((l) => (
                      <tr key={l.rotulo} className={`border-b border-borda last:border-0 ${l.forte ? 'font-semibold' : ''}`}>
                        <th scope="row" className="sticky left-0 bg-superficie px-4 py-2.5 text-left">
                          {l.rotulo}
                        </th>
                        {l.v.map((v, k) => (
                          <td key={k} className={`whitespace-nowrap px-3 py-2.5 text-right tabular-nums ${l.forte && v < 0 ? 'text-erro' : ''}`}>
                            {v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                          </td>
                        ))}
                        <td className={`whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums ${l.forte && l.ano < 0 ? 'text-erro' : ''}`}>{reais(l.ano)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-texto-suave">Valores mensais em reais, sem centavos. Resultado negativo em vermelho.</p>
            </section>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Quebra titulo="Despesa por área" linhas={t.porArea} total={t.despesa.anual} legenda="Despesa anual por área, com a parte do total" />
            <Quebra titulo="Despesa por grupo de gasto" linhas={t.porGrupo} total={t.despesa.anual} legenda="Despesa anual por grupo de gasto" />
            <Quebra titulo="Despesa por fonte" linhas={t.despesaPorFonte} total={t.despesa.anual} legenda="Despesa anual por fonte de recurso" />
            <Quebra titulo="Receita por fonte" linhas={t.receitaPorFonte} total={t.receita.anual} legenda="Receita anual por fonte de recurso" />
          </div>
        </>
      )}
    </div>
  );
}
