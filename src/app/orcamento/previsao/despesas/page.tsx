import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Fragment } from 'react';
import { A_DEFINIR, lerPrevisao, type LinhaDespesa } from '@/modulos/orcamento/aplicacao/previsao';
import { faixaDeMeses, reais } from '@/modulos/orcamento/telas/formato';
import { FormularioItem } from '@/modulos/orcamento/telas/formulario-item';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { Botao, LinkBotao } from '@/ui/botao';
import { estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { CabecalhoPagina, EstadoVazio, Etiqueta, Secao, tabela } from '@/ui/pagina';
import { acaoCancelarItem, acaoFonteDaFolha, acaoSalvarDespesa } from '../acoes';

export const metadata: Metadata = { title: 'Despesas' };
const pequeno = '!min-h-8 !px-3 !py-1 !text-sm';

const resumoMeses = (d: { distribuicao: string; meses: number[] }) => (d.distribuicao === 'manual' ? `mês a mês: ${faixaDeMeses(d.meses)}` : faixaDeMeses(d.meses));
const numero = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export default async function Despesas({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string; editar?: string; servico?: string; grupo?: string; fonte?: string }>;
}) {
  const sp = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const app = await obterAplicacao();
  const prev = await lerPrevisao(app.planilhas, usuario.autorizador, Number(sp.ano) || undefined);
  const base = `/orcamento/previsao/despesas?ano=${prev.ano}`;
  const emEdicao = sp.editar && prev.podeEditar ? prev.despesas.find((d) => d.id === sp.editar) : undefined;

  const filtradas = prev.despesas.filter(
    (d) =>
      (!sp.servico || d.servico === sp.servico) &&
      (!sp.grupo || d.grupo_id === sp.grupo) &&
      (!sp.fonte || (sp.fonte === A_DEFINIR ? !d.fonte_id : d.fonte_id === sp.fonte)),
  );
  const filtrando = Boolean(sp.servico || sp.grupo || sp.fonte);
  const porArea = new Map<string, Map<string, LinhaDespesa[]>>();
  for (const d of filtradas) {
    const a = porArea.get(d.areaNome) ?? new Map<string, LinhaDespesa[]>();
    a.set(d.servicoNome, [...(a.get(d.servicoNome) ?? []), d]);
    porArea.set(d.areaNome, a);
  }
  const totalItens = filtradas.reduce((s, d) => s + d.valor, 0);
  const semFonte = prev.despesas.filter((d) => !d.fonte_id).length;

  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento/previsao' }, { rotulo: `Despesas ${prev.ano}` }]}
        titulo={`Despesas ${prev.ano}`}
        descricao="Itens por serviço (centro de custo), grupo de gasto e fonte de recurso. A folha de pagamento entra sozinha, no fim da página."
        acoes={
          prev.anos.length > 1 ? (
            <nav aria-label="Exercício" className="flex gap-1">
              {prev.anos.map((a) => (
                <LinkBotao key={a} href={`/orcamento/previsao/despesas?ano=${a}`} variante={a === prev.ano ? 'primario' : 'secundario'} className={pequeno}>
                  {a}
                </LinkBotao>
              ))}
            </nav>
          ) : undefined
        }
      />

      {!prev.exercicio ? (
        <EstadoVazio titulo={`O exercício ${prev.ano} ainda não foi aberto`} acao={<LinkBotao href={`/orcamento/previsao?ano=${prev.ano}`}>Ir para a Previsão</LinkBotao>}>
          O Financeiro abre o exercício na tela Previsão. Depois disso, as despesas podem ser lançadas.
        </EstadoVazio>
      ) : (
        <div className={`grid items-start gap-6 ${prev.podeEditar ? 'xl:grid-cols-[minmax(0,1fr)_24rem]' : ''}`}>
          <div className="min-w-0 space-y-4">
            {prev.exercicio.situacao !== 'elaboracao' && (
              <Aviso tipo="info">O exercício {prev.ano} está aprovado: os itens só mudam por remanejamento aprovado pela Diretoria.</Aviso>
            )}
            {semFonte > 0 && (
              <Aviso tipo="atencao" titulo={`${semFonte} ${semFonte === 1 ? 'item está' : 'itens estão'} com fonte “a definir”`}>
                O exercício só pode ser aprovado com todas as fontes escolhidas.{' '}
                <Link href={`${base}&fonte=${A_DEFINIR}`} className="font-semibold underline">
                  Ver só esses itens
                </Link>
              </Aviso>
            )}

            <details className="rounded-xl border border-borda bg-superficie" open={filtrando}>
              <summary className="cursor-pointer select-none px-5 py-3 font-semibold">Filtrar {filtrando && <Etiqueta tipo="info">filtro ativo</Etiqueta>}</summary>
              <form className="grid gap-3 border-t border-borda p-4 sm:grid-cols-[1fr_1fr_1fr_auto]" action="/orcamento/previsao/despesas">
                <input type="hidden" name="ano" value={prev.ano} />
                <label className="block text-sm">
                  Serviço
                  <select name="servico" defaultValue={sp.servico ?? ''} className={estiloEntrada}>
                    <option value="">Todos</option>
                    {prev.opcoes.servicos.map((s) => (
                      <option key={s.codigo} value={s.codigo}>
                        {s.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  Grupo
                  <select name="grupo" defaultValue={sp.grupo ?? ''} className={estiloEntrada}>
                    <option value="">Todos</option>
                    {prev.opcoes.grupos.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  Fonte
                  <select name="fonte" defaultValue={sp.fonte ?? ''} className={estiloEntrada}>
                    <option value="">Todas</option>
                    <option value={A_DEFINIR}>A definir</option>
                    {prev.opcoes.fontes.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-end gap-2">
                  <Botao type="submit" variante="secundario">
                    Filtrar
                  </Botao>
                  {filtrando && (
                    <LinkBotao href={base} variante="fantasma">
                      Limpar
                    </LinkBotao>
                  )}
                </div>
              </form>
            </details>

            {filtradas.length === 0 ? (
              <EstadoVazio titulo={filtrando ? 'Nenhum item com esse filtro' : 'Nenhuma despesa lançada'}>
                {prev.podeEditar && !filtrando ? 'Lance os itens no formulário ao lado.' : null}
              </EstadoVazio>
            ) : (
              <div className={tabela.moldura}>
                <table className={tabela.tabela}>
                  <caption className="sr-only">Despesas de {prev.ano} por área e serviço</caption>
                  <thead className={tabela.cabeca}>
                    <tr>
                      <th scope="col" className={tabela.th}>Item</th>
                      <th scope="col" className={tabela.th}>Grupo e fonte</th>
                      <th scope="col" className={`${tabela.th} text-right`}>Valor</th>
                      {prev.podeEditar && <th scope="col" className={tabela.th}><span className="sr-only">Ações</span></th>}
                    </tr>
                  </thead>
                  {[...porArea].map(([area, servicos]) => (
                    <tbody key={area}>
                      <tr className="border-b border-borda bg-destaque-suave/60">
                        <th scope="rowgroup" colSpan={prev.podeEditar ? 4 : 3} className="px-4 py-2 font-bold">
                          {area}
                        </th>
                      </tr>
                      {[...servicos].map(([servico, itens]) => (
                        <Fragment key={servico}>
                          <tr className="border-b border-borda bg-superficie-2">
                            <th scope="rowgroup" colSpan={2} className="px-4 py-1.5 pl-6 text-left text-sm font-semibold">
                              {servico}
                            </th>
                            <td className="px-4 py-1.5 text-right text-sm font-semibold tabular-nums">{reais(itens.reduce((s, d) => s + d.valor, 0))}</td>
                            {prev.podeEditar && <td />}
                          </tr>
                          {itens.map((d) => (
                            <tr key={d.id} className={`${tabela.linha} ${emEdicao?.id === d.id ? 'bg-destaque-suave' : ''}`}>
                              <td className={`${tabela.td} pl-6`}>
                                <span className="font-semibold">{d.descricao}</span>
                                <span className="block text-xs tabular-nums text-texto-suave">
                                  {numero(d.quantidade)} × {numero(d.ocorrencias)} × {reais(d.valor_unitario)} · {resumoMeses(d)}
                                </span>
                                {d.observacao && <span className="block text-xs italic text-texto-suave">{d.observacao}</span>}
                              </td>
                              <td className={tabela.td}>
                                <span className="block">
                                  {d.grupoNome} {d.rh && <Etiqueta tipo="info">RH</Etiqueta>}
                                </span>
                                {d.fonte_id ? <span className="block text-xs text-texto-suave">{d.fonteNome}</span> : <Etiqueta tipo="atencao">Fonte a definir</Etiqueta>}
                              </td>
                              <td className={`${tabela.td} ${tabela.numero} font-semibold`}>{reais(d.valor)}</td>
                              {prev.podeEditar && (
                                <td className={`${tabela.td} whitespace-nowrap text-right`}>
                                  <div className="flex justify-end gap-2">
                                    <LinkBotao href={`${base}&editar=${d.id}#t-item`} variante="secundario" className={pequeno} aria-label={`Alterar ${d.descricao}`}>
                                      Alterar
                                    </LinkBotao>
                                    <FormularioConfirmado
                                      acao={acaoCancelarItem}
                                      campos={{ id: d.id, versao: d.versao, tipo: 'despesa', ano: prev.ano }}
                                      rotulo="Excluir"
                                      variante="fantasma"
                                      pequeno
                                      titulo={`Excluir “${d.descricao}”?`}
                                      mensagem={`O item de ${reais(d.valor)} sai do orçamento. Ele não é apagado da planilha: fica registrado como cancelado.`}
                                      confirmar="Excluir item"
                                    />
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                    </tbody>
                  ))}
                  <tfoot className="border-t-2 border-borda-forte">
                    <tr>
                      <th scope="row" colSpan={2} className="px-4 py-3 text-left font-bold">
                        Total dos itens{filtrando ? ' (filtro)' : ''}
                      </th>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">{reais(totalItens)}</td>
                      {prev.podeEditar && <td />}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            <Secao
              titulo="Folha de pagamento (automática)"
              id="t-folha"
              descricao="Custo com encargos de cada funcionário × lotação, mês a mês. Muda sozinho quando a folha muda. Escolha a fonte que paga a folha de cada serviço."
            >
              {prev.avisoFolha && (
                <div className="mb-3">
                  <Aviso tipo="atencao">{prev.avisoFolha}</Aviso>
                </div>
              )}
              {prev.folha && prev.folha.linhas.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className={tabela.tabela}>
                    <caption className="sr-only">Folha de pagamento por serviço</caption>
                    <thead className={tabela.cabeca}>
                      <tr>
                        <th scope="col" className={tabela.th}>Serviço</th>
                        <th scope="col" className={tabela.th}>Fonte que paga</th>
                        <th scope="col" className={`${tabela.th} text-right`}>No ano</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prev.folha.linhas.map((l) => (
                        <tr key={l.servico} className={tabela.linha}>
                          <td className={tabela.td}>
                            <span className="font-semibold">{l.nome}</span>
                            <span className="block text-xs text-texto-suave">{l.areaNome}</span>
                          </td>
                          <td className={tabela.td}>
                            {prev.podeEditar ? (
                              <form action={acaoFonteDaFolha} className="flex flex-wrap items-center gap-2">
                                <input type="hidden" name="ano" value={prev.ano} />
                                <input type="hidden" name="servico" value={l.servico} />
                                <select
                                  name="fonte_id"
                                  defaultValue={l.fonte_id ?? ''}
                                  aria-label={`Fonte da folha de ${l.nome}`}
                                  className={`${estiloEntrada} !mt-0 !min-h-8 max-w-64 !py-1 text-sm ${l.fonte_id ? '' : 'border-aviso'}`}
                                >
                                  <option value="">A definir</option>
                                  {prev.opcoes.fontes.map((f) => (
                                    <option key={f.id} value={f.id}>
                                      {f.nome}
                                    </option>
                                  ))}
                                </select>
                                <Botao type="submit" variante="secundario" className={pequeno}>
                                  Salvar
                                </Botao>
                              </form>
                            ) : l.fonte_id ? (
                              l.fonteNome
                            ) : (
                              <Etiqueta tipo="atencao">A definir</Etiqueta>
                            )}
                          </td>
                          <td className={`${tabela.td} ${tabela.numero}`}>{reais(l.anual)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-borda-forte">
                      <tr>
                        <th scope="row" colSpan={2} className="px-4 py-3 text-left font-bold">
                          Total da folha
                        </th>
                        <td className="px-4 py-3 text-right font-bold tabular-nums">{reais(prev.folha.anual)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                !prev.avisoFolha && <p className="text-sm text-texto-suave">Nenhum custo de folha em {prev.ano}.</p>
              )}
            </Secao>
          </div>

          {prev.podeEditar && (
            <Secao titulo={emEdicao ? 'Alterar despesa' : 'Lançar despesa'} id="t-item" className="xl:sticky xl:top-6">
              {prev.opcoes.grupos.length === 0 ? (
                <Aviso tipo="atencao" acao={<LinkBotao href="/orcamento/previsao/grupos">Cadastrar grupos</LinkBotao>}>
                  Cadastre os grupos de gasto antes de lançar despesas.
                </Aviso>
              ) : (
                <FormularioItem key={emEdicao?.id ?? 'novo'} tipo="despesa" acao={acaoSalvarDespesa} ano={prev.ano} opcoes={prev.opcoes} item={emEdicao} cancelarHref={base} />
              )}
            </Secao>
          )}
        </div>
      )}
    </div>
  );
}
