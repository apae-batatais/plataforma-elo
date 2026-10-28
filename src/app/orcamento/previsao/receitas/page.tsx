import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { lerPrevisao, type LinhaReceita } from '@/modulos/orcamento/aplicacao/previsao';
import { CAPTACAO, NATUREZA, USO, type Captacao } from '@/modulos/orcamento/dominio/previsao';
import { faixaDeMeses, reais } from '@/modulos/orcamento/telas/formato';
import { FormularioItem } from '@/modulos/orcamento/telas/formulario-item';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { LinkBotao } from '@/ui/botao';
import { FormularioConfirmado } from '@/ui/confirmar';
import { CabecalhoPagina, EstadoVazio, Etiqueta, Secao, tabela } from '@/ui/pagina';
import { acaoCancelarItem, acaoSalvarReceita } from '../acoes';

export const metadata: Metadata = { title: 'Receitas' };
const pequeno = '!min-h-8 !px-3 !py-1 !text-sm';
const TIPO_CAPTACAO: Record<Captacao, 'sucesso' | 'info' | 'atencao'> = { garantida: 'sucesso', negociacao: 'info', a_captar: 'atencao' };

const resumoMeses = (d: { distribuicao: string; meses: number[] }) => (d.distribuicao === 'manual' ? `mês a mês: ${faixaDeMeses(d.meses)}` : faixaDeMeses(d.meses));

export default async function Receitas({ searchParams }: { searchParams: Promise<{ ano?: string; editar?: string }> }) {
  const sp = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const app = await obterAplicacao();
  const prev = await lerPrevisao(app.planilhas, usuario.autorizador, Number(sp.ano) || undefined);
  const base = `/orcamento/previsao/receitas?ano=${prev.ano}`;
  const emEdicao = sp.editar && prev.podeEditar ? prev.receitas.find((r) => r.id === sp.editar) : undefined;
  const porFonte = new Map<string, LinhaReceita[]>();
  for (const r of prev.receitas) porFonte.set(r.fonte_id, [...(porFonte.get(r.fonte_id) ?? []), r]);
  const total = prev.totais.receita.anual;

  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento/previsao' }, { rotulo: `Receitas ${prev.ano}` }]}
        titulo={`Receitas ${prev.ano}`}
        descricao="O que se espera receber, por fonte de recurso, e a situação da captação de cada receita."
        acoes={
          prev.anos.length > 1 ? (
            <nav aria-label="Exercício" className="flex gap-1">
              {prev.anos.map((a) => (
                <LinkBotao key={a} href={`/orcamento/previsao/receitas?ano=${a}`} variante={a === prev.ano ? 'primario' : 'secundario'} className={pequeno}>
                  {a}
                </LinkBotao>
              ))}
            </nav>
          ) : undefined
        }
      />

      {!prev.exercicio ? (
        <EstadoVazio titulo={`O exercício ${prev.ano} ainda não foi aberto`} acao={<LinkBotao href={`/orcamento/previsao?ano=${prev.ano}`}>Ir para a Previsão</LinkBotao>}>
          O Financeiro abre o exercício na tela Previsão. Depois disso, as receitas podem ser lançadas.
        </EstadoVazio>
      ) : (
        <div className={`grid items-start gap-6 ${prev.podeEditar ? 'xl:grid-cols-[minmax(0,1fr)_24rem]' : ''}`}>
          <div className="min-w-0 space-y-4">
            {prev.exercicio.situacao !== 'elaboracao' && (
              <Aviso tipo="info">O exercício {prev.ano} está aprovado: as receitas só mudam por suplementação aprovada pela Diretoria.</Aviso>
            )}

            <dl className="grid gap-3 sm:grid-cols-3">
              {(Object.keys(CAPTACAO) as Captacao[]).map((c) => (
                <div key={c} className="rounded-xl border border-borda bg-superficie px-4 py-3">
                  <dt className="text-sm text-texto-suave">
                    <Etiqueta tipo={TIPO_CAPTACAO[c]}>{CAPTACAO[c]}</Etiqueta>
                  </dt>
                  <dd className="mt-1 text-xl font-bold tabular-nums">{reais(prev.totais.porCaptacao[c])}</dd>
                  <dd className="text-sm text-texto-suave">{total > 0 ? `${Math.round((prev.totais.porCaptacao[c] / total) * 1000) / 10}% da receita` : '—'}</dd>
                </div>
              ))}
            </dl>

            {prev.receitas.length === 0 ? (
              <EstadoVazio titulo="Nenhuma receita lançada">{prev.podeEditar ? 'Lance as receitas no formulário ao lado.' : null}</EstadoVazio>
            ) : (
              <div className={tabela.moldura}>
                <table className={tabela.tabela}>
                  <caption className="sr-only">Receitas de {prev.ano} por fonte</caption>
                  <thead className={tabela.cabeca}>
                    <tr>
                      <th scope="col" className={tabela.th}>Receita</th>
                      <th scope="col" className={tabela.th}>Captação</th>
                      <th scope="col" className={tabela.th}>Meses</th>
                      <th scope="col" className={`${tabela.th} text-right`}>Valor</th>
                      {prev.podeEditar && <th scope="col" className={tabela.th}><span className="sr-only">Ações</span></th>}
                    </tr>
                  </thead>
                  {[...porFonte].map(([fonteId, itens]) => (
                    <tbody key={fonteId}>
                      <tr className="border-b border-borda bg-destaque-suave/60">
                        <th scope="rowgroup" colSpan={3} className="px-4 py-2 text-left">
                          <span className="font-bold">{itens[0].fonteNome}</span>
                          <span className="ml-2 text-xs font-normal text-texto-suave">
                            {NATUREZA[itens[0].natureza]} · {USO[itens[0].uso]}
                          </span>
                        </th>
                        <td className="px-4 py-2 text-right font-bold tabular-nums">{reais(itens.reduce((s, r) => s + r.valor, 0))}</td>
                        {prev.podeEditar && <td />}
                      </tr>
                      {itens.map((r) => (
                        <tr key={r.id} className={`${tabela.linha} ${emEdicao?.id === r.id ? 'bg-destaque-suave' : ''}`}>
                          <td className={`${tabela.td} pl-6`}>
                            <span className="font-semibold">{r.descricao}</span>
                            {r.observacao && <span className="block text-xs text-texto-suave">{r.observacao}</span>}
                          </td>
                          <td className={tabela.td}>
                            <Etiqueta tipo={TIPO_CAPTACAO[r.captacao]}>{CAPTACAO[r.captacao]}</Etiqueta>
                          </td>
                          <td className={`${tabela.td} text-xs text-texto-suave`}>{resumoMeses(r)}</td>
                          <td className={`${tabela.td} ${tabela.numero} font-semibold`}>{reais(r.valor)}</td>
                          {prev.podeEditar && (
                            <td className={`${tabela.td} whitespace-nowrap text-right`}>
                              <div className="flex justify-end gap-2">
                                <LinkBotao href={`${base}&editar=${r.id}#t-item`} variante="secundario" className={pequeno} aria-label={`Alterar ${r.descricao}`}>
                                  Alterar
                                </LinkBotao>
                                <FormularioConfirmado
                                  acao={acaoCancelarItem}
                                  campos={{ id: r.id, versao: r.versao, tipo: 'receita', ano: prev.ano }}
                                  rotulo="Excluir"
                                  variante="fantasma"
                                  pequeno
                                  titulo={`Excluir “${r.descricao}”?`}
                                  mensagem={`A receita de ${reais(r.valor)} sai do orçamento. Ela não é apagada da planilha: fica registrada como cancelada.`}
                                  confirmar="Excluir receita"
                                />
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  ))}
                  <tfoot className="border-t-2 border-borda-forte">
                    <tr>
                      <th scope="row" colSpan={3} className="px-4 py-3 text-left font-bold">
                        Total das receitas
                      </th>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">{reais(total)}</td>
                      {prev.podeEditar && <td />}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {prev.podeEditar && (
            <Secao titulo={emEdicao ? 'Alterar receita' : 'Lançar receita'} id="t-item" className="xl:sticky xl:top-6">
              {prev.opcoes.fontes.length === 0 ? (
                <Aviso tipo="atencao" acao={<LinkBotao href="/orcamento/previsao/fontes">Cadastrar fontes</LinkBotao>}>
                  Cadastre as fontes de recurso antes de lançar receitas.
                </Aviso>
              ) : (
                <FormularioItem key={emEdicao?.id ?? 'novo'} tipo="receita" acao={acaoSalvarReceita} ano={prev.ano} opcoes={prev.opcoes} item={emEdicao} cancelarHref={base} />
              )}
            </Secao>
          )}
        </div>
      )}
    </div>
  );
}
