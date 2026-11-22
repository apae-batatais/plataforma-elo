import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { lerPlano } from '@/modulos/orcamento/aplicacao/plano-contas';
import { FormularioPlano } from '@/modulos/orcamento/telas/formulario-plano';
import { BotaoBaixar } from '@/modulos/orcamento/telas/botao-baixar';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { LinkBotao, pequeno } from '@/ui/botao';
import { JanelaFormulario } from '@/ui/janela';
import { CabecalhoPagina, EstadoVazio, Etiqueta, Secao } from '@/ui/pagina';
import { SeletorAno } from '@/ui/seletor-ano';
import { acaoSalvarPlano } from './acoes';

export const metadata: Metadata = { title: 'Plano de contas' };

const dataBr = (d: string) => d.split('-').reverse().join('/');
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export default async function PlanoDeContas({ searchParams }: { searchParams: Promise<{ ano?: string; editar?: string; base?: string }> }) {
  const q = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const app = await obterAplicacao();
  const plano = await lerPlano(app.planilhas, usuario.autorizador, Number(q.ano) || undefined);
  const podeEditar = usuario.autorizador.temPermissao('orcamento.previsao.editar') && plano.situacao !== 'encerrado';
  const { areas, grupos, itens } = plano.cadastros;
  const href = (a: number) => `/orcamento/previsao/plano?ano=${a}`;
  const nomeArea = new Map([...areas.ativos, ...areas.excluidos].map((a) => [a.id, a]));
  const nomeGrupo = new Map(grupos.map((g) => [g.id, g]));
  const nomeItem = new Map([...itens.ativos, ...itens.excluidos].map((i) => [i.id, i]));

  // O que já vem marcado ao editar: a versão atual, ou o plano do ano anterior se a pessoa pediu.
  const base = q.base === 'anterior' && plano.anterior ? plano.anterior.linhas : (plano.atual?.linhas ?? []);
  const inicial = base.map((l) => `${l.area_id}|${l.grupo_id}|${l.item_id ?? ''}`);
  const abrirEdicao = podeEditar && (q.editar === '1' || q.base === 'anterior');
  const gruposAtivos = grupos.filter((g) => g.ativo);
  const formulario = {
    areas: areas.ativos.map((a) => ({ id: a.id, nome: a.nome, codigo: a.codigo })),
    grupos: gruposAtivos.map((g) => ({ id: g.id, nome: g.nome, codigo: g.codigo_conta, itens: itens.ativos.filter((i) => i.grupo_id === g.id).map((i) => ({ id: i.id, nome: i.nome, codigo: i.codigo })) })),
  };
  const semCadastro = formulario.areas.length === 0 || formulario.grupos.length === 0;

  const acaoMontar = !plano.atual ? 'Montar plano de ' + plano.ano : 'Editar plano';
  const aberto = `/orcamento/previsao/plano?ano=${plano.ano}`;

  // Uma seção por Área, com os grupos e os itens habilitados.
  const porArea = new Map<string, Map<string, string[]>>();
  for (const l of plano.atual?.linhas ?? []) {
    const g = porArea.get(l.area_id) ?? new Map<string, string[]>();
    const lista = g.get(l.grupo_id) ?? [];
    if (l.item_id) lista.push(l.item_id);
    g.set(l.grupo_id, lista);
    porArea.set(l.area_id, g);
  }

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento/previsao' }, { rotulo: 'Plano de contas' }]}
        titulo="Plano de contas"
        descricao="Para cada exercício, quais grupos de contas e itens cada área usa. O plano orienta os lançamentos; não bloqueia nenhum."
        acoes={
          <>
            <SeletorAno anos={plano.anos} atual={plano.ano} href={href} />
            <BotaoBaixar href={`/orcamento/previsao/baixar/plano?ano=${plano.ano}`} rotulo="Baixar planilha" vazio={!plano.atual} />
            {podeEditar && plano.anterior && plano.atual && (
              <LinkBotao href={`${aberto}&base=anterior`} scroll={false} variante="fantasma" className={pequeno}>
                Recomeçar do plano de {plano.anterior.ano}
              </LinkBotao>
            )}
            {podeEditar && !semCadastro && (
              <LinkBotao href={`${aberto}&editar=1`} scroll={false} className={pequeno}>
                {acaoMontar}
              </LinkBotao>
            )}
          </>
        }
      />

      {plano.situacao === 'encerrado' && <Aviso tipo="info">O exercício está encerrado; o plano não pode mudar.</Aviso>}
      {podeEditar && semCadastro && (
        <Aviso tipo="atencao" titulo="Falta cadastrar antes de montar o plano" acao={<LinkBotao href="/orcamento/previsao/areas-plano" variante="fantasma" className={pequeno}>Cadastrar áreas</LinkBotao>}>
          O plano junta áreas e grupos de contas. Cadastre ao menos uma área e um grupo de contas.
        </Aviso>
      )}

      {abrirEdicao && !semCadastro && (
        <JanelaFormulario rotulo={null} abrirAoCarregar larga voltarPara={aberto} titulo={`${plano.atual ? 'Editar' : 'Montar'} o plano de ${plano.ano}`}>
          <FormularioPlano
            key={`${plano.ano}-${q.base ?? ''}`}
            ano={plano.ano}
            loteLido={plano.atual?.lote ?? null}
            vigenciaInicial={plano.vigenciaPadrao}
            areas={formulario.areas}
            grupos={formulario.grupos}
            inicial={inicial}
            acao={acaoSalvarPlano}
          />
        </JanelaFormulario>
      )}

      {!plano.atual ? (
        <EstadoVazio
          titulo="Este exercício ainda não tem plano de contas."
          acao={
            podeEditar && !semCadastro ? (
              <div className="flex flex-wrap justify-center gap-2">
                {plano.anterior && (
                  <LinkBotao href={`${aberto}&base=anterior`} scroll={false}>
                    Começar do plano de {plano.anterior.ano}
                  </LinkBotao>
                )}
                <LinkBotao href={`${aberto}&editar=1`} scroll={false} variante={plano.anterior ? 'fantasma' : 'primario'}>
                  Montar plano de {plano.ano}
                </LinkBotao>
              </div>
            ) : undefined
          }
        >
          {podeEditar ? 'Monte o plano marcando, em cada área, os grupos e os itens que ela usa.' : 'Quem cuida do Financeiro monta o plano.'}
        </EstadoVazio>
      ) : (
        <>
          <p className="text-[1.05rem]">
            <strong>
              Plano de {plano.ano}: {plural(plano.resumo.areas, 'área', 'áreas')}, {plural(plano.resumo.grupos, 'grupo', 'grupos')}, {plural(plano.resumo.itens, 'item', 'itens')}
            </strong>
            , {plano.atualJaVale ? 'vale desde' : 'vale a partir de'} {dataBr(plano.atual.vigencia)}.
          </p>
          {[...porArea].sort((a, b) => (nomeArea.get(a[0])?.nome ?? '').localeCompare(nomeArea.get(b[0])?.nome ?? '', 'pt-BR')).map(([areaId, gs]) => {
            const a = nomeArea.get(areaId);
            return (
              <Secao
                key={areaId}
                titulo={
                  <>
                    {a?.nome ?? 'Área'}
                    {a?.codigo && <span className="ml-2 text-sm font-normal text-texto-suave">{a.codigo}</span>}
                    {a && !a.ativo && <span className="ml-2"><Etiqueta>encerrada</Etiqueta></span>}
                  </>
                }
                descricao={plural(gs.size, 'grupo', 'grupos')}
              >
                <ul className="space-y-3">
                  {[...gs].sort((x, y) => (nomeGrupo.get(x[0])?.nome ?? '').localeCompare(nomeGrupo.get(y[0])?.nome ?? '', 'pt-BR')).map(([grupoId, itensIds]) => {
                    const g = nomeGrupo.get(grupoId);
                    return (
                      <li key={grupoId}>
                        <p className="font-semibold">
                          {g?.nome ?? 'Grupo'}
                          {g?.codigo_conta && <span className="ml-2 text-sm font-normal text-texto-suave">{g.codigo_conta}</span>}
                          {g && !g.ativo && <span className="ml-2"><Etiqueta>encerrado</Etiqueta></span>}
                        </p>
                        {itensIds.length === 0 ? (
                          <p className="text-sm text-texto-suave">Sem itens habilitados.</p>
                        ) : (
                          <ul className="ml-4 list-disc text-sm">
                            {itensIds.map((id) => {
                              const i = nomeItem.get(id);
                              return (
                                <li key={id}>
                                  {i?.nome ?? 'Item'}
                                  {i?.codigo && <span className="ml-2 text-texto-suave">{i.codigo}</span>}
                                  {i && !i.ativo && <span className="ml-2"><Etiqueta>encerrado</Etiqueta></span>}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Secao>
            );
          })}
        </>
      )}

      {plano.versoes.length > 0 && (
        <Secao titulo="Versões anteriores" descricao="Cada vez que o plano é salvo, nasce uma versão nova. As anteriores ficam guardadas, só para leitura.">
          <ul className="divide-y divide-borda text-sm">
            {plano.versoes.map((v, i) => (
              <li key={v.lote} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  Vale a partir de <strong>{dataBr(v.vigencia)}</strong>
                  {v.criadoEm && <span className="text-texto-suave"> · salvo em {dataBr(v.criadoEm.slice(0, 10))}</span>}
                </span>
                <span className="flex items-center gap-2 text-texto-suave">
                  {plural(v.resumo.areas, 'área', 'áreas')}, {plural(v.resumo.grupos, 'grupo', 'grupos')}, {plural(v.resumo.itens, 'item', 'itens')}
                  {i === 0 && <Etiqueta tipo="info">mais recente</Etiqueta>}
                </span>
              </li>
            ))}
          </ul>
        </Secao>
      )}
    </div>
  );
}
