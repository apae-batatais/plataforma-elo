import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listarAvaliacoes, PERM } from '@/modulos/avaliacao/aplicacao/avaliacoes';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { LinkBotao, pequeno } from '@/ui/botao';
import { estiloEntrada } from '@/ui/campo';
import { IconeMais } from '@/ui/icones';
import { CabecalhoPagina, EstadoVazio, Etiqueta, tabela } from '@/ui/pagina';
import { NumeroQueConta } from '@/ui/numero-que-conta';
import { PiscaOndeMudou } from '@/ui/pisca-onde-mudou';

export const metadata: Metadata = { title: 'Avaliações' };

const br = (iso: string) => iso.split('-').reverse().join('/');
const link = 'font-semibold text-destaque underline-offset-2 hover:underline';

const VISOES = {
  todas: 'Todas as avaliações',
  pessoas: 'Só a mais recente de cada pessoa',
  atrasadas: 'Reavaliação atrasada',
  vencem: 'Reavaliação vence em até 30 dias',
} as const;
type Visao = keyof typeof VISOES;

export default async function Avaliacoes({ searchParams }: { searchParams: Promise<{ q?: string; servico?: string; ver?: string }> }) {
  const sp = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo(PERM.avaliar)) redirect('/avaliacao/painel');
  const app = await obterAplicacao();
  const todas = await listarAvaliacoes(app.planilhas, usuario.autorizador);
  const servicos = [...new Map(todas.map((a) => [a.servico, a.servicoNome])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  const ver: Visao = sp.ver && sp.ver in VISOES ? (sp.ver as Visao) : 'todas';
  const q = (sp.q ?? '').trim().toUpperCase();
  const atrasadas = todas.filter((a) => a.reavaliacao?.situacao === 'atrasada').length;
  const vencem = todas.filter((a) => a.reavaliacao?.situacao === 'vence_em_breve').length;
  const lista = todas.filter(
    (a) =>
      (!sp.servico || a.servico === sp.servico) &&
      (!q || a.iniciais.includes(q)) &&
      (ver === 'todas' ||
        (ver === 'pessoas' && a.reavaliacao !== null) ||
        (ver === 'atrasadas' && a.reavaliacao?.situacao === 'atrasada') ||
        (ver === 'vencem' && a.reavaliacao?.situacao === 'vence_em_breve')),
  );

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Avaliação de Serviços Sociais' }]}
        titulo="Avaliações"
        descricao="Avaliações iniciais e anuais dos serviços em que você avalia. As pessoas aparecem só pelas iniciais, data de nascimento e sexo."
        acoes={
          <>
            {todas.some((a) => !a.ligada) && (
              <LinkBotao href="/avaliacao/ligar" className={pequeno}>
                Ligar avaliações antigas
              </LinkBotao>
            )}
            <LinkBotao href="/avaliacao/nova" className={pequeno}>
              <IconeMais tamanho={16} /> Nova avaliação
            </LinkBotao>
          </>
        }
      />
      {todas.length === 0 ? (
        <EstadoVazio titulo="Nenhuma avaliação salva ainda" acao={<LinkBotao href="/avaliacao/nova">Fazer a primeira avaliação</LinkBotao>}>
          As avaliações salvas aparecem aqui e entram no painel.
        </EstadoVazio>
      ) : (
        <>
          {(atrasadas > 0 || vencem > 0) && (
            <div className="flex flex-wrap gap-3">
              {atrasadas > 0 && (
                <Link
                  href="/avaliacao?ver=atrasadas"
                  className="rounded-cartao border border-erro bg-superficie px-4 py-2.5 hover:shadow-[0_0_0_3px_var(--erro-fundo)]"
                >
                  <span className="block text-2xl font-bold text-erro tabular-nums">
                    <NumeroQueConta texto={String(atrasadas)} chave="atrasadas" />
                  </span>
                  <span className="text-sm">{atrasadas === 1 ? 'pessoa com reavaliação anual atrasada' : 'pessoas com reavaliação anual atrasada'}</span>
                </Link>
              )}
              {vencem > 0 && (
                <Link
                  href="/avaliacao?ver=vencem"
                  className="rounded-cartao border border-aviso bg-superficie px-4 py-2.5 hover:shadow-[0_0_0_3px_var(--aviso-fundo)]"
                >
                  <span className="block text-2xl font-bold text-aviso tabular-nums">
                    <NumeroQueConta texto={String(vencem)} chave="vencem" />
                  </span>
                  <span className="text-sm">{vencem === 1 ? 'reavaliação vence em até 30 dias' : 'reavaliações vencem em até 30 dias'}</span>
                </Link>
              )}
            </div>
          )}
          <form method="get" className="flex flex-wrap items-end gap-3">
            <label className="block text-sm">
              <span className="font-semibold">Iniciais</span>
              <input name="q" defaultValue={sp.q ?? ''} className={`${estiloEntrada} w-32`} autoComplete="off" />
            </label>
            <label className="block text-sm">
              <span className="font-semibold">Serviço atual</span>
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
              <span className="font-semibold">Mostrar</span>
              <select name="ver" defaultValue={ver} className={`${estiloEntrada} w-72`}>
                {Object.entries(VISOES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="min-h-10 rounded-md border border-borda-forte px-4 font-semibold hover:border-texto-suave">
              Filtrar
            </button>
            <p className="ml-auto text-sm text-texto-suave">
              {lista.length === todas.length ? `${todas.length} avaliações` : `${lista.length} de ${todas.length} avaliações`}
            </p>
          </form>
          <div className={tabela.moldura}>
            <table className={tabela.tabela}>
              <caption className="sr-only">Avaliações salvas</caption>
              <thead className={tabela.cabeca}>
                <tr>
                  <th scope="col" className={tabela.th}>
                    Identificação
                  </th>
                  <th scope="col" className={tabela.th}>
                    Serviço atual
                  </th>
                  <th scope="col" className={tabela.th}>
                    Avaliação
                  </th>
                  <th scope="col" className={`${tabela.th} text-right`}>
                    Índice
                  </th>
                  <th scope="col" className={tabela.th}>
                    Próxima avaliação
                  </th>
                  <th scope="col" className={tabela.th}>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lista.map((a) => (
                  <PiscaOndeMudou key={a.id} chave={`avaliacao:${a.id}`} como="tr" className={tabela.linha}>
                    <td className={tabela.td}>
                      <b>{a.iniciais}</b> · {br(a.nascimento)} · {a.sexo}
                      {a.idade !== null && <span className="text-texto-suave"> · {a.idade} anos</span>}
                    </td>
                    <td className={tabela.td}>{a.servicoNome}</td>
                    <td className={tabela.td}>
                      {br(a.dataAvaliacao)}
                      <span className="block text-xs text-texto-suave">{a.tipo}</span>
                    </td>
                    <td className={`${tabela.td} text-right tabular-nums`}>
                      {a.violacao && (
                        <span className="mr-2">
                          <Etiqueta tipo="erro">Violação</Etiqueta>
                        </span>
                      )}
                      <b>{a.indice}</b>
                      <span className="block text-xs text-texto-suave">grau {a.grauDependencia}</span>
                    </td>
                    <td className={tabela.td}>
                      {a.reavaliacao ? (
                        <>
                          {br(a.reavaliacao.vence)}
                          <span className="block">
                            {a.reavaliacao.situacao === 'atrasada' ? (
                              <Etiqueta tipo="erro">Atrasada</Etiqueta>
                            ) : a.reavaliacao.situacao === 'vence_em_breve' ? (
                              <Etiqueta tipo="atencao">Vence em breve</Etiqueta>
                            ) : (
                              <span className="text-xs text-texto-suave">em dia</span>
                            )}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-texto-suave">avaliação anterior</span>
                      )}
                    </td>
                    <td className={`${tabela.td} whitespace-nowrap text-right`}>
                      <Link
                        href={`/avaliacao/${a.id}`}
                        className={link}
                        aria-label={`Abrir avaliação ${a.iniciais} ${br(a.nascimento)} de ${br(a.dataAvaliacao)}`}
                      >
                        Abrir
                      </Link>
                      <span className="text-texto-suave" aria-hidden="true">
                        {' · '}
                      </span>
                      <Link href={`/avaliacao/${a.id}/ficha`} className={link} aria-label={`Imprimir ficha de ${a.iniciais} ${br(a.nascimento)}`}>
                        Ficha
                      </Link>
                      {a.avaliacoesDaPessoa > 1 && (
                        <>
                          <span className="text-texto-suave" aria-hidden="true">
                            {' · '}
                          </span>
                          <Link
                            href={`/avaliacao/${a.id}/comparativo`}
                            className={link}
                            aria-label={`Comparar as ${a.avaliacoesDaPessoa} avaliações de ${a.iniciais} ${br(a.nascimento)}`}
                          >
                            Comparar ({a.avaliacoesDaPessoa})
                          </Link>
                        </>
                      )}
                      {a.reavaliacao && a.reavaliacao.situacao !== 'em_dia' && (
                        <>
                          <span className="text-texto-suave" aria-hidden="true">
                            {' · '}
                          </span>
                          <Link href={`/avaliacao/nova?de=${a.id}`} className={link}>
                            Reavaliar
                          </Link>
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
