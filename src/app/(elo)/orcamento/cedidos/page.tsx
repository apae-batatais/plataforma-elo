import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { avisosDeCessao, listarCedidos, type LinhaCedido } from '@/modulos/orcamento/aplicacao/cedidos';
import { ROTULO_TIPO_VALOR } from '@/modulos/orcamento/dominio/cedidos';
import { FaixaCessoes } from '@/modulos/orcamento/telas/faixa-cessoes';
import { data, reais } from '@/modulos/orcamento/telas/formato';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { estiloBotao, LinkBotao } from '@/ui/botao';
import { Campo, estiloEntrada } from '@/ui/campo';
import { IconeMais } from '@/ui/icones';
import { CabecalhoPagina, EstadoVazio, Etiqueta, tabela } from '@/ui/pagina';

export const metadata: Metadata = { title: 'Cedidos' };

const FILTROS = [
  { valor: '', rotulo: 'Ativos', f: (x: LinhaCedido) => x.situacao !== 'encerrada' },
  { valor: 'encerrados', rotulo: 'Encerrados', f: (x: LinhaCedido) => x.situacao === 'encerrada' },
  { valor: 'todos', rotulo: 'Todos', f: () => true },
];

export default async function Cedidos({ searchParams }: { searchParams: Promise<{ filtro?: string; q?: string }> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const a = usuario.autorizador;
  if (!a.temPermissao('orcamento.folha.ver_individual')) {
    return (
      <div>
        <CabecalhoPagina trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento' }, { rotulo: 'Cedidos' }]} titulo="Cedidos" />
        <Aviso tipo="info">
          Você não tem acesso aos valores por pessoa.{' '}
          <Link href="/orcamento" className="font-semibold text-destaque hover:underline">
            Ver os totais da folha
          </Link>
        </Aviso>
      </div>
    );
  }
  const app = await obterAplicacao();
  const f = await searchParams;
  const [r, avisos] = await Promise.all([listarCedidos(app.planilhas, a), avisosDeCessao(app.planilhas, a)]);
  const filtro = FILTROS.find((x) => x.valor === (f.filtro ?? '')) ?? FILTROS[0];
  const q = (f.q ?? '').trim().toLocaleLowerCase('pt-BR');
  const lista = r.cedidos.filter(filtro.f).filter((x) => !q || `${x.colaborador ?? ''} ${x.funcao}`.toLocaleLowerCase('pt-BR').includes(q));
  const link = (valor: string) => `/orcamento/cedidos${valor ? `?filtro=${valor}` : ''}`;

  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento' }, { rotulo: 'Cedidos' }]}
        titulo="Profissionais cedidos"
        descricao="Pessoas da equipe pagas por quem cede (poder público, empresa, outro). Não entram na folha nem no caixa. Dados pessoais: cada consulta fica registrada."
        acoes={
          <>
            {r.podeEditar && (
              <LinkBotao href="/orcamento/cedidos/novo">
                <IconeMais tamanho={16} />
                Adicionar cedido
              </LinkBotao>
            )}
            <LinkBotao href="/orcamento/cedidos/cedentes" variante="secundario">
              Quem cede
            </LinkBotao>
          </>
        }
      />
      <FaixaCessoes avisos={avisos} />

      <nav aria-label="Situação" className="mb-4">
        <ul className="flex gap-1 border-b border-borda">
          {FILTROS.map((x) => (
            <li key={x.valor}>
              <Link
                href={link(x.valor)}
                aria-current={x.valor === filtro.valor ? 'true' : undefined}
                className={`-mb-px flex items-center gap-2 border-b-[3px] px-3 py-2.5 text-sm ${x.valor === filtro.valor ? 'border-destaque font-semibold' : 'border-transparent text-texto-suave hover:text-texto'}`}
              >
                {x.rotulo}
                <span className="rounded-full bg-superficie-2 px-2 text-xs font-semibold tabular-nums text-texto-suave">{r.cedidos.filter(x.f).length}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <form className="mb-4 flex items-end gap-2">
        {f.filtro && <input type="hidden" name="filtro" value={f.filtro} />}
        <Campo rotulo="Buscar por nome ou função">
          <input name="q" defaultValue={f.q ?? ''} className={`${estiloEntrada} !min-h-9 !py-1.5`} />
        </Campo>
        <button className={estiloBotao('secundario', '!min-h-9')}>Buscar</button>
      </form>

      {lista.length === 0 ? (
        <EstadoVazio titulo={r.cedidos.length === 0 ? 'Nenhum profissional cedido ainda' : 'Ninguém aqui'}>
          {r.cedidos.length === 0 ? "Use 'Adicionar cedido' para começar." : 'Tente outro filtro ou outra busca.'}
        </EstadoVazio>
      ) : (
        <div className={tabela.moldura}>
          <table className={tabela.tabela}>
            <caption className="sr-only">Profissionais cedidos</caption>
            <thead className={tabela.cabeca}>
              <tr>
                {['Nome', 'Função', 'Quem cede', 'Serviços', 'Valor mensal', 'Fim previsto', 'Situação'].map((t) => (
                  <th key={t} scope="col" className={tabela.th}>
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((x) => (
                <tr key={x.id} className={tabela.linha}>
                  <th scope="row" className={`${tabela.td} text-left`}>
                    <Link href={`/orcamento/cedidos/${x.id}`} className="font-semibold text-destaque hover:underline">
                      {x.colaborador ?? 'Vaga cedida'}
                    </Link>
                  </th>
                  <td className={tabela.td}>{x.funcao}</td>
                  <td className={tabela.td}>{x.cedente}</td>
                  <td className={tabela.td}>{x.servicos.join(', ') || '—'}</td>
                  <td className={`${tabela.td} tabular-nums`}>
                    {x.valorMensal === null ? '—' : reais(x.valorMensal)}
                    {x.tipoValor && <span className="block text-xs text-texto-suave">{x.tipoValor === 'informado' ? 'Informado' : 'Equivalente'}</span>}
                  </td>
                  <td className={tabela.td}>{data(x.fimPrevisto)}</td>
                  <td className={tabela.td}>
                    <span className="flex flex-wrap gap-1">
                      <Etiqueta tipo={x.situacao === 'encerrada' ? 'neutro' : x.aviso?.vencida ? 'erro' : x.aviso ? 'atencao' : 'sucesso'}>
                        {x.situacao === 'encerrada' ? 'Encerrada' : x.aviso?.vencida ? 'Vencida' : x.situacao === 'futura' ? 'Ainda não começou' : 'Ativa'}
                      </Etiqueta>
                      {x.pendencias.includes('valor') && <Etiqueta tipo="atencao">falta valor</Etiqueta>}
                      {x.pendencias.includes('lotacao') && <Etiqueta tipo="atencao">falta lotação</Etiqueta>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-texto-suave">Tipos de valor: {Object.values(ROTULO_TIPO_VALOR).join(' · ')}. Sem valor ou sem lotação a pessoa fica fora dos totais.</p>
    </div>
  );
}
