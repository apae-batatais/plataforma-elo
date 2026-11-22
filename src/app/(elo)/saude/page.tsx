import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listarAplicacoes, PERM } from '@/modulos/saude/aplicacao/avaliacoes';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { estiloBotao, LinkBotao, pequeno } from '@/ui/botao';
import { estiloEntrada } from '@/ui/campo';
import { IconeMais } from '@/ui/icones';
import { CabecalhoPagina, EstadoVazio, Etiqueta, tabela } from '@/ui/pagina';

export const metadata: Metadata = { title: 'Avaliações de Saúde' };

const br = (iso: string) => iso.split('-').reverse().join('/');
const link = 'font-semibold text-destaque underline-offset-2 hover:underline';

type Busca = { servico?: string; faixa?: string; situacao?: string };

export default async function AvaliacoesDeSaude({ searchParams }: { searchParams: Promise<Busca> }) {
  const filtro = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo(PERM.avaliar)) redirect('/saude/sobre');
  const app = await obterAplicacao();
  const todas = await listarAplicacoes(app.planilhas, usuario.autorizador);
  const atrasadas = todas.filter((a) => a.reavaliacao === 'atrasada').length;
  const vencendo = todas.filter((a) => a.reavaliacao === 'vence_em_breve').length;
  const servicos = [...new Map(todas.map((a) => [a.servico, a.servicoNome])).entries()];
  const faixas = [...new Set(todas.map((a) => a.faixa).filter((x): x is string => !!x))];
  const lista = todas.filter(
    (a) =>
      (!filtro.servico || a.servico === filtro.servico) &&
      (!filtro.faixa || a.faixa === filtro.faixa) &&
      (!filtro.situacao || (filtro.situacao === 'rascunho' ? a.situacao === 'aberta' : a.reavaliacao === filtro.situacao)),
  );
  const filtrando = Boolean(filtro.servico || filtro.faixa || filtro.situacao);
  return (
    <div className="space-y-5">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Avaliações' }, { rotulo: 'Saúde' }]}
        titulo="Avaliações de Saúde"
        descricao="Avaliações de evolução das pessoas atendidas nos serviços de Saúde em que você avalia."
        acoes={
          <LinkBotao href="/saude/nova" className={pequeno}>
            <IconeMais tamanho={16} /> Nova avaliação
          </LinkBotao>
        }
      />
      {todas.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/saude?situacao=atrasada" className="cartao-brilho rounded-cartao border border-borda bg-superficie p-4">
            <span className="block text-3xl font-bold tabular-nums">{atrasadas}</span>
            <span className="text-sm">{atrasadas === 1 ? 'reavaliação atrasada' : 'reavaliações atrasadas'}</span>
          </Link>
          <Link href="/saude?situacao=vence_em_breve" className="cartao-brilho rounded-cartao border border-borda bg-superficie p-4">
            <span className="block text-3xl font-bold tabular-nums">{vencendo}</span>
            <span className="text-sm">{vencendo === 1 ? 'vence' : 'vencem'} nos próximos 30 dias</span>
          </Link>
        </div>
      )}
      {todas.length > 0 && (
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block font-semibold">Serviço</span>
            <select name="servico" defaultValue={filtro.servico ?? ''} className={estiloEntrada}>
              <option value="">Todos</option>
              {servicos.map(([cod, nome]) => <option key={cod} value={cod}>{nome}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="block font-semibold">Faixa</span>
            <select name="faixa" defaultValue={filtro.faixa ?? ''} className={estiloEntrada}>
              <option value="">Todas</option>
              {faixas.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="block font-semibold">Situação</span>
            <select name="situacao" defaultValue={filtro.situacao ?? ''} className={estiloEntrada}>
              <option value="">Todas</option>
              <option value="atrasada">Reavaliação atrasada</option>
              <option value="vence_em_breve">Vence em 30 dias</option>
              <option value="rascunho">Rascunho</option>
            </select>
          </label>
          <button type="submit" className={estiloBotao('secundario', pequeno)}>Filtrar</button>
          {filtrando && <Link href="/saude" className={link}>Limpar filtros</Link>}
        </form>
      )}
      {lista.length === 0 && todas.length > 0 ? (
        <EstadoVazio titulo="Nenhuma avaliação com estes filtros" acao={<LinkBotao href="/saude" variante="secundario">Limpar filtros</LinkBotao>}>
          Tire um filtro para ver mais avaliações.
        </EstadoVazio>
      ) : lista.length === 0 ? (
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
                  <td className={tabela.td}>
                    {a.proximaAvaliacao ? br(a.proximaAvaliacao) : <span className="text-xs text-texto-suave">—</span>}
                    {a.reavaliacao === 'atrasada' && <span className="block"><Etiqueta tipo="erro">Atrasada</Etiqueta></span>}
                    {a.reavaliacao === 'vence_em_breve' && <span className="block"><Etiqueta tipo="atencao">Vence em breve</Etiqueta></span>}
                  </td>
                  <td className={`${tabela.td} whitespace-nowrap text-right`}>
                    <Link href={`/saude/${a.id}`} className={link} aria-label={`${a.situacao === 'aberta' ? 'Continuar' : 'Abrir'} avaliação de ${a.pessoaNome}, período de ${br(a.periodoInicio)} a ${br(a.periodoFim)}`}>
                      {a.situacao === 'aberta' ? 'Continuar' : 'Abrir'}
                    </Link>
                    {a.situacao === 'fechada' && !a.corrigida && (
                      <>
                        {' · '}
                        <Link href={`/saude/${a.id}/comparativo`} className={link} aria-label={`Comparar períodos de ${a.pessoaNome}`}>Comparar</Link>
                        {a.reavaliacao && (
                          <>
                            {' · '}
                            <Link href={`/saude/nova?pessoa=${encodeURIComponent(a.pessoaId)}`} className={link} aria-label={`Reavaliar ${a.pessoaNome}`}>Reavaliar</Link>
                          </>
                        )}
                      </>
                    )}
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
