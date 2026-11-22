import type { Metadata } from 'next';
import Link from 'next/link';
import { BotaoBaixar } from '@/modulos/orcamento/telas/botao-baixar';
import { redirect } from 'next/navigation';
import { opcoesDoPlano } from '@/modulos/orcamento/aplicacao/plano-lancamento';
import { lerPrevisao } from '@/modulos/orcamento/aplicacao/previsao';
import { CATEGORIA, COTACAO_CURTA, PRIORIDADE_CURTA } from '@/modulos/orcamento/dominio/previsao';
import { faixaDeMeses, reais } from '@/modulos/orcamento/telas/formato';
import { FormularioItem } from '@/modulos/orcamento/telas/formulario-item';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { LinkBotao, pequeno } from '@/ui/botao';
import { estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { IconeEditar, IconeLixeira, IconeMais } from '@/ui/icones';
import { JanelaFormulario } from '@/ui/janela';
import { CabecalhoPagina, EstadoVazio, Etiqueta, Secao } from '@/ui/pagina';
import { SelecaoAutomatica } from '@/ui/selecao-automatica';
import { SeletorCedidos } from '@/modulos/orcamento/telas/seletor-cedidos';
import { SeletorAno } from '@/ui/seletor-ano';
import { TabelaDados } from '@/ui/tabela-dados';
import { acaoCancelarItem, acaoFonteDaFolha, acaoSalvarDespesa } from '../acoes';

export const metadata: Metadata = { title: 'Despesas' };

const numero = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const resumoMeses = (d: { distribuicao: string; meses: number[] }) => (d.distribuicao === 'manual' ? `mês a mês: ${faixaDeMeses(d.meses)}` : faixaDeMeses(d.meses));

export default async function Despesas({ searchParams }: { searchParams: Promise<{ ano?: string; editar?: string; cedidos?: string }> }) {
  const sp = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const app = await obterAplicacao();
  const incluir = sp.cedidos !== '0';
  const prev = await lerPrevisao(app.planilhas, usuario.autorizador, Number(sp.ano) || undefined, { incluirCedidos: incluir });
  const plano = await opcoesDoPlano(app.planilhas, prev.ano);
  const nomeItem = new Map(plano.itens.map((i) => [i.id, i.nome]));
  const nomeAreaPlano = new Map(plano.areas.map((a) => [a.id, a.nome]));
  const base = `/orcamento/previsao/despesas?ano=${prev.ano}${incluir ? '' : '&cedidos=0'}`;
  const nomeServico = new Map(prev.opcoes.servicos.map((x) => [x.codigo, x.nome]));
  const emEdicao = sp.editar && prev.podeEditar ? prev.despesas.find((d) => d.id === sp.editar) : undefined;
  const semFonte = prev.despesas.filter((d) => !d.fonte_id).length;
  const podeLancar = prev.podeEditar && prev.opcoes.grupos.length > 0;

  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento/previsao' }, { rotulo: `Despesas ${prev.ano}` }]}
        titulo={`Despesas ${prev.ano}`}
        descricao="Itens por serviço (centro de custo), grupo de gasto e fonte de recurso. A folha de pagamento entra sozinha, no fim da página."
        acoes={
          <>
            <SeletorCedidos temCedidos={prev.cedidos.temCedidos} incluir={incluir} total={prev.cedidos.anual} href={(i) => `/orcamento/previsao/despesas?ano=${prev.ano}${i ? '' : '&cedidos=0'}`} />
            <SeletorAno anos={prev.anos} atual={prev.ano} href={(a) => `/orcamento/previsao/despesas?ano=${a}${incluir ? '' : '&cedidos=0'}`} />
            <BotaoBaixar href={`/orcamento/previsao/baixar/despesas?ano=${prev.ano}`} rotulo={`Baixar planilha (ano ${prev.ano})`} vazio={prev.despesas.length === 0 && !(prev.folha?.linhas.length)} />
            <LinkBotao href={`/orcamento/previsao/rateio?ano=${prev.ano}`} variante="secundario" className={pequeno}>
              Despesas por rateio
            </LinkBotao>
            {podeLancar && (
              <JanelaFormulario
                rotulo={
                  <>
                    <IconeMais tamanho={16} /> Lançar despesa
                  </>
                }
                className={pequeno}
                larga
                titulo="Lançar despesa"
              >
                <FormularioItem tipo="despesa" acao={acaoSalvarDespesa} ano={prev.ano} opcoes={prev.opcoes} plano={plano} cancelarHref={base} />
              </JanelaFormulario>
            )}
          </>
        }
      />

      {emEdicao && (
        <JanelaFormulario rotulo={null} abrirAoCarregar voltarPara={base} larga titulo={`Alterar “${emEdicao.descricao}”`}>
          <FormularioItem tipo="despesa" acao={acaoSalvarDespesa} ano={prev.ano} opcoes={prev.opcoes} plano={plano} item={emEdicao} cancelarHref={base} />
        </JanelaFormulario>
      )}

      {!prev.exercicio ? (
        <EstadoVazio titulo={`O exercício ${prev.ano} ainda não foi aberto`} acao={<LinkBotao href={`/orcamento/previsao?ano=${prev.ano}`}>Ir para a Previsão</LinkBotao>}>
          O Financeiro abre o exercício na tela Previsão. Depois disso, as despesas podem ser lançadas.
        </EstadoVazio>
      ) : (
        <div className="space-y-6">
          {prev.exercicio.situacao !== 'elaboracao' && (
            <Aviso tipo="info">O exercício {prev.ano} está aprovado: os itens só mudam por remanejamento aprovado pela Diretoria.</Aviso>
          )}
          {prev.podeEditar && prev.opcoes.grupos.length === 0 && (
            <Aviso tipo="atencao" acao={<LinkBotao href="/orcamento/previsao/grupos">Cadastrar grupos</LinkBotao>}>
              Cadastre os grupos de gasto antes de lançar despesas.
            </Aviso>
          )}
          {semFonte > 0 && (
            <Aviso tipo="atencao" titulo={`${semFonte} ${semFonte === 1 ? 'item está' : 'itens estão'} com fonte “a definir”`}>
              O exercício só pode ser aprovado com todas as fontes escolhidas. Para ver só esses itens, use “Filtrar colunas” e escreva “a definir” na coluna Fonte.
            </Aviso>
          )}

          <TabelaDados
            legenda={`Despesas de ${prev.ano}`}
            vazio={prev.podeEditar ? 'Nenhuma despesa lançada. Use “Lançar despesa”.' : 'Nenhuma despesa lançada.'}
            totalRotulo="Total dos itens"
            colunas={[
              { chave: 'descricao', rotulo: 'Item' },
              { chave: 'area', rotulo: 'Área', secundaria: true },
              { chave: 'servico', rotulo: 'Serviço' },
              { chave: 'grupo', rotulo: 'Grupo' },
              { chave: 'fonte', rotulo: 'Fonte' },
              { chave: 'categoria', rotulo: 'Categoria', secundaria: true },
              { chave: 'prioridade', rotulo: 'Prioridade' },
              { chave: 'cotacao', rotulo: 'Cotação', secundaria: true },
              { chave: 'meses', rotulo: 'Meses', secundaria: true },
              { chave: 'valor', rotulo: 'Valor', tipo: 'moeda', somar: true },
              ...(prev.podeEditar ? [{ chave: 'acoes', rotulo: '', fixa: true, largura: 'w-36' }] : []),
            ]}
            linhas={prev.despesas.map((d) => ({
              id: d.id,
              destaque: emEdicao?.id === d.id,
              valores: {
                descricao: d.descricao,
                area: d.areaNome,
                servico: d.servicoNome,
                grupo: [d.grupoCodigo ? `${d.grupoNome} ${d.grupoCodigo}` : d.grupoNome, d.item_id ? nomeItem.get(d.item_id) : null].filter(Boolean).join(' '),
                fonte: d.fonte_id ? (d.fonteCodigo ? `${d.fonteNome} ${d.fonteCodigo}` : d.fonteNome) : 'A definir',
                categoria: CATEGORIA[d.categoria],
                prioridade: d.prioridade ? PRIORIDADE_CURTA[d.prioridade] : null,
                cotacao: d.cotacao ? COTACAO_CURTA[d.cotacao] : null,
                meses: resumoMeses(d),
                valor: d.valor,
              },
              celulas: {
                descricao: (
                  <>
                    <span className="font-semibold">{d.descricao}</span>
                    {d.lancamento_rateio_id && (
                      <span className="ml-2 align-middle">
                        <Etiqueta tipo="info">Gerada por rateio</Etiqueta>
                      </span>
                    )}
                    <span className="block text-xs tabular-nums text-texto-suave">
                      {numero(d.quantidade)} × {numero(d.ocorrencias)} × {reais(d.valor_unitario)}
                    </span>
                    {d.observacao && <span className="block text-xs italic text-texto-suave">{d.observacao}</span>}
                  </>
                ),
                grupo: (
                  <>
                    {d.grupoNome} {d.rh && <Etiqueta tipo="info">RH</Etiqueta>}
                    {d.grupoCodigo && <span className="block text-xs tabular-nums text-texto-suave">{d.grupoCodigo}</span>}
                    {d.item_id && <span className="block text-xs text-texto-suave">Item: {nomeItem.get(d.item_id) ?? '?'}</span>}
                    {d.area_plano_id && <span className="block text-xs text-texto-suave">Área do plano: {nomeAreaPlano.get(d.area_plano_id) ?? '?'}</span>}
                  </>
                ),
                fonte: d.fonte_id ? (
                  <>
                    {d.fonteNome}
                    {d.fonteCodigo && <span className="block text-xs tabular-nums text-texto-suave">{d.fonteCodigo}</span>}
                  </>
                ) : (
                  <Etiqueta tipo="atencao">A definir</Etiqueta>
                ),
                categoria: d.categoria === 'projetos' ? <Etiqueta tipo="info">{CATEGORIA.projetos}</Etiqueta> : CATEGORIA.operacional,
                prioridade: d.prioridade ? (
                  <span className={`whitespace-nowrap ${d.prioridade === 'ui' ? 'font-semibold text-erro' : 'text-texto-suave'}`}>{PRIORIDADE_CURTA[d.prioridade]}</span>
                ) : (
                  '—'
                ),
                cotacao: d.cotacao && d.cotacao !== 'ok' ? <Etiqueta tipo="atencao">{COTACAO_CURTA[d.cotacao]}</Etiqueta> : d.cotacao ? COTACAO_CURTA.ok : '—',
                meses: <span className="whitespace-nowrap text-xs text-texto-suave">{resumoMeses(d)}</span>,
                valor:
                  d.valor !== d.valorOriginal ? (
                    <span title="Valor com remanejamentos e suplementações aprovados">
                      <span className="font-semibold">{reais(d.valor)}</span>
                      <span className="block text-xs text-texto-suave">antes: {reais(d.valorOriginal)}</span>
                    </span>
                  ) : undefined,
                acoes: d.lancamento_rateio_id ? (
                  <div className="flex flex-col items-end gap-1">
                    <Link href={`/orcamento/previsao/rateio?ano=${prev.ano}${prev.exercicio?.situacao === 'elaboracao' ? `&editar=${d.lancamento_rateio_id}` : ''}`} className="whitespace-nowrap text-xs underline">
                      Ver lançamento de origem
                    </Link>
                  </div>
                ) : (
                  <div className="flex justify-end gap-1">
                    <LinkBotao href={`${base}&editar=${d.id}`} scroll={false} variante="icone" aria-label={`Alterar ${d.descricao}`} title="Alterar">
                      <IconeEditar tamanho={16} />
                    </LinkBotao>
                    <FormularioConfirmado
                      acao={acaoCancelarItem}
                      campos={{ id: d.id, versao: d.versao, tipo: 'despesa', ano: prev.ano }}
                      rotulo={<IconeLixeira tamanho={16} />}
                      rotuloAcessivel={`Excluir ${d.descricao}`}
                      variante="icone-perigo"
                      titulo={`Excluir “${d.descricao}”?`}
                      mensagem={`O item de ${reais(d.valor)} sai do orçamento. Ele não é apagado da planilha: fica registrado como cancelado.`}
                      confirmar="Excluir item"
                    />
                  </div>
                ),
              },
            }))}
          />

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
              <TabelaDados
                legenda="Folha de pagamento por serviço"
                totalRotulo="Total da folha"
                colunas={[
                  { chave: 'servico', rotulo: 'Serviço' },
                  { chave: 'area', rotulo: 'Área' },
                  { chave: 'fonte', rotulo: 'Fonte que paga' },
                  { chave: 'anual', rotulo: 'No ano', tipo: 'moeda', somar: true },
                ]}
                linhas={prev.folha.linhas.map((l) => ({
                  id: l.servico,
                  valores: { servico: l.nome, area: l.areaNome, fonte: l.fonte_id ? l.fonteNome : 'A definir', anual: l.anual },
                  celulas: {
                    servico: <span className="font-semibold">{l.nome}</span>,
                    fonte: prev.podeEditar ? (
                      <form action={acaoFonteDaFolha} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="ano" value={prev.ano} />
                        <input type="hidden" name="servico" value={l.servico} />
                        <SelecaoAutomatica
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
                        </SelecaoAutomatica>
                      </form>
                    ) : l.fonte_id ? (
                      l.fonteNome
                    ) : (
                      <Etiqueta tipo="atencao">A definir</Etiqueta>
                    ),
                  },
                }))}
              />
            ) : (
              !prev.avisoFolha && <p className="text-sm text-texto-suave">Nenhum custo de folha em {prev.ano}.</p>
            )}
          </Secao>

          {prev.incluiCedidos && (
            <Secao
              titulo="Pessoal cedido (automático)"
              id="t-cedidos"
              descricao="Profissionais cedidos por quem cede, por serviço da lotação. Calculado pelo Elo a partir do cadastro de cedidos; não é digitado, não passa pelo caixa e não entra no orçamento aprovado."
            >
              <TabelaDados
                legenda="Pessoal cedido por serviço"
                totalRotulo="Total de cedidos"
                colunas={[
                  { chave: 'servico', rotulo: 'Serviço' },
                  { chave: 'situacao', rotulo: 'Origem', secundaria: true },
                  { chave: 'anual', rotulo: 'No ano', tipo: 'moeda', somar: true },
                ]}
                linhas={prev.cedidos.porServico.map((c) => ({
                  id: c.servico,
                  valores: { servico: nomeServico.get(c.servico) ?? c.servico, situacao: 'Automática', anual: c.anual },
                  celulas: { servico: <span className="font-semibold">{nomeServico.get(c.servico) ?? c.servico}</span>, situacao: <Etiqueta tipo="info">Automática, sem passar pelo caixa</Etiqueta> },
                }))}
              />
            </Secao>
          )}
        </div>
      )}
    </div>
  );
}
