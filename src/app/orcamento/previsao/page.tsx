import type { Metadata } from 'next';
import { SeletorAno } from '@/ui/seletor-ano';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { arvoreMensal, lerPrevisao, type Grupamento } from '@/modulos/orcamento/aplicacao/previsao';
import { REFERENCIAS } from '@/modulos/orcamento/dominio/previsao';
import { reais } from '@/modulos/orcamento/telas/formato';
import { TabelaMensal } from '@/modulos/orcamento/telas/tabela-mensal';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { Botao } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { CabecalhoPagina, EstadoVazio, Etiqueta } from '@/ui/pagina';
import { FormularioConfirmado } from '@/ui/confirmar';
import { IconeCerto } from '@/ui/icones';
import { acaoAbrirExercicio, acaoAprovarExercicio, acaoEncerrarExercicio } from './acoes';

const ETAPAS = [
  { chave: 'elaboracao', rotulo: 'Em elaboração', dica: 'Financeiro lança; coordenações propõem' },
  { chave: 'aprovado', rotulo: 'Aprovado', dica: 'Muda só por remanejamento' },
  { chave: 'encerrado', rotulo: 'Encerrado', dica: 'Ano fechado' },
] as const;

/** Onde o exercício está, o que falta para aprovar e o botão da Diretoria. */
function SituacaoDoExercicio(props: {
  ano: number;
  situacao: 'elaboracao' | 'aprovado' | 'encerrado';
  aprovadoEm: string | null;
  fontesADefinir: number;
  valorADefinir: number;
  propostas: number;
  ajustes: number;
  podeAprovar: boolean;
}) {
  const atual = ETAPAS.findIndex((e) => e.chave === props.situacao);
  const pendencias = [
    props.fontesADefinir > 0 && {
      texto: `${props.fontesADefinir} ${props.fontesADefinir === 1 ? 'linha' : 'linhas'} com fonte “a definir” (${reais(props.valorADefinir)})`,
      href: `/orcamento/previsao/despesas?ano=${props.ano}`,
      acao: 'Escolher as fontes',
    },
    props.propostas > 0 && {
      texto: `${props.propostas} ${props.propostas === 1 ? 'proposta das coordenações aguarda' : 'propostas das coordenações aguardam'} decisão`,
      href: `/orcamento/previsao/propostas?ano=${props.ano}`,
      acao: 'Ver propostas',
    },
  ].filter(Boolean) as { texto: string; href: string; acao: string }[];

  return (
    <section aria-label="Situação do exercício" className="rounded-xl border border-borda bg-superficie p-5">
      <ol className="grid gap-3 sm:grid-cols-3">
        {ETAPAS.map((e, i) => (
          <li key={e.chave} className={`flex items-start gap-3 ${i > atual ? 'opacity-50' : ''}`} aria-current={i === atual ? 'step' : undefined}>
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                i < atual ? 'bg-sucesso-fundo text-sucesso' : i === atual ? 'bg-destaque text-sobre-destaque' : 'border border-borda-forte text-texto-suave'
              }`}
            >
              {i < atual ? <IconeCerto tamanho={14} /> : i + 1}
            </span>
            <span>
              <span className="block font-semibold">{e.rotulo}</span>
              <span className="block text-xs text-texto-suave">
                {e.chave === 'aprovado' && props.aprovadoEm ? `Aprovado em ${props.aprovadoEm.split('-').reverse().join('/')}` : e.dica}
              </span>
            </span>
          </li>
        ))}
      </ol>

      {props.situacao === 'elaboracao' && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-borda pt-4">
          {pendencias.length > 0 ? (
            <ul className="space-y-1 text-sm">
              <li className="font-semibold">Para a Diretoria aprovar, falta:</li>
              {pendencias.map((p) => (
                <li key={p.href} className="flex flex-wrap items-center gap-2">
                  <span aria-hidden="true" className="text-aviso">●</span> {p.texto}
                  <Link href={p.href} className="font-semibold text-destaque underline-offset-2 hover:underline">
                    {p.acao}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm">
              <span aria-hidden="true" className="text-sucesso">●</span> Tudo pronto: todas as fontes escolhidas e nenhuma proposta pendente.
            </p>
          )}
          {props.podeAprovar && pendencias.length > 0 && (
            <Botao disabled title="Resolva as pendências ao lado primeiro">
              Aprovar o exercício {props.ano}
            </Botao>
          )}
          {props.podeAprovar && pendencias.length === 0 && (
            <FormularioConfirmado
              acao={acaoAprovarExercicio}
              campos={{ ano: props.ano }}
              rotulo={`Aprovar o exercício ${props.ano}`}
              variante="primario"
              perigoso={false}
              titulo={`Aprovar o exercício ${props.ano}?`}
              mensagem="Depois de aprovado, despesas e receitas só mudam por remanejamento ou suplementação, sempre com aprovação da Diretoria."
              confirmar="Aprovar exercício"
            />
          )}
        </div>
      )}
      {props.situacao === 'aprovado' && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-borda pt-4 text-sm">
          <p>
            Mudanças só por{' '}
            <Link href={`/orcamento/previsao/ajustes?ano=${props.ano}`} className="font-semibold text-destaque underline-offset-2 hover:underline">
              remanejamento ou suplementação
            </Link>
            {props.ajustes > 0 ? ` · ${props.ajustes} ${props.ajustes === 1 ? 'pedido aguarda' : 'pedidos aguardam'} a Diretoria` : ''}.
          </p>
          {props.podeAprovar && (
            <FormularioConfirmado
              acao={acaoEncerrarExercicio}
              campos={{ ano: props.ano }}
              rotulo="Encerrar o exercício"
              variante="secundario"
              pequeno
              perigoso={false}
              titulo={`Encerrar o exercício ${props.ano}?`}
              mensagem="O ano fica fechado: nenhum remanejamento ou suplementação a mais. Use no fim do ano."
              confirmar="Encerrar exercício"
            />
          )}
        </div>
      )}
    </section>
  );
}

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
  const arvore = arvoreMensal(prev);
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
            <SeletorAno anos={prev.anos} atual={prev.ano} href={(a) => `/orcamento/previsao?ano=${a}`} />
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
          <SituacaoDoExercicio
            ano={prev.ano}
            situacao={prev.exercicio.situacao}
            aprovadoEm={prev.exercicio.aprovadoEm}
            fontesADefinir={t.aDefinir.itens}
            valorADefinir={t.aDefinir.valor}
            propostas={prev.propostasPendentes}
            ajustes={prev.ajustesPendentes}
            podeAprovar={usuario.autorizador.temPermissao('orcamento.exercicio.aprovar')}
          />
          {prev.avisoFolha && <Aviso tipo="info">{prev.avisoFolha}</Aviso>}

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
              <TabelaMensal
                ano={prev.ano}
                receita={arvore.receita}
                despesa={arvore.despesa}
                resultado={{ mensal: t.receita.mensal.map((r, k) => Math.round((r - t.despesa.mensal[k]) * 100) / 100), anual: i.resultado }}
              />
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
