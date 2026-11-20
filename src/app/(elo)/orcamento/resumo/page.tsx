import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Fragment } from 'react';
import { manifesto } from '@/modulos/orcamento';
import { veResumoDaFolha } from '@/modulos/orcamento/aplicacao/entrada';
import { avisosDeCessao } from '@/modulos/orcamento/aplicacao/cedidos';
import { FaixaCessoes } from '@/modulos/orcamento/telas/faixa-cessoes';
import { resumoFolha } from '@/modulos/orcamento/aplicacao/folha';
import { pendenciaDeRealizado } from '@/modulos/orcamento/aplicacao/realizado';
import { menuDoUsuario } from '@/nucleo/modulos/registro';
import type { GrupoResumo } from '@/modulos/orcamento/dominio/folha';
import { MESES, reais, rotuloMes } from '@/modulos/orcamento/telas/formato';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { LinkBotao } from '@/ui/botao';
import { CabecalhoPagina, EstadoVazio, tabela } from '@/ui/pagina';
import { NumeroQueConta } from '@/ui/numero-que-conta';
import { PiscaOndeMudou } from '@/ui/pisca-onde-mudou';
import { Linhas } from '@/ui/graficos';
import { TabelaDados } from '@/ui/tabela-dados';

export const metadata: Metadata = { title: 'Resumo da folha' };

export default async function ResumoDaFolha({ searchParams }: { searchParams: Promise<{ mes?: string; visao?: string }> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!veResumoDaFolha(usuario.autorizador)) {
    // Quem não vê a folha (ex.: Compras) entra direto no primeiro item do seu menu.
    const [app] = menuDoUsuario([manifesto], usuario.autorizador.permissoes());
    redirect(app?.itens[0]?.href ?? '/');
  }
  const app = await obterAplicacao();
  const filtros = await searchParams;
  const r = await resumoFolha(app.planilhas, usuario.autorizador, Number(filtros.mes) || undefined);
  const caixa = filtros.visao === 'caixa';
  const hrefVisao = (v: 'custo' | 'caixa') => `/orcamento/resumo?${v === 'caixa' ? 'visao=caixa&' : ''}mes=${r.mes}`;
  // R11: lembrete de realizado do último mês fechado (some se a aba ainda não foi preparada).
  const avisosCessao = await avisosDeCessao(app.planilhas, usuario.autorizador).catch(() => null);
  const faltaRealizado = await pendenciaDeRealizado(app.planilhas, usuario.autorizador).catch(() => null);
  const i = r.mes - 1;
  const podeCorrigir = usuario.autorizador.temPermissao('orcamento.folha.editar');
  const pendentes = (r.alertas?.semRateio ?? 0) + (r.alertas?.foraDe100 ?? 0);
  const m = r.estudoMes;
  const a = r.estudoAno;
  const vazio = m.pessoas === 0 && a.totalGeral === 0;

  const Grupo = ({ mes, ano }: { mes: GrupoResumo; ano: GrupoResumo }) => (
    <tbody>
      <tr className="bg-destaque-suave/60">
        <th scope="rowgroup" colSpan={3} className="px-4 py-2.5 text-left text-sm font-bold">
          {mes.titulo}
        </th>
      </tr>
      {mes.linhas.map((l, k) => (
        <tr key={l.rotulo} className="border-b border-borda">
          <th scope="row" className="py-2 pl-8 pr-4 text-left font-normal">
            {l.rotulo}
          </th>
          <td className="px-4 py-2 text-right tabular-nums">{reais(l.valor)}</td>
          <td className="px-4 py-2 text-right tabular-nums text-texto-suave">{reais(ano.linhas[k].valor)}</td>
        </tr>
      ))}
      <tr className="border-b border-borda-forte">
        <th scope="row" className="py-2 pl-8 pr-4 text-left font-semibold">
          Total
        </th>
        <td className="px-4 py-2 text-right font-semibold tabular-nums">{reais(mes.total)}</td>
        <td className="px-4 py-2 text-right font-semibold tabular-nums">{reais(ano.total)}</td>
      </tr>
    </tbody>
  );
  const Destaque = ({ rotulo, mes, ano, forte }: { rotulo: string; mes: number; ano: number; forte?: boolean }) => (
    <tbody>
      <tr className={forte ? 'bg-lateral text-white' : 'bg-superficie-2'}>
        <th scope="row" className="px-4 py-3 text-left font-bold">
          {rotulo}
        </th>
        <td className="px-4 py-3 text-right font-bold tabular-nums">{reais(mes)}</td>
        <td className="px-4 py-3 text-right font-bold tabular-nums">{reais(ano)}</td>
      </tr>
    </tbody>
  );

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento' }, { rotulo: 'Resumo da folha' }]}
        titulo={`Resumo da folha ${r.ano}`}
        descricao={
          r.todasAsAreas
            ? 'O mesmo resumo da aba Estudo: remuneração, benefícios e encargos, no mês escolhido e no ano.'
            : 'Resumo da folha dos serviços do seu escopo, proporcional à lotação. Valores individuais não aparecem para o seu perfil.'
        }
        acoes={podeCorrigir ? <LinkBotao href="/orcamento/folha">Ver a folha completa</LinkBotao> : undefined}
      />

      {pendentes > 0 && (
        <Aviso
          tipo="atencao"
          titulo={`${pendentes} ${pendentes === 1 ? 'funcionário está' : 'funcionários estão'} sem lotação válida`}
          acao={podeCorrigir ? <LinkBotao href="/orcamento/lotacao?atalho=pendentes" variante="secundario">Corrigir na Lotação</LinkBotao> : undefined}
        >
          Eles entram no total da folha, mas não aparecem em nenhum serviço na tabela por serviço.
        </Aviso>
      )}

      {avisosCessao && <FaixaCessoes avisos={avisosCessao} />}
      {faltaRealizado && (
        <Aviso tipo="atencao" titulo="Falta informar o realizado">
          O realizado de {rotuloMes(faltaRealizado)} ainda não foi informado.{' '}
          <Link href={`/orcamento/execucao/realizado?mes=${faltaRealizado}`} className="underline">
            Informar agora
          </Link>
        </Aviso>
      )}

      <nav aria-label="Escolher o mês" className="-mx-1 overflow-x-auto px-1">
        <ul className="flex min-w-max gap-1 rounded-lg border border-borda bg-superficie p-1">
          {MESES.map((nome, k) => (
            <li key={nome}>
              <Link
                href={`/orcamento/resumo?${caixa ? 'visao=caixa&' : ''}mes=${k + 1}`}
                scroll={false}
                aria-current={k === i ? 'true' : undefined}
                className={`block rounded-md px-3 py-1.5 text-sm ${k === i ? 'bg-destaque font-semibold text-sobre-destaque' : 'text-texto-suave hover:bg-destaque-suave hover:text-texto'}`}
              >
                <span aria-hidden="true">{nome.slice(0, 3)}</span>
                <span className="sr-only">{nome}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <nav aria-label="Visão da folha" className="inline-flex rounded-lg border border-borda bg-superficie-2 p-0.5">
        {(['custo', 'caixa'] as const).map((v) => (
          <Link
            key={v}
            href={hrefVisao(v)}
            scroll={false}
            aria-current={(v === 'caixa') === caixa ? 'page' : undefined}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
              (v === 'caixa') === caixa ? 'bg-superficie text-texto shadow-[0_1px_2px_rgb(0_0_0/0.12)] ring-1 ring-borda' : 'text-texto-suave hover:text-texto'
            }`}
          >
            {v === 'caixa' ? 'Caixa' : 'Custo do mês'}
          </Link>
        ))}
      </nav>

      {caixa && !vazio && (
        <section aria-labelledby="t-caixa" className="space-y-4">
          {!r.caixa.calendarioConfigurado && (
            <Aviso tipo="info" titulo="Calendário de pagamentos no padrão">
              13º em novembro e dezembro, sem férias coletivas.{' '}
              {r.caixa.podeEditarCalendario ? (
                <Link href="/orcamento/parametros#calendario" className="underline">
                  Ajuste em Parâmetros
                </Link>
              ) : (
                'Quem cuida dos parâmetros pode ajustar.'
              )}
            </Aviso>
          )}
          <div>
            <h2 id="t-caixa" className="text-lg font-bold">
              {r.caixa.pico.valor > r.caixa.pico.media
                ? `A folha tem o maior pico em ${MESES[r.caixa.pico.mes - 1].toLowerCase()}: ${reais(r.caixa.pico.valor)}, ${reais(r.caixa.pico.valor - r.caixa.pico.media)} a mais que a média`
                : 'A folha sai de forma uniforme ao longo do ano'}
            </h2>
            <p className="text-sm text-texto-suave">Em que meses a folha pesa mais no caixa? O custo do mês divide 13º e férias em 12 partes; o caixa mostra quando o dinheiro sai.</p>
          </div>
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
            <Linhas
              categorias={MESES.map((n) => n.slice(0, 3))}
              series={[
                { nome: 'Custo do mês', valores: r.total.mensal, cor: 1 },
                { nome: 'Caixa', valores: r.caixa.mensal, cor: 2 },
              ]}
              formato="moeda"
              descricao={`Custo do mês e caixa da folha em cada mês de ${r.ano}. O maior valor de caixa é em ${MESES[r.caixa.pico.mes - 1]}, ${reais(r.caixa.pico.valor)}.`}
            />
            <aside className="space-y-3" aria-label="Pico de saída">
              <div className="rounded-cartao border border-borda bg-superficie px-5 py-4">
                <p className="text-sm text-texto-suave">Pico de saída · {MESES[r.caixa.pico.mes - 1].toLowerCase()}</p>
                <p className="mt-0.5 text-2xl font-bold tabular-nums"><NumeroQueConta texto={reais(r.caixa.pico.valor)} chave={`pico:${r.caixa.pico.mes}`} /></p>
                <p className="text-sm text-texto-suave">Guarde esse valor antes: 13º e férias coletivas pesam nesses meses.</p>
              </div>
              <div className="rounded-cartao border border-borda bg-superficie px-5 py-4">
                <p className="text-sm text-texto-suave">Total no ano</p>
                <p className="mt-0.5 text-2xl font-bold tabular-nums"><NumeroQueConta texto={reais(r.caixa.anual)} chave="caixa-ano" /></p>
                <p className="text-sm text-texto-suave">Custo do mês no ano: {reais(r.total.anual)}</p>
              </div>
            </aside>
          </div>
          <TabelaDados
            legenda="Caixa da folha por serviço, mês a mês"
            totalRotulo="Total"
            colunas={[
              { chave: 'servico', rotulo: 'Serviço' },
              ...MESES.map((n, k) => ({ chave: `m${k}`, rotulo: n.slice(0, 3), tipo: 'moeda' as const, somar: true })),
            ]}
            linhas={r.centros.map((c) => ({
              id: c.codigo,
              valores: { servico: c.nome, ...Object.fromEntries(c.caixa.map((v, k) => [`m${k}`, v])) },
            }))}
          />
        </section>
      )}

      {caixa && !vazio ? null : vazio ? (
        <EstadoVazio
          titulo={r.todasAsAreas ? 'Ainda não há folha registrada' : 'Nenhum serviço no seu escopo'}
          acao={podeCorrigir ? <LinkBotao href="/orcamento/importar">Importar a planilha da folha</LinkBotao> : undefined}
        >
          {r.todasAsAreas
            ? 'Importe a planilha da folha ou cadastre os funcionários um a um.'
            : 'Peça à administração da plataforma para ligar o seu perfil a um serviço, área ou unidade.'}
        </EstadoVazio>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className={tabela.moldura}>
            <table className={tabela.tabela}>
              <caption className="sr-only">Resumo da folha em {MESES[i]} e no ano</caption>
              <thead className={tabela.cabeca}>
                <tr>
                  <th scope="col" className={tabela.th}>
                    {m.pessoas} {m.pessoas === 1 ? 'pessoa' : 'pessoas'} em {MESES[i].toLowerCase()}
                  </th>
                  <th scope="col" className={`${tabela.th} text-right`}>
                    {MESES[i]}
                  </th>
                  <th scope="col" className={`${tabela.th} text-right`}>
                    Ano {r.ano}
                  </th>
                </tr>
              </thead>
              <Grupo mes={m.salarial} ano={a.salarial} />
              <Grupo mes={m.naoSalarial} ano={a.naoSalarial} />
              <Grupo mes={m.beneficios} ano={a.beneficios} />
              <Destaque rotulo="Subtotal: remuneração" mes={m.subtotalRemuneracao} ano={a.subtotalRemuneracao} />
              <Grupo mes={m.encargos} ano={a.encargos} />
              <Destaque rotulo="Subtotal: remuneração + encargos" mes={m.subtotalComEncargos} ano={a.subtotalComEncargos} />
              <tbody>
                <tr className="border-b border-borda">
                  <th scope="row" className="px-4 py-2.5 text-left font-semibold">
                    Indenizações trabalhistas
                  </th>
                  <td className="px-4 py-2.5 text-right tabular-nums">{reais(m.indenizacoes)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-texto-suave">{reais(a.indenizacoes)}</td>
                </tr>
              </tbody>
              <Destaque rotulo="Total geral" mes={m.totalGeral} ano={a.totalGeral} forte />
            </table>
          </div>

          <aside className="space-y-3 xl:sticky xl:top-6" aria-label="Totais">
            {[
              { rotulo: 'Total geral', v: m.totalGeral, ano: a.totalGeral, destaque: true },
              { rotulo: 'Total sem encargos', v: m.quadros.totalSemEncargos, ano: a.quadros.totalSemEncargos },
              {
                rotulo: 'Total CEBAS',
                v: m.quadros.totalCebas,
                ano: a.quadros.totalCebas,
                dica: 'Encargos isentos pelo CEBAS: INSS 20%, terceiros, FAP e aposentadoria especial.',
              },
              { rotulo: 'Total FGTS', v: m.quadros.totalFgts, ano: a.quadros.totalFgts },
              {
                rotulo: 'Total remuneração + FGTS',
                v: m.quadros.totalRemuneracaoMaisFgts,
                ano: a.quadros.totalRemuneracaoMaisFgts,
                dica: 'Total geral menos o Total CEBAS: o que a instituição efetivamente desembolsa.',
              },
            ].map((q) => (
              <div key={q.rotulo} className={`rounded-cartao border px-5 py-4 ${q.destaque ? 'border-lateral bg-lateral text-white' : 'border-borda bg-superficie'}`}>
                <p className={`text-sm ${q.destaque ? 'text-lateral-texto' : 'text-texto-suave'}`}>
                  {q.rotulo} · {MESES[i].toLowerCase()}
                </p>
                <p className="mt-0.5 text-2xl font-bold tabular-nums"><NumeroQueConta texto={reais(q.v)} chave={`quadro:${q.rotulo}:${i}`} /></p>
                <p className={`text-sm tabular-nums ${q.destaque ? 'text-lateral-texto' : 'text-texto-suave'}`}>{reais(q.ano)} no ano</p>
                {q.dica && <p className="mt-1.5 text-xs text-texto-suave">{q.dica}</p>}
              </div>
            ))}
          </aside>
        </div>
      )}

      {!caixa && r.centros.length > 0 && (
        <section aria-labelledby="t-servicos" className="space-y-3">
          <div>
            <h2 id="t-servicos" className="text-lg font-bold">
              Por serviço (lotação)
            </h2>
            <p className="text-sm text-texto-suave">Total geral, com encargos, dividido pela lotação de cada funcionário.</p>
          </div>
          <div className={tabela.moldura}>
            <table className={tabela.tabela}>
              <thead className={tabela.cabeca}>
                <tr>
                  <th scope="col" className={tabela.th}>
                    Área e serviço
                  </th>
                  <th scope="col" className={`${tabela.th} text-right`}>
                    {MESES[i]}
                  </th>
                  <th scope="col" className={`${tabela.th} text-right`}>
                    No ano
                  </th>
                </tr>
              </thead>
              {r.areas.map((ar) => (
                <Fragment key={ar.codigo}>
                  <tbody>
                    <tr className="border-b border-borda bg-destaque-suave/60">
                      <th scope="rowgroup" className="px-4 py-2.5 text-left font-bold">
                        {ar.nome}
                      </th>
                      <td className="px-4 py-2.5 text-right font-bold tabular-nums">{reais(ar.mensal[i])}</td>
                      <td className="px-4 py-2.5 text-right font-bold tabular-nums">{reais(ar.anual)}</td>
                    </tr>
                    {r.centros
                      .filter((c) => (c.codigo === '__sem_lotacao__' ? '__sem_lotacao__' : (c.area ?? '')) === ar.codigo)
                      .filter((c) => c.codigo !== '__sem_lotacao__')
                      .map((c) => (
                        <PiscaOndeMudou key={c.codigo} chave={`conta:${c.codigo}`} como="tr" className={tabela.linha}>
                          <th scope="row" className="py-2.5 pl-8 pr-4 text-left font-normal">
                            {c.nome}
                          </th>
                          <td className="px-4 py-2.5 text-right tabular-nums">{reais(c.mensal[i])}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-texto-suave">{reais(c.anual)}</td>
                        </PiscaOndeMudou>
                      ))}
                  </tbody>
                </Fragment>
              ))}
              <tfoot className="border-t-2 border-borda-forte">
                <tr>
                  <th scope="row" className="px-4 py-3 text-left font-bold">
                    Total
                  </th>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">{reais(r.total.mensal[i])}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">{reais(r.total.anual)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
