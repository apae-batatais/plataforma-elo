import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listarAplicacoes, PERM } from '@/modulos/saude/aplicacao/avaliacoes';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { LinkBotao, pequeno } from '@/ui/botao';
import { IconeMais } from '@/ui/icones';
import { CabecalhoPagina, EstadoVazio, Etiqueta, tabela } from '@/ui/pagina';

export const metadata: Metadata = { title: 'Avaliações de Saúde' };

const br = (iso: string) => iso.split('-').reverse().join('/');
const link = 'font-semibold text-destaque underline-offset-2 hover:underline';

export default async function AvaliacoesDeSaude() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo(PERM.avaliar)) redirect('/saude/sobre');
  const app = await obterAplicacao();
  const lista = await listarAplicacoes(app.planilhas, usuario.autorizador);
  return (
    <div className="space-y-5">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Saúde' }]}
        titulo="Avaliações de Saúde"
        descricao="Avaliações de evolução das pessoas atendidas nos serviços de Saúde em que você avalia."
        acoes={
          <LinkBotao href="/saude/nova" className={pequeno}>
            <IconeMais tamanho={16} /> Nova avaliação
          </LinkBotao>
        }
      />
      {lista.length === 0 ? (
        <EstadoVazio titulo="Nenhuma avaliação ainda" acao={<LinkBotao href="/saude/nova">Nova avaliação</LinkBotao>}>
          As avaliações aparecem aqui assim que você salvar a primeira. Use “Nova avaliação” para começar.
        </EstadoVazio>
      ) : (
        <div className={tabela.moldura}>
          <table className={tabela.tabela}>
            <caption className="sr-only">Avaliações de Saúde</caption>
            <thead className={tabela.cabeca}>
              <tr>
                <th scope="col" className={tabela.th}>Pessoa</th>
                <th scope="col" className={tabela.th}>Serviço</th>
                <th scope="col" className={tabela.th}>Período</th>
                <th scope="col" className={`${tabela.th} text-right`}>Total</th>
                <th scope="col" className={tabela.th}>Situação</th>
                <th scope="col" className={tabela.th}>Próxima avaliação</th>
                <th scope="col" className={tabela.th}><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((a) => (
                <tr key={a.id} className={tabela.linha}>
                  <td className={tabela.td}><b>{a.pessoaNome}</b></td>
                  <td className={tabela.td}>{a.servicoNome}</td>
                  <td className={tabela.td}>{br(a.periodoInicio)} a {br(a.periodoFim)}</td>
                  <td className={`${tabela.td} text-right tabular-nums`}>
                    {a.total === null ? <span className="text-texto-suave">—</span> : <b>{a.total}</b>}
                    {a.faixa && <span className="block text-xs text-texto-suave">{a.faixa}</span>}
                  </td>
                  <td className={tabela.td}>
                    {a.situacao === 'aberta' ? (
                      <Etiqueta tipo="atencao">Rascunho</Etiqueta>
                    ) : a.corrigida ? (
                      <Etiqueta tipo="neutro">Corrigida por outra</Etiqueta>
                    ) : a.cienteEm ? (
                      <Etiqueta tipo="sucesso">Com ciente</Etiqueta>
                    ) : (
                      <Etiqueta tipo="info">Concluída, sem ciente</Etiqueta>
                    )}
                  </td>
                  <td className={tabela.td}>{a.proximaAvaliacao ? br(a.proximaAvaliacao) : <span className="text-xs text-texto-suave">—</span>}</td>
                  <td className={`${tabela.td} whitespace-nowrap text-right`}>
                    <Link href={`/saude/${a.id}`} className={link} aria-label={`${a.situacao === 'aberta' ? 'Continuar' : 'Abrir'} avaliação de ${a.pessoaNome}, período de ${br(a.periodoInicio)} a ${br(a.periodoFim)}`}>
                      {a.situacao === 'aberta' ? 'Continuar' : 'Abrir'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
