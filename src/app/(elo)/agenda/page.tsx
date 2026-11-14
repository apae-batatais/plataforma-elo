import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { lerTabelas } from '@/nucleo/armazenamento/tabela';
import type { ItemDaAgenda } from '@/nucleo/modulos/agenda-busca';
import { Servicos } from '@/nucleo/estrutura/tabelas';
import { diaValido, diasDoMes, lerAgenda, mesValido, montarAgenda, nomeDoApp, somarMeses } from '@/plataforma/agenda';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { iconeDoApp } from '@/plataforma/icones-dos-apps';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { estiloBotao } from '@/ui/botao';
import { estiloEntrada } from '@/ui/campo';
import { GradeDoMes } from '@/ui/grade-do-mes';
import { ICONES } from '@/ui/icones';
import { NumeroQueConta } from '@/ui/numero-que-conta';
import { CabecalhoPagina, EstadoVazio, Etiqueta, Secao } from '@/ui/pagina';
import { SelecaoAutomatica } from '@/ui/selecao-automatica';

export const metadata: Metadata = { title: 'Agenda' };

type Params = { visao?: string; mes?: string; app?: string; servico?: string; dia?: string };

const dataCurta = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const nomeDoMes = (m: string) => new Date(`${m}-01T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const soNomeDoMes = (m: string) => new Date(`${m}-01T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' });

function quando(i: ItemDaAgenda): string {
  if (i.data === null) return soNomeDoMes(i.mes!);
  if (i.ate) return `${dataCurta(i.data)} a ${dataCurta(i.ate)}`;
  return dataCurta(i.data);
}

function LinhaDoItem({ item, vencido = false }: { item: ItemDaAgenda; vencido?: boolean }) {
  const Icone = ICONES[iconeDoApp(item.app)];
  return (
    <li data-app={item.app}>
      <Link
        href={item.href}
        className="cartao-brilho flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-borda bg-superficie px-3 py-2 hover:bg-superficie-2"
      >
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-destaque">
          <Icone tamanho={18} />
          {nomeDoApp(item.app)}
        </span>
        <span className="min-w-0 flex-1 font-medium text-texto">{item.titulo}</span>
        {vencido && <Etiqueta tipo="erro">Vencido</Etiqueta>}
        <span className="text-sm tabular-nums text-texto-suave">{quando(item)}</span>
      </Link>
    </li>
  );
}

function Lista({ itens, vencido = false }: { itens: ItemDaAgenda[]; vencido?: boolean }) {
  return (
    <ul className="space-y-2">
      {itens.map((i, k) => (
        <LinhaDoItem key={`${i.href}-${i.tipo}-${k}`} item={i} vencido={vencido} />
      ))}
    </ul>
  );
}

export default async function Agenda({ searchParams }: { searchParams: Promise<Params> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (usuario.estruturaPendente) redirect('/admin/estrutura');
  const { planilhas } = await obterAplicacao();
  const q = await searchParams;
  const lida = await lerAgenda(planilhas, usuario.autorizador);
  const mesDeHoje = lida.hoje.slice(0, 7);
  const mes = mesValido(q.mes) ? q.mes : mesDeHoje;
  const visao = q.visao === 'mes' ? 'mes' : 'lista';
  const dia = diaValido(q.dia) && q.dia.startsWith(mes) ? q.dia : undefined;

  // Filtros inválidos voltam ao padrão, sem erro.
  const todos = montarAgenda(lida.itens, { mes }, lida.hoje);
  const app = todos.apps.some((a) => a.id === q.app) ? q.app : undefined;
  const servico = todos.servicos.includes(q.servico ?? '') ? q.servico : undefined;
  const a = montarAgenda(lida.itens, { mes, app, servico, dia }, lida.hoje);
  const nomesDosServicos = new Map((await lerTabelas(planilhas, [Servicos] as const))[0].todos().map((s) => [s.codigo, s.nome]));

  const href = (m: Partial<Params>) => {
    const novo = { visao: visao === 'mes' ? 'mes' : undefined, mes: mes !== mesDeHoje ? mes : undefined, app, servico, dia, ...m };
    const qs = new URLSearchParams(Object.entries(novo).filter(([, v]) => v) as [string, string][]);
    return `/agenda${qs.size ? `?${qs}` : ''}`;
  };
  const semFiltros = href({ app: undefined, servico: undefined, dia: undefined });
  const pilha = (ativa: boolean) =>
    `inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${
      ativa ? 'border-destaque bg-destaque text-sobre-destaque' : 'border-borda-forte bg-superficie hover:bg-destaque-suave'
    }`;
  const segmento = (ativo: boolean) =>
    `inline-flex min-h-9 items-center rounded-md px-3 py-1 text-sm font-semibold ${
      ativo ? 'bg-superficie text-texto shadow-[0_1px_2px_rgb(0_0_0/0.12)] ring-1 ring-borda' : 'text-texto-suave hover:text-texto'
    }`;

  if (lida.itens.length === 0 && lida.falhas.length === 0)
    return (
      <div className="space-y-6">
        <CabecalhoPagina trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Agenda' }]} titulo="Agenda da instituição" />
        <EstadoVazio titulo="Você ainda não tem acesso a nenhum app com datas.">
          Fale com a administração para pedir acesso a Projetos, Parcerias, Comunicação, Avaliação ou Requisições.
        </EstadoVazio>
      </div>
    );

  const diaAberto = dia ? (a.porDia.get(dia) ?? []) : [];
  const dias = diasDoMes(mes).map((d) => ({
    dia: d,
    href: href({ visao: 'mes', dia: d }),
    itens: (a.porDia.get(d) ?? []).map((i) => ({ app: i.app, icone: iconeDoApp(i.app), nomeDoApp: nomeDoApp(i.app), titulo: i.titulo })),
  }));
  const maisVencidos = a.vencidos.slice(10);

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Agenda' }]}
        titulo="Agenda da instituição"
        descricao="Tudo o que vence ou acontece nos apps que você acessa, num lugar só. Cada item leva ao registro."
      />

      {lida.falhas.map((f) => (
        <Aviso key={f} tipo="atencao">
          Não foi possível ler: {f}. Os outros apps aparecem normalmente.
        </Aviso>
      ))}

      {a.vencidos.length > 0 && (
        <Secao
          id="vencidos"
          titulo={
            <span className="flex flex-wrap items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums text-erro">
                <NumeroQueConta texto={String(a.vencidos.length)} />
              </span>
              <span>{a.vencidos.length === 1 ? 'vencido esperando você' : 'vencidos esperando você'}</span>
            </span>
          }
        >
          <Aviso tipo="erro" titulo="Estes prazos já passaram e o item continua em aberto.">
            Abra cada item para resolver.
          </Aviso>
          <div className="mt-3">
            <Lista itens={a.vencidos.slice(0, 10)} vencido />
            {maisVencidos.length > 0 && (
              <details className="mt-2">
                <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-destaque">Mostrar todos os {a.vencidos.length}</summary>
                <Lista itens={maisVencidos} vencido />
              </details>
            )}
          </div>
        </Secao>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Mês" className="flex items-center gap-2">
          <Link href={href({ mes: somarMeses(mes, -1), dia: undefined })} className={estiloBotao('secundario')} aria-label="Mês anterior">
            ← Anterior
          </Link>
          <h2 className="min-w-40 text-center text-lg font-bold capitalize" aria-live="polite">
            {nomeDoMes(mes)}
          </h2>
          <Link href={href({ mes: somarMeses(mes, 1), dia: undefined })} className={estiloBotao('secundario')} aria-label="Próximo mês">
            Próximo →
          </Link>
          {mes !== mesDeHoje && (
            <Link href={href({ mes: undefined, dia: undefined })} className={estiloBotao('secundario')}>
              Hoje
            </Link>
          )}
        </nav>
        <nav aria-label="Visão" className="inline-flex rounded-lg border border-borda bg-superficie-2 p-0.5">
          <Link href={href({ visao: undefined })} aria-current={visao === 'lista' ? 'page' : undefined} className={segmento(visao === 'lista')}>
            Lista
          </Link>
          <Link href={href({ visao: 'mes' })} aria-current={visao === 'mes' ? 'page' : undefined} className={`hidden md:inline-flex ${segmento(visao === 'mes').replace('inline-flex', '')}`}>
            Mês
          </Link>
        </nav>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <ul className="flex flex-wrap gap-2" aria-label="Filtrar por app">
          <li>
            <Link href={href({ app: undefined })} aria-current={!app ? 'true' : undefined} className={pilha(!app)}>
              Todos os apps
            </Link>
          </li>
          {todos.apps.map((x) => {
            const Icone = ICONES[iconeDoApp(x.id)];
            return (
              <li key={x.id}>
                <Link href={href({ app: x.id })} aria-current={app === x.id ? 'true' : undefined} className={pilha(app === x.id)}>
                  <Icone tamanho={16} />
                  {x.nome}
                </Link>
              </li>
            );
          })}
        </ul>
        {todos.servicos.length > 0 && (
          <form method="get" action="/agenda" className="flex items-center gap-2">
            {visao === 'mes' && <input type="hidden" name="visao" value="mes" />}
            {mes !== mesDeHoje && <input type="hidden" name="mes" value={mes} />}
            {app && <input type="hidden" name="app" value={app} />}
            <label htmlFor="servico" className="text-sm font-semibold">
              Serviço
            </label>
            <SelecaoAutomatica id="servico" name="servico" defaultValue={servico ?? ''} className={`${estiloEntrada} !mt-0 w-auto`}>
              <option value="">Todos os serviços</option>
              {todos.servicos.map((s) => (
                <option key={s} value={s}>
                  {nomesDosServicos.get(s) ?? s}
                </option>
              ))}
            </SelecaoAutomatica>
            <noscript>
              <button className={estiloBotao('secundario')}>Aplicar</button>
            </noscript>
          </form>
        )}
      </div>

      {a.filtroEsvaziou ? (
        <EstadoVazio titulo="Nada com este filtro." acao={<Link href={semFiltros} className={estiloBotao('secundario')}>Limpar filtros</Link>}>
          Há itens neste mês, mas nenhum com o app ou o serviço escolhido.
        </EstadoVazio>
      ) : a.semItensNoMes ? (
        <EstadoVazio titulo={`Nada vence em ${soNomeDoMes(mes)}.`} acao={<Link href={href({ mes: somarMeses(mes, 1), dia: undefined })} className={estiloBotao('secundario')}>Ver o mês seguinte</Link>}>
          Os itens dos seus apps que têm data neste mês aparecem aqui.
        </EstadoVazio>
      ) : (
        <>
          {visao === 'mes' && (
            <div className="hidden md:block">
              <GradeDoMes mes={mes} dias={dias} hoje={lida.hoje} diaAberto={dia} />
              {dia && (
                <div className="mt-4">
                  <Secao id="dia-aberto" titulo={`${dataCurta(dia)}`}>
                    {diaAberto.length === 0 ? <p className="text-texto-suave">Nada marcado neste dia.</p> : <Lista itens={diaAberto} />}
                  </Secao>
                </div>
              )}
            </div>
          )}
          <div className={visao === 'mes' ? 'md:hidden' : ''}>
            <div className="space-y-6">
              {a.soMes.length > 0 && (
                <Secao id="neste-mes" titulo="Neste mês" descricao="Itens que têm só o mês, sem um dia marcado.">
                  <Lista itens={a.soMes} />
                </Secao>
              )}
              {a.doMes.length > 0 && (
                <Secao id="por-data" titulo="Por data">
                  <Lista itens={a.doMes} />
                </Secao>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
