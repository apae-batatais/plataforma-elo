import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { lerAcompanhamento } from '@/modulos/projetos/aplicacao/acompanhamento';
import { NOME_MUDANCA, NOME_SITUACAO_PEDIDO, type SituacaoPedido } from '@/modulos/projetos/dominio/acompanhamento';
import { AbasProjeto } from '@/modulos/projetos/telas/abas-projeto';
import { moeda } from '@/modulos/projetos/telas/rotulos';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { LinkBotao } from '@/ui/botao';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { CabecalhoPagina, EstadoVazio, Etiqueta, Secao } from '@/ui/pagina';
import { acaoDecidirMudanca } from '../../acoes';

export const metadata: Metadata = { title: 'Mudanças do projeto' };

const TIPO: Record<SituacaoPedido, 'neutro' | 'sucesso' | 'atencao' | 'erro' | 'info'> = { aplicada: 'sucesso', pendente: 'atencao', aguardando_alcada: 'atencao', aprovada: 'sucesso', recusada: 'neutro' };
const data = (d: string) => d.slice(0, 10).split('-').reverse().join('/');

export default async function PaginaMudancas({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const { id } = await params;
  const { planilhas } = await obterAplicacao();
  const a = await lerAcompanhamento(planilhas, usuario.autorizador, id);
  if (!a) notFound();
  const t = a.tolerancias;
  const valor = (tipo: string, v: string) => (tipo === 'custo' ? moeda(Number(v)) : tipo === 'prazo' ? v.split('-').reverse().join('/') : v);
  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Projetos', href: '/projetos' }, { rotulo: a.projeto.codigo, href: `/projetos/${id}` }, { rotulo: 'Mudanças' }]}
        titulo="Mudanças"
        descricao="Mudou o prazo, o custo ou o escopo combinado? Dentro da tolerância do Termo de Abertura, o responsável aplica. Fora dela, a Diretoria decide."
        acoes={a.podeAlterar ? <LinkBotao href={`/projetos/${id}/mudancas/novo`}>Pedir mudança</LinkBotao> : undefined}
      />
      <AbasProjeto id={id} atual="mudancas" />
      {a.pedidos === null ? (
        <Aviso tipo="info">Quem está só na equipe do projeto não vê os pedidos de mudança.</Aviso>
      ) : (
        <>
          {a.projeto.etapa !== 'implementacao' && <Aviso tipo="info">Pedidos de mudança só existem com o projeto em implementação. Você vê o histórico em leitura.</Aviso>}
          {t && (
            <Secao id="t-tolerancia" titulo="Tolerâncias do Termo de Abertura" descricao="O que pode mudar sem pedir à Diretoria.">
              <ul className="space-y-1 text-sm">
                <li>Custo de uma linha do orçamento: até {t.custoLinhaPct}% a mais.</li>
                <li>Custo total: até {t.custoTotalPct}% a mais.</li>
                <li>Prazo do fim do projeto: até {t.prazoFimDias} dias de atraso.</li>
                <li>Prazo de cada atividade: até {t.prazoMarcoDias} dias de atraso.</li>
                <li>Escopo livre: {t.escopoLivre?.trim() ? t.escopoLivre : 'nada foi declarado; toda mudança de escopo vai para a Diretoria.'}</li>
              </ul>
              {a.foraDaTolerancia && a.foraDaTolerancia.length > 0 && (
                <div className="mt-3">
                  <Aviso tipo="erro">
                    <span className="font-semibold">O projeto está fora da tolerância:</span>
                    <ul className="mt-1 list-disc pl-5">
                      {a.foraDaTolerancia.map((m) => <li key={m}>{m}</li>)}
                    </ul>
                  </Aviso>
                </div>
              )}
            </Secao>
          )}
          {a.pedidos.length === 0 ? (
            <EstadoVazio titulo="Nada aqui ainda." acao={a.podeAlterar ? <LinkBotao href={`/projetos/${id}/mudancas/novo`}>Pedir mudança</LinkBotao> : undefined}>Nenhum pedido de mudança foi feito neste projeto.</EstadoVazio>
          ) : (
            <Secao id="t-pedidos" titulo="Pedidos de mudança">
              <ul className="divide-y divide-borda">
                {a.pedidos.map((x) => {
                  const decide = (x.situacao === 'pendente' && a.podeDecidir && x.pedido_por.toLowerCase() !== usuario.autorizador.email.toLowerCase()) || (x.situacao === 'aguardando_alcada' && a.podeDecidirAlcada && x.pedido_por.toLowerCase() !== usuario.autorizador.email.toLowerCase());
                  return (
                    <li key={x.id} className="space-y-1 py-3 text-sm">
                      <p className="flex flex-wrap items-center gap-2 font-semibold">
                        {NOME_MUDANCA[x.tipo]}: {valor(x.tipo, x.atual)} → {valor(x.tipo, x.proposto)}
                        <Etiqueta tipo={TIPO[x.situacao]}>{NOME_SITUACAO_PEDIDO[x.situacao]}</Etiqueta>
                      </p>
                      <p>{x.frase}</p>
                      {!['aplicada', 'aprovada', 'recusada'].includes(x.situacao) && <p className="font-semibold">{x.quem}</p>}
                      <p className="text-texto-suave">
                        Pedido por {x.pedido_por} em {data(x.pedido_em)}. Motivo: {x.justificativa}
                      </p>
                      {x.decidido_por && x.situacao !== 'aplicada' && (
                        <p className="text-texto-suave">
                          Decidido por {x.decidido_por} em {data(x.decidido_em ?? '')}: {x.decisao_justificativa}
                          {x.versao_termo_nova ? ` · gerou a versão ${x.versao_termo_nova} do Termo de Abertura` : ''}
                        </p>
                      )}
                      {decide && (
                        <div className="flex flex-wrap gap-3">
                          {(['aprovar', 'recusar'] as const).map((d) => (
                            <FormularioConfirmado
                              key={d}
                              acao={acaoDecidirMudanca}
                              campos={{ id, pedido: x.id, versao_pedido: x.versao, decisao: d }}
                              rotulo={d === 'aprovar' ? 'Aprovar' : 'Recusar'}
                              titulo={d === 'aprovar' ? 'Aprovar este pedido?' : 'Recusar este pedido?'}
                              mensagem={
                                d === 'aprovar'
                                  ? x.exige_alcada && x.situacao === 'pendente'
                                    ? 'Esta decisão sobe para a Presidência ou o Conselho: nada muda até a decisão final.'
                                    : 'A mudança é aplicada e o Elo gera uma nova versão do Termo de Abertura, já aprovada. A anterior fica guardada como substituída.'
                                  : 'Nada muda no projeto e o pedido fica guardado como recusado.'
                              }
                              confirmar={d === 'aprovar' ? 'Aprovar pedido' : 'Recusar pedido'}
                              variante={d === 'aprovar' ? 'primario' : 'secundario'}
                              perigoso={false}
                              pequeno
                            >
                              <Campo rotulo="Justificativa da decisão" obrigatorio>
                                <textarea name="justificativa" required rows={2} className={estiloEntrada} />
                              </Campo>
                            </FormularioConfirmado>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Secao>
          )}
        </>
      )}
    </div>
  );
}
