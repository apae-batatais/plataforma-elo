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

export const metadata: Metadata = { title: 'Avaliações' };

const br = (iso: string) => iso.split('-').reverse().join('/');

export default async function Avaliacoes({ searchParams }: { searchParams: Promise<{ q?: string; servico?: string }> }) {
  const sp = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo(PERM.avaliar)) redirect('/avaliacao/painel');
  const app = await obterAplicacao();
  const todas = await listarAvaliacoes(app.planilhas, usuario.autorizador);
  const servicos = [...new Map(todas.map((a) => [a.servico, a.servicoNome])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  const q = (sp.q ?? '').trim().toUpperCase();
  const lista = todas.filter((a) => (!sp.servico || a.servico === sp.servico) && (!q || a.iniciais.includes(q)));

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Avaliação Diagnóstica' }]}
        titulo="Avaliações"
        descricao="Questionários diagnósticos dos serviços em que você avalia. As pessoas aparecem só pelas iniciais, data de nascimento e sexo."
        acoes={
          <LinkBotao href="/avaliacao/nova" className={pequeno}>
            <IconeMais tamanho={16} /> Nova avaliação
          </LinkBotao>
        }
      />
      {todas.length === 0 ? (
        <EstadoVazio titulo="Nenhuma avaliação salva ainda" acao={<LinkBotao href="/avaliacao/nova">Fazer a primeira avaliação</LinkBotao>}>
          As avaliações salvas aparecem aqui e entram no painel.
        </EstadoVazio>
      ) : (
        <>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <label className="block text-sm">
              <span className="font-semibold">Iniciais</span>
              <input name="q" defaultValue={sp.q ?? ''} className={`${estiloEntrada} w-36`} autoComplete="off" />
            </label>
            <label className="block text-sm">
              <span className="font-semibold">Serviço atual</span>
              <select name="servico" defaultValue={sp.servico ?? ''} className={`${estiloEntrada} w-64`}>
                <option value="">Todos</option>
                {servicos.map(([c, n]) => (
                  <option key={c} value={c}>
                    {n}
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
                  <th scope="col" className={`${tabela.th} text-right`}>
                    Índice
                  </th>
                  <th scope="col" className={tabela.th}>
                    Dependência
                  </th>
                  <th scope="col" className={tabela.th}>
                    Avaliação
                  </th>
                  <th scope="col" className={tabela.th}>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lista.map((a) => (
                  <tr key={a.id} className={tabela.linha}>
                    <td className={tabela.td}>
                      <b>{a.iniciais}</b> · {br(a.nascimento)} · {a.sexo}
                      {a.idade !== null && <span className="text-texto-suave"> · {a.idade} anos</span>}
                    </td>
                    <td className={tabela.td}>{a.servicoNome}</td>
                    <td className={`${tabela.td} text-right tabular-nums`}>
                      {a.violacao && (
                        <span className="mr-2">
                          <Etiqueta tipo="erro">Violação</Etiqueta>
                        </span>
                      )}
                      <b>{a.indice}</b>
                    </td>
                    <td className={tabela.td}>Grau {a.grauDependencia}</td>
                    <td className={tabela.td}>{br(a.dataAvaliacao)}</td>
                    <td className={`${tabela.td} text-right`}>
                      <Link
                        href={`/avaliacao/${a.id}`}
                        className="font-semibold text-destaque underline-offset-2 hover:underline"
                        aria-label={`Abrir avaliação ${a.iniciais} ${br(a.nascimento)}`}
                      >
                        Abrir
                      </Link>
                      <span className="text-texto-suave" aria-hidden="true">
                        {' · '}
                      </span>
                      <Link
                        href={`/avaliacao/${a.id}/ficha`}
                        className="font-semibold text-destaque underline-offset-2 hover:underline"
                        aria-label={`Imprimir ficha de ${a.iniciais} ${br(a.nascimento)}`}
                      >
                        Ficha
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
