import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { detalharRequisicao, ErroRequisicao } from '@/modulos/requisicoes/aplicacao/requisicoes';
import { NOME_ACAO, NOME_SITUACAO, type Acao, type DetalhesMateriais, type Situacao } from '@/modulos/requisicoes/dominio/requisicao';
import { textoHoras } from '@/modulos/requisicoes/dominio/sla';
import { dataHora, EtiquetaSituacao } from '@/modulos/requisicoes/telas/lista-requisicoes';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { LinkBotao, pequeno } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { CabecalhoPagina, Secao } from '@/ui/pagina';
import { acaoCancelar, acaoConcluir, acaoDecidir, acaoReceber } from '../acoes';
import { BotaoImprimir } from './imprimir';

export const metadata: Metadata = { title: 'Requisição' };

const numeroBR = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 3 });

function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-texto-suave">{rotulo}</dt>
      <dd className="font-medium">{children || '—'}</dd>
    </div>
  );
}

export default async function FichaRequisicao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const app = await obterAplicacao();
  let d;
  try {
    d = await detalharRequisicao(app.planilhas, usuario.autorizador, id);
  } catch (erro) {
    if (erro instanceof ErroRequisicao) notFound();
    if (erro instanceof ErroPermissao) redirect('/requisicoes');
    throw erro;
  }
  const r = d.requisicao;
  const det = (d.detalhes ?? {}) as DetalhesMateriais;
  const pode = (a: Acao) => d.acoes.includes(a);
  const campos = { id: r.id, versao: r.versao };
  const mostrarAtendido = r.situacao === 'atendida' || r.situacao === 'atendida_parcial';

  return (
    <div className="max-w-5xl space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Requisições', href: '/requisicoes' }, { rotulo: r.numero }]}
        titulo={
          <span className="flex flex-wrap items-center gap-3">
            {r.numero}
            <EtiquetaSituacao situacao={r.situacao} nome={NOME_SITUACAO[r.situacao]} />
          </span>
        }
        descricao={`${d.tipo?.nome ?? 'Tipo excluído'} · atendida por ${d.tipo?.perfil ?? '—'}`}
        acoes={<BotaoImprimir />}
      />

      {r.situacao === 'enviada' && (
        <Aviso tipo="info" titulo={r.aprovacao === 'diretoria' ? 'Aguardando a Diretoria' : 'Aguardando a coordenação'}>
          {r.aprovacao === 'diretoria'
            ? 'Esta requisição é aprovada pela Diretoria: foi feita pela própria coordenação ou o serviço não tem coordenação cadastrada.'
            : 'A coordenação dos centros de custo aprova, devolve para ajuste ou recusa.'}
        </Aviso>
      )}

      {d.acoes.length > 0 && (
        <Secao titulo="O que você pode fazer" id="t-acoes" className="print:hidden">
          <div className="space-y-5">
            {pode('aprovar') && (
              <div className="space-y-3">
                <form action={acaoDecidir}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="versao" value={r.versao} />
                  <input type="hidden" name="acao" value="aprovar" />
                  <BotaoEnviar enviando="Aprovando…">Aprovar</BotaoEnviar>
                </form>
                <form action={acaoDecidir} className="space-y-2">
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="versao" value={r.versao} />
                  <Campo rotulo="Devolver ou recusar" dica="Escreva o que ajustar (devolver) ou o motivo (recusar). Quem pediu vê no histórico.">
                    <textarea name="comentario" rows={2} required className={estiloEntrada} />
                  </Campo>
                  <div className="flex flex-wrap gap-2">
                    <BotaoEnviar name="acao" value="devolver" variante="secundario" enviando="Devolvendo…">
                      Devolver para ajuste
                    </BotaoEnviar>
                    <BotaoEnviar name="acao" value="recusar" variante="perigo" enviando="Recusando…">
                      Recusar
                    </BotaoEnviar>
                  </div>
                </form>
              </div>
            )}
            {pode('reenviar') && (
              <div className="flex flex-wrap items-center gap-3">
                <LinkBotao href={`/requisicoes/${r.id}/editar`}>Ajustar e reenviar</LinkBotao>
                <span className="text-sm text-texto-suave">Veja no histórico abaixo o que a coordenação pediu.</span>
              </div>
            )}
            {pode('receber') && (
              <form action={acaoReceber} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="versao" value={r.versao} />
                <BotaoEnviar enviando="Recebendo…">Receber para atender</BotaoEnviar>
                <span className="text-sm text-texto-suave">Fica registrado que você recebeu; o prazo de atendimento continua contando.</span>
              </form>
            )}
            {pode('concluir') && (
              <form action={acaoConcluir} className="space-y-3">
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="versao" value={r.versao} />
                <p className="text-sm">Confira quanto foi entregue de cada item. Se faltou algo, explique no comentário.</p>
                <ul className="space-y-2">
                  {d.itens.map((i) => (
                    <li key={i.id} className="grid grid-cols-[1fr_8rem] items-center gap-3 text-sm">
                      <label htmlFor={`item_${i.id}`}>
                        {i.descricao} <span className="text-texto-suave">(pedido: {numeroBR(i.quantidade)} {i.unidade})</span>
                      </label>
                      <input id={`item_${i.id}`} name={`item_${i.id}`} inputMode="decimal" defaultValue={String(i.quantidade).replace('.', ',')} className={`${estiloEntrada} !mt-0 text-right`} />
                    </li>
                  ))}
                </ul>
                <Campo rotulo="Comentário">
                  <textarea name="comentario" rows={2} className={estiloEntrada} />
                </Campo>
                <BotaoEnviar enviando="Concluindo…">Concluir atendimento</BotaoEnviar>
              </form>
            )}
            {pode('cancelar') && (
              <FormularioConfirmado
                acao={acaoCancelar}
                campos={campos}
                rotulo="Cancelar requisição"
                variante="fantasma"
                titulo={`Cancelar ${r.numero}?`}
                mensagem="A requisição sai da fila e fica no histórico como cancelada. Não dá para desfazer: se precisar, abra outra."
                confirmar="Cancelar requisição"
              >
                <Campo rotulo="Motivo (opcional)">
                  <textarea name="comentario" rows={2} className={estiloEntrada} />
                </Campo>
              </FormularioConfirmado>
            )}
          </div>
        </Secao>
      )}

      {d.sla && (
        <dl className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ['Aprovação', d.sla.aprovacao],
              ['Atendimento', d.sla.atendimento],
            ] as const
          ).map(([nome, s]) => (
            <div key={nome} className="rounded-xl border border-borda bg-superficie px-4 py-3">
              <dt className="text-sm text-texto-suave">Prazo de {nome.toLowerCase()}</dt>
              {s ? (
                <dd className={s.situacao === 'atrasada' ? 'font-semibold text-erro' : 'font-semibold'}>
                  {s.situacao === 'atrasada' ? 'Atrasada' : s.encerrada ? 'Cumprido' : 'No prazo'}: {textoHoras(s.horas, d.expediente)} de {textoHoras(s.prazo, d.expediente)}
                  {!s.encerrada && <span className="block text-xs font-normal text-texto-suave">contando (horas úteis)</span>}
                </dd>
              ) : (
                <dd className="text-texto-suave">Começa quando a requisição for aprovada.</dd>
              )}
            </div>
          ))}
        </dl>
      )}

      <Secao titulo="Ficha" id="t-ficha">
        <dl className="grid gap-4 sm:grid-cols-3">
          <Dado rotulo="Quem pediu">{r.requisitante_nome}</Dado>
          <Dado rotulo="Enviada em">{dataHora(r.enviada_em)}</Dado>
          <Dado rotulo="Área">{d.area}</Dado>
          <Dado rotulo="Grupo de despesa">{r.grupo_nome}</Dado>
          <Dado rotulo="Centros de custo">{d.centros.map((c) => `${c.nome} (${numeroBR(c.percentual)}%)`).join(' · ')}</Dado>
          {r.recebida_por && <Dado rotulo="Recebida por">{r.recebida_por}</Dado>}
          {r.executada_por && <Dado rotulo="Executada por">{r.executada_por}</Dado>}
        </dl>

        {d.itens.length > 0 && (
          <div className="mt-5 overflow-x-auto rounded-lg border border-borda">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Itens solicitados</caption>
              <thead className="bg-superficie-2 text-texto-suave">
                <tr>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Qtd.</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Unid.</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Item</th>
                  {mostrarAtendido && <th scope="col" className="px-3 py-2 text-right font-semibold">Entregue</th>}
                </tr>
              </thead>
              <tbody>
                {d.itens.map((i) => (
                  <tr key={i.id} className="border-t border-borda">
                    <td className="px-3 py-2 text-right tabular-nums">{numeroBR(i.quantidade)}</td>
                    <td className="px-3 py-2">{i.unidade}</td>
                    <td className="px-3 py-2">{i.descricao}</td>
                    {mostrarAtendido && (
                      <td className={`px-3 py-2 text-right tabular-nums ${i.atendido !== null && i.atendido < i.quantidade ? 'font-semibold text-aviso' : ''}`}>{i.atendido !== null ? numeroBR(i.atendido) : '—'}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <dl className="mt-5 grid gap-4 sm:grid-cols-3">
          {det.entrega && (
            <>
              <Dado rotulo={det.entrega.modo === 'retirada' ? 'Retirada' : 'Entrega'}>
                {[det.entrega.horario, det.entrega.local].filter(Boolean).join(' · ') || (det.entrega.modo === 'retirada' ? 'No almoxarifado' : 'No local')}
              </Dado>
              <Dado rotulo={det.entrega.modo === 'retirada' ? 'Quem vai retirar' : 'Quem vai receber'}>{det.entrega.responsavel}</Dado>
            </>
          )}
          {det.evento && (
            <Dado rotulo="Evento">
              {det.evento.nome} · {det.evento.data.split('-').reverse().join('/')}
              {det.evento.horario ? ` às ${det.evento.horario}` : ''}
              {det.evento.local ? ` · ${det.evento.local}` : ''}
              {det.evento.participantes ? ` · ${det.evento.participantes} participantes` : ''}
              {det.evento.publico ? ` · ${det.evento.publico}` : ''}
            </Dado>
          )}
          {det.utensilios && <Dado rotulo="Utensílios">{det.utensilios}</Dado>}
          {r.observacao && <Dado rotulo="Observações">{r.observacao}</Dado>}
        </dl>
      </Secao>

      <Secao titulo="Histórico" id="t-historico">
        <ol className="space-y-3">
          {d.historico.map((h, k) => (
            <li key={k} className="flex gap-3 text-sm">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-destaque" aria-hidden="true" />
              <div>
                <p>
                  <strong>{NOME_ACAO[h.acao as Acao] ?? h.acao}</strong> · {NOME_SITUACAO[h.para as Situacao] ?? h.para}
                </p>
                <p className="text-texto-suave">
                  {dataHora(h.em)} · {h.usuario}
                </p>
                {h.comentario && <p className="mt-1 rounded-md bg-superficie-2 px-3 py-2">{h.comentario}</p>}
              </div>
            </li>
          ))}
        </ol>
      </Secao>

      <p className="print:hidden">
        <LinkBotao href="/requisicoes" variante="fantasma" className={pequeno}>
          Voltar para a lista
        </LinkBotao>
      </p>
    </div>
  );
}
