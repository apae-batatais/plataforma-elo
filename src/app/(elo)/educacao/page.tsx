import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listarAplicacoes, PERM } from '@/modulos/educacao/aplicacao/avaliacoes';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { LinkBotao, pequeno } from '@/ui/botao';
import { estiloEntrada } from '@/ui/campo';
import { IconeMais } from '@/ui/icones';
import { CabecalhoPagina, EstadoVazio, Etiqueta, tabela } from '@/ui/pagina';
import { PiscaOndeMudou } from '@/ui/pisca-onde-mudou';

export const metadata: Metadata = { title: 'Avaliações de Educação' };

const br = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '—');
const link = 'font-semibold text-destaque underline-offset-2 hover:underline';
const SITUACOES = { aberta: 'Rascunho (aberta)', fechada: 'Concluída', atrasada: 'Reavaliação atrasada', vence_em_breve: 'Vence em 30 dias' } as const;

export default async function Avaliacoes({ searchParams }: { searchParams: Promise<{ servico?: string; faixa?: string; situacao?: string }> }) {
  const sp = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo(PERM.avaliar)) redirect('/educacao/sobre');
  const app = await obterAplicacao();
  const todas = await listarAplicacoes(app.planilhas, usuario.autorizador);
  const servicos = [...new Map(todas.map((a) => [a.servico, a.servicoNome])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  const faixas = [...new Set(todas.map((a) => a.faixa).filter((f): f is string => Boolean(f)))];
  const lista = todas.filter((a) => (!sp.servico || a.servico === sp.servico) && (!sp.faixa || a.faixa === sp.faixa) && (!sp.situacao || a.situacao === sp.situacao || a.reavaliacao === sp.situacao));
  const abertas = todas.filter((a) => a.situacao === 'aberta').length;
  const atrasadas = todas.filter((a) => a.reavaliacao === 'atrasada').length;
  const vencendo = todas.filter((a) => a.reavaliacao === 'vence_em_breve').length;

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Avaliações' }, { rotulo: 'Educação' }]}
        titulo="Avaliações de Educação"
        descricao="Avaliações de evolução dos atendidos dos serviços de Educação em que você avalia, uma por período."
        acoes={
          <LinkBotao href="/educacao/nova" className={pequeno}>
            <IconeMais tamanho={16} /> Nova avaliação
          </LinkBotao>
        }
      />
      {todas.length === 0 ? (
        <EstadoVazio titulo="Nenhuma avaliação ainda" acao={<LinkBotao href="/educacao/nova">Nova avaliação</LinkBotao>}>
          Use “Nova avaliação” para começar. As avaliações salvas aparecem aqui.
        </EstadoVazio>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <Link href="/educacao?situacao=atrasada" className="rounded-cartao border border-borda-forte bg-superficie px-4 py-2.5 hover:border-texto-suave">
              <span className="block text-2xl font-bold tabular-nums text-destaque">{atrasadas}</span>
              <span className="text-sm">{atrasadas === 1 ? 'reavaliação atrasada' : 'reavaliações atrasadas'}</span>
            </Link>
            <Link href="/educacao?situacao=vence_em_breve" className="rounded-cartao border border-borda-forte bg-superficie px-4 py-2.5 hover:border-texto-suave">
              <span className="block text-2xl font-bold tabular-nums text-destaque">{vencendo}</span>
              <span className="text-sm">{vencendo === 1 ? 'vence' : 'vencem'} nos próximos 30 dias</span>
            </Link>
            {abertas > 0 && (
              <Link href="/educacao?situacao=aberta" className="rounded-cartao border border-borda-forte bg-superficie px-4 py-2.5 hover:border-texto-suave">
                <span className="block text-2xl font-bold tabular-nums text-destaque">{abertas}</span>
                <span className="text-sm">{abertas === 1 ? 'avaliação aberta para concluir' : 'avaliações abertas para concluir'}</span>
              </Link>
            )}
          </div>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <label className="block text-sm">
              <span className="font-semibold">Serviço</span>
              <select name="servico" defaultValue={sp.servico ?? ''} className={`${estiloEntrada} w-60`}>
                <option value="">Todos</option>
                {servicos.map(([c, n]) => (
                  <option key={c} value={c}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-semibold">Faixa</span>
              <select name="faixa" defaultValue={sp.faixa ?? ''} className={`${estiloEntrada} w-72`}>
                <option value="">Todas</option>
                {faixas.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-semibold">Situação</span>
              <select name="situacao" defaultValue={sp.situacao ?? ''} className={`${estiloEntrada} w-48`}>
                <option value="">Todas</option>
                {Object.entries(SITUACOES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="min-h-10 rounded-md border border-borda-forte px-4 font-semibold hover:border-texto-suave">
              Filtrar
            </button>
            <p className="ml-auto text-sm text-texto-suave">{lista.length === todas.length ? `${todas.length} avaliações` : `${lista.length} de ${todas.length} avaliações`}</p>
          </form>
          <div className={tabela.moldura}>
            <table className={tabela.tabela}>
              <caption className="sr-only">Avaliações de Educação</caption>
              <thead className={tabela.cabeca}>
                <tr>
                  <th scope="col" className={tabela.th}>Pessoa</th>
                  <th scope="col" className={tabela.th}>Serviço e instrumento</th>
                  <th scope="col" className={tabela.th}>Período avaliado</th>
                  <th scope="col" className={`${tabela.th} text-right`}>Total</th>
                  <th scope="col" className={tabela.th}>Faixa</th>
                  <th scope="col" className={tabela.th}>Situação</th>
                  <th scope="col" className={tabela.th}>Próxima avaliação</th>
                  <th scope="col" className={tabela.th}><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {lista.map((a) => (
                  <PiscaOndeMudou key={a.id} chave={`educacao:${a.id}`} como="tr" className={tabela.linha}>
                    <td className={tabela.td}><b>{a.pessoaNome}</b></td>
                    <td className={tabela.td}>
                      {a.servicoNome}
                      <span className="block text-xs text-texto-suave">{a.instrumentoNome}</span>
                    </td>
                    <td className={tabela.td}>{a.periodoInicio || a.periodoFim ? `${br(a.periodoInicio)} a ${br(a.periodoFim)}` : '—'}</td>
                    <td className={`${tabela.td} text-right tabular-nums`}>{a.total === null ? '—' : <><b>{a.total}</b> <span className="text-texto-suave">de 30</span></>}</td>
                    <td className={tabela.td}>{a.faixa ?? <span className="text-texto-suave">{a.respondidos} de {a.itens} itens</span>}</td>
                    <td className={tabela.td}>
                      <span className="flex flex-wrap gap-1">
                        {a.situacao === 'aberta' ? <Etiqueta tipo="atencao">Rascunho</Etiqueta> : <Etiqueta tipo="sucesso">Concluída</Etiqueta>}
                        {a.situacao === 'fechada' && (a.cienteDada ? <Etiqueta tipo="info">Com ciente</Etiqueta> : <Etiqueta>Sem ciente</Etiqueta>)}
                        {a.corrigida && <Etiqueta>Corrigida</Etiqueta>}
                        {a.ehCorrecao && <Etiqueta>Correção</Etiqueta>}
                      </span>
                    </td>
                    <td className={tabela.td}>
                      {a.proximaAvaliacao ? br(a.proximaAvaliacao) : <span className="text-xs text-texto-suave">—</span>}
                      {a.reavaliacao === 'atrasada' && <span className="block"><Etiqueta tipo="erro">Atrasada</Etiqueta></span>}
                      {a.reavaliacao === 'vence_em_breve' && <span className="block"><Etiqueta tipo="atencao">Vence em breve</Etiqueta></span>}
                    </td>
                    <td className={`${tabela.td} whitespace-nowrap text-right`}>
                      <Link href={`/educacao/${a.id}`} className={link} aria-label={`${a.situacao === 'aberta' ? 'Continuar' : 'Abrir'} avaliação de ${a.pessoaNome}`}>
                        {a.situacao === 'aberta' ? 'Continuar' : 'Abrir'}
                      </Link>
                      {a.situacao === 'fechada' && !a.corrigida && (
                        <>
                          {' · '}
                          <Link href={`/educacao/${a.id}/comparativo`} className={link} aria-label={`Comparar períodos de ${a.pessoaNome}`}>Comparar</Link>
                          {a.reavaliacao && (
                            <>
                              {' · '}
                              <Link href={`/educacao/nova?pessoa=${encodeURIComponent(a.pessoaId)}`} className={link} aria-label={`Reavaliar ${a.pessoaNome}`}>Reavaliar</Link>
                            </>
                          )}
                        </>
                      )}
                    </td>
                  </PiscaOndeMudou>
                ))}
              </tbody>
            </table>
            {lista.length === 0 && <p className="px-4 py-6 text-center text-texto-suave">Nenhuma avaliação com esses filtros.</p>}
          </div>
        </>
      )}
    </div>
  );
}
