import type { Metadata } from 'next';
import { maiusculaInicial } from '@/ui/texto';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { indicadoresComunicacao } from '@/modulos/comunicacao/aplicacao/indicadores';
import { resultadoDasPostagens } from '@/modulos/comunicacao/aplicacao/resultados';
import { NOME_TIPO_PUBLICACAO, tituloDoAlcance } from '@/modulos/comunicacao/dominio/resultado';
import { periodoDe } from '@/modulos/comunicacao/dominio/indicadores';
import { NOME_TIPO_PECA, TIPOS_PECA } from '@/modulos/comunicacao/dominio/pedido';
import { diaEmBrasilia } from '@/modulos/comunicacao/dominio/prazos';
import { dataCurta, mesValido, somarMeses } from '@/modulos/comunicacao/telas/mes';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { estiloBotao } from '@/ui/botao';
import { BarrasHorizontais } from '@/ui/graficos';
import { CabecalhoPagina, EstadoVazio, Secao } from '@/ui/pagina';
import { TabelaDados } from '@/ui/tabela-dados';

export const metadata: Metadata = { title: 'Indicadores da Comunicação' };

type Tipo = 'mes' | 'trimestre' | 'ano';
const TIPOS: { valor: Tipo; rotulo: string; meses: number }[] = [
  { valor: 'mes', rotulo: 'Mês', meses: 1 },
  { valor: 'trimestre', rotulo: 'Trimestre', meses: 3 },
  { valor: 'ano', rotulo: 'Ano', meses: 12 },
];

const numero = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const dias = (v: number | null) => (v === null ? '—' : `${numero(v)} ${v === 1 ? 'dia útil' : 'dias úteis'}`);
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function Cartao({ titulo, detalhe, alerta = false }: { titulo: string; detalhe: ReactNode; alerta?: boolean }) {
  return (
    <div className={`rounded-cartao border bg-superficie px-5 py-4 ${alerta ? 'border-erro' : 'border-borda'}`}>
      <dt className={`text-lg font-bold leading-snug ${alerta ? 'text-erro' : ''}`}>{titulo}</dt>
      <dd className="mt-1 text-sm text-texto-suave">{detalhe}</dd>
    </div>
  );
}

export default async function Indicadores({ searchParams }: { searchParams: Promise<{ tipo?: string; mes?: string }> }) {
  const sp = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissao('comunicacao.indicadores')) redirect('/comunicacao');
  const { planilhas } = await obterAplicacao();

  const tipo: Tipo = sp.tipo === 'trimestre' || sp.tipo === 'ano' ? sp.tipo : 'mes';
  const hoje = diaEmBrasilia(new Date());
  const mes = mesValido(sp.mes) ?? hoje.slice(0, 7);
  const periodo = periodoDe(tipo, mes);
  const r = await indicadoresComunicacao(planilhas, usuario.autorizador, periodo);
  const instagram = await resultadoDasPostagens(planilhas, usuario.autorizador, periodo);
  const passo = TIPOS.find((t) => t.valor === tipo)!.meses;
  const rotuloPeriodo = tipo === 'mes' ? new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${mes}-01T00:00:00Z`)) : periodo.rotulo;
  const endereco = (t: Tipo, m: string) => `/comunicacao/indicadores?tipo=${t}&mes=${m}`;
  const botaoNav = 'inline-flex min-h-11 items-center justify-center rounded-md border border-borda-forte bg-superficie px-3 text-sm font-semibold text-texto hover:bg-superficie-2';
  const { publicadosComAtraso: atraso } = r;
  const semDados = r.volume.total === 0 && r.temasSemPublicacao.length === 0 && atraso.publicados === 0;

  const barras = (itens: { nome: string; total: number }[], rotulo: string, descricao: string) => (
    <BarrasHorizontais categorias={itens.map((i) => i.nome)} series={[{ nome: 'Pedidos', valores: itens.map((i) => i.total), cor: 1 }]} formato="numero" rotuloCategoria={rotulo} descricao={descricao} />
  );
  const porTipo = TIPOS_PECA.map((t) => ({ nome: NOME_TIPO_PECA[t], total: r.volume.porTipo[t] }));

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Comunicação', href: '/comunicacao' }, { rotulo: 'Indicadores' }]}
        titulo="Indicadores"
        descricao="Volume de pedidos, prazos e cobertura do calendário. Os prazos contam dias úteis, de segunda a sexta."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Período" className="flex flex-wrap items-center gap-2">
          {TIPOS.map((t) => (
            <Link
              key={t.valor}
              href={endereco(t.valor, mes)}
              aria-current={tipo === t.valor ? 'page' : undefined}
              className={`inline-flex min-h-11 items-center rounded-md px-4 text-sm font-semibold ${tipo === t.valor ? 'bg-destaque text-sobre-destaque' : 'text-texto hover:bg-superficie-2'}`}
            >
              {t.rotulo}
            </Link>
          ))}
        </nav>
        <nav aria-label="Período mostrado" className="flex flex-wrap items-center gap-2">
          <Link href={endereco(tipo, somarMeses(mes, -passo))} className={botaoNav}>
            Anterior
          </Link>
          <h2 className="min-w-40 px-2 text-center text-lg font-bold">{maiusculaInicial(rotuloPeriodo)}</h2>
          <Link href={endereco(tipo, somarMeses(mes, passo))} className={botaoNav}>
            Seguinte
          </Link>
          <Link href={endereco(tipo, hoje.slice(0, 7))} className={estiloBotao('secundario', '!min-h-11')}>
            Hoje
          </Link>
        </nav>
      </div>

      {semDados && <p className="rounded-cartao border border-borda bg-superficie px-5 py-4 text-sm text-texto-suave">Nenhum pedido neste período.</p>}

      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Cartao titulo={`${plural(r.volume.total, 'pedido enviado', 'pedidos enviados')}`} detalhe="Contados pelo primeiro envio, no período." />
        <Cartao
          titulo={plural(r.urgentes, 'pedido urgente', 'pedidos urgentes')}
          detalhe="Enviados com data desejada mais perto que a antecedência mínima."
          alerta={r.urgentes > 0}
        />
        <Cartao
          titulo={atraso.percentual === null ? 'Nenhuma publicação no período' : `${numero(atraso.percentual)}% das publicações saíram depois da data desejada`}
          detalhe={atraso.publicados ? `${atraso.atrasados} de ${plural(atraso.publicados, 'publicada', 'publicadas')} (entrevistas não entram).` : 'Sem publicações para comparar.'}
          alerta={(atraso.percentual ?? 0) > 0}
        />
        <Cartao titulo={`Revisão: ${dias(r.tempoRevisao)}`} detalhe="Média do envio (ou reenvio) até a Comunicação sair da revisão." />
        <Cartao titulo={`Aprovação: ${dias(r.tempoAprovacao)}`} detalhe="Média de Aguardando aprovação até a decisão da coordenação." />
        <Cartao titulo={`Do pedido à publicação: ${dias(r.tempoPublicacao)}`} detalhe="Média do primeiro envio até Publicado ou Realizada." />
      </dl>

      <Secao
        titulo={
          r.temasSemPublicacao.length === 0
            ? 'Todos os temas do calendário que terminaram no período foram publicados'
            : `${plural(r.temasSemPublicacao.length, 'tema do calendário ficou', 'temas do calendário ficaram')} sem publicação`
        }
        descricao="Itens ativos do calendário que terminaram no período, sem nenhum pedido publicado ou realizado."
        id="t-sem-publicacao"
      >
        {r.temasSemPublicacao.length === 0 ? (
          <p className="text-sm text-texto-suave">Nada a cobrar neste período.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {r.temasSemPublicacao.map((t) => (
              <li key={t.id}>
                <span className="font-semibold">{t.tema}</span> · terminou em {dataCurta(t.fim)}
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao
        titulo="Resultado das postagens do Instagram"
        descricao="Números buscados sozinhos, uma vez por dia, nas postagens publicadas pelo Elo (até 90 dias depois de publicadas)."
        id="t-instagram"
      >
        {instagram.linhas.length === 0 ? (
          <EstadoVazio titulo="Nenhuma postagem com resultado neste período." />
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-base font-bold">{tituloDoAlcance(instagram.medias)}</h3>
              <BarrasHorizontais
                categorias={instagram.medias.map((m) => m.nome)}
                series={[{ nome: 'Alcance médio', valores: instagram.medias.map((m) => m.alcanceMedio), cor: 1 }]}
                formato="numero"
                rotuloCategoria="Tipo de peça"
                descricao="Alcance médio das postagens do Instagram no período, por tipo de peça"
                notas={instagram.medias.map((m) => plural(m.postagens, 'postagem', 'postagens'))}
              />
            </div>
            <TabelaDados
              legenda="Resultado de cada postagem do Instagram no período"
              colunas={[
                { chave: 'data', rotulo: 'Publicada em' },
                { chave: 'tipo', rotulo: 'Tipo de peça' },
                { chave: 'pedido', rotulo: 'Pedido' },
                { chave: 'alcance', rotulo: 'Alcance', tipo: 'numero' },
                { chave: 'curtidas', rotulo: 'Curtidas', tipo: 'numero' },
                { chave: 'comentarios', rotulo: 'Comentários', tipo: 'numero' },
                { chave: 'salvamentos', rotulo: 'Salvamentos', tipo: 'numero' },
              ]}
              linhas={instagram.linhas.map((l) => ({
                id: l.id,
                valores: { data: dataCurta(l.data), tipo: NOME_TIPO_PUBLICACAO[l.tipo], pedido: l.pedido, alcance: l.alcance, curtidas: l.curtidas, comentarios: l.comentarios, salvamentos: l.salvamentos },
              }))}
            />
          </div>
        )}
      </Secao>

      {r.volume.total > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Secao titulo="Pedidos por tipo de peça" id="t-tipo">
            {barras(porTipo, 'Tipo de peça', 'Pedidos enviados no período, por tipo de peça')}
          </Secao>
          <Secao titulo="Pedidos por área" id="t-area">
            {barras(r.areas, 'Área', 'Pedidos enviados no período, por área')}
          </Secao>
          <Secao titulo="Pedidos por tema do calendário" id="t-tema" className="lg:col-span-2">
            {barras(r.volume.porTema.map((t) => ({ nome: t.tema, total: t.total })), 'Tema', 'Pedidos enviados no período, por tema do calendário')}
          </Secao>
        </div>
      )}
    </div>
  );
}
