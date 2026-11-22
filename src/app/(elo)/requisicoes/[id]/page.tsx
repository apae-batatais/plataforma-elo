import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { detalharRequisicao, ErroRequisicao } from '@/modulos/requisicoes/aplicacao/requisicoes';
import {
  CATEGORIAS_TI,
  FICHA_DE_SERVICO,
  NOME_ACAO,
  SERVICOS_MANUTENCAO,
  SERVICOS_MOBILIARIO,
  NOME_SITUACAO,
  URGENCIAS,
  type Acao,
  type DetalhesManutencao,
  type DetalhesMateriais,
  type DetalhesMobiliario,
  type DetalhesTi,
  type Situacao,
} from '@/modulos/requisicoes/dominio/requisicao';
import { RESULTADOS_USO } from '@/modulos/requisicoes/dominio/espaco';
import { momentoBR, RESULTADOS_USO_VEICULO } from '@/modulos/requisicoes/dominio/veiculo';
import { textoHoras } from '@/modulos/requisicoes/dominio/sla';
import { dataHora, EtiquetaSituacao } from '@/modulos/requisicoes/telas/lista-requisicoes';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { conferenciaDosCentros } from '@/plataforma/ligacoes';
import { CartaoConferencia } from '@/modulos/requisicoes/telas/cartao-conferencia';
import { acaoCorrigirValorGasto } from '../acoes';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { LinkBotao, pequeno } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { CabecalhoPagina, Etiqueta, Secao } from '@/ui/pagina';
import { acaoCancelar, acaoConcluir, acaoDecidir, acaoFecharReserva, acaoFecharVeiculo, acaoReceber } from '../acoes';
import { BotaoImprimir } from './imprimir';
import { PiscaOndeMudou } from '@/ui/pisca-onde-mudou';

export const metadata: Metadata = { title: 'Requisição' };

const moedaBR = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const numeroBR = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 3 });

function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-texto-suave">{rotulo}</dt>
      <dd className="font-medium">{children || '—'}</dd>
    </div>
  );
}

export default async function FichaRequisicao({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ grupo?: string; valor?: string }>;
}) {
  const { id } = await params;
  const consulta = await searchParams;
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
  const chamado = d.tipo?.formulario === 'ti' ? ((d.detalhes ?? {}) as DetalhesTi) : null;
  const mobiliario = d.tipo?.formulario === 'mobiliario' ? ((d.detalhes ?? {}) as DetalhesMobiliario) : null;
  const manutencao = d.tipo?.formulario === 'manutencao' ? ((d.detalhes ?? {}) as DetalhesManutencao) : null;
  const reserva = d.reserva;
  const veiculo = d.veiculo;
  const reservaAprovada = r.situacao === 'aprovada' && Boolean(veiculo);
  const conflitoAprovado = Boolean((reserva?.conflitos ?? veiculo?.conflitos)?.some((c) => c.situacao === 'aprovada'));
  const servico = Boolean(d.tipo && FICHA_DE_SERVICO[d.tipo.formulario]);
  const dataBR = (iso: string | null | undefined) => (iso ? iso.split('-').reverse().join('/') : '');
  const pode = (a: Acao) => d.acoes.includes(a);
  const campos = { id: r.id, versao: r.versao };
  const valorConsulta = consulta.valor ? Number(consulta.valor.replace(/\s/g, '').replace(',', '.')) : NaN;
  const grupoConsulta = consulta.grupo ?? '';
  // Quem aprova vê o saldo antes de decidir; a plataforma lê o Orçamento com a permissão da pessoa.
  const conferencia = pode('aprovar') && !reserva && !veiculo
    ? (await conferenciaDosCentros(app.planilhas, usuario.autorizador, d.centros.map((c) => c.servico), grupoConsulta || null)).map((c) => ({
        ...c,
        nome: d.centros.find((x) => x.servico === c.servico)?.nome ?? c.servico,
      }))
    : null;
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
        <Aviso
          tipo="info"
          titulo={r.aprovacao === 'diretoria' ? 'Aguardando a Diretoria' : reserva ? 'Aguardando o setor Espaços' : veiculo ? 'Aguardando o Transporte' : 'Aguardando a coordenação'}
        >
          {veiculo
            ? r.aprovacao === 'diretoria'
              ? 'Este pedido foi feito por alguém do Transporte: quem decide é a Diretoria.'
              : 'O Transporte aprova, devolve para ajuste ou recusa.'
            : reserva
            ? r.aprovacao === 'diretoria'
              ? 'Esta reserva foi pedida por alguém do setor Espaços: quem decide é a Diretoria.'
              : 'O setor Espaços aprova, devolve para ajuste ou recusa.'
            : r.aprovacao === 'diretoria'
            ? 'Esta requisição é aprovada pela Diretoria: foi feita pela própria coordenação ou o serviço não tem coordenação cadastrada.'
            : 'A coordenação dos centros de custo aprova, devolve para ajuste ou recusa.'}
        </Aviso>
      )}

      {conferencia && (
        <CartaoConferencia
          centros={conferencia}
          grupoId={grupoConsulta}
          valor={Number.isFinite(valorConsulta) ? valorConsulta : null}
          projeto={r.projeto_id ? { codigo: r.projeto_codigo ?? '', titulo: r.projeto_titulo ?? '', atividade: r.atividade_descricao } : null}
        />
      )}

      {reserva?.aviso && (
        <Aviso tipo="atencao" titulo="Período de indisponibilidade">
          {reserva.aviso}
        </Aviso>
      )}

      {veiculo?.avisoManutencao && (
        <Aviso tipo="atencao" titulo="Veículo em manutenção">
          {veiculo.avisoManutencao}
        </Aviso>
      )}

      {veiculo && veiculo.conflitos === null && veiculo.haConflito && (
        <Aviso tipo="atencao" titulo="Outro pedido no mesmo horário">
          Este veículo já tem pedido nesse horário. O Transporte decide.
        </Aviso>
      )}

      {veiculo?.conflitos && (
        <Secao titulo="Pedidos neste horário" id="t-conflitos" className="print:hidden">
          {veiculo.conflitos.length === 0 ? (
            <p className="text-sm text-texto-suave">Nenhum outro pedido cruza com este horário.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {veiculo.conflitos.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-borda px-3 py-2">
                  <Link href={`/requisicoes/${c.id}`} className="font-semibold text-destaque hover:underline">
                    {c.numero}
                  </Link>
                  <span className="tabular-nums">
                    {momentoBR(c.saida)} a {momentoBR(c.volta)}
                  </span>
                  <span>{c.quem}</span>
                  <span>{c.destino}</span>
                  <Etiqueta tipo={c.situacao === 'aprovada' ? 'atencao' : 'info'}>{c.situacaoNome}</Etiqueta>
                </li>
              ))}
            </ul>
          )}
        </Secao>
      )}

      {reserva?.conflitos && (
        <Secao titulo="Conflitos neste horário" id="t-conflitos" className="print:hidden">
          {reserva.conflitos.length === 0 ? (
            <p className="text-sm text-texto-suave">Nenhum pedido cruza com este horário.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {reserva.conflitos.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-borda px-3 py-2">
                  <Link href={`/requisicoes/${c.id}`} className="font-semibold text-destaque hover:underline">
                    {c.numero}
                  </Link>
                  <span className="tabular-nums">
                    {c.inicio} às {c.fim}
                  </span>
                  <span>{c.quem}</span>
                  <Etiqueta tipo={c.situacao === 'aprovada' ? 'atencao' : 'info'}>{c.situacaoNome}</Etiqueta>
                </li>
              ))}
            </ul>
          )}
        </Secao>
      )}

      {d.acoes.length > 0 && (
        <Secao titulo="O que você pode fazer" id="t-acoes" className="print:hidden">
          <div className="space-y-5">
            {pode('aprovar') && (
              <div className="space-y-3">
                {conflitoAprovado ? (
                  <FormularioConfirmado
                    acao={acaoDecidir}
                    campos={{ id: r.id, versao: r.versao, acao: 'aprovar', confirmar_conflito: 'sim' }}
                    rotulo={veiculo ? 'Aprovar pedido' : 'Aprovar reserva'}
                    variante="primario"
                    perigoso={false}
                    titulo="Aprovar mesmo assim?"
                    mensagem={
                      veiculo
                        ? 'Já existe um pedido aprovado nesse horário. Aprovar mesmo assim? Você resolve o outro depois (a confirmação fica no histórico).'
                        : 'Este horário já está aprovado para outro pedido. Se aprovar, os dois ficam aprovados e a decisão não tem volta: só dá para devolver ou fechar com texto, na mão.'
                    }
                    confirmar="Aprovar mesmo assim"
                  />
                ) : (
                  <form action={acaoDecidir}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="versao" value={r.versao} />
                    <input type="hidden" name="acao" value="aprovar" />
                    {grupoConsulta && <input type="hidden" name="grupo_id" value={grupoConsulta} />}
                    {Number.isFinite(valorConsulta) && <input type="hidden" name="valor_estimado" value={valorConsulta} />}
                    <BotaoEnviar enviando="Aprovando…">{veiculo ? 'Aprovar pedido' : reserva ? 'Aprovar reserva' : 'Aprovar'}</BotaoEnviar>
                  </form>
                )}
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
            {pode('fechar') && reserva && (
              <div className="space-y-3">
                {!reserva.jaPodeFechar ? (
                  <p className="text-sm text-texto-suave">
                    Registrar uso: disponível depois de {reserva.fim} de {dataBR(reserva.data)}.
                  </p>
                ) : (
                  <form action={acaoFecharReserva} className="space-y-3">
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="versao" value={r.versao} />
                    <fieldset className="text-sm">
                      <legend className="font-semibold">Registrar uso</legend>
                      <label className="mt-2 flex items-center gap-2">
                        <input type="radio" name="resultado" value="sem_problema" required /> {RESULTADOS_USO.sem_problema}
                      </label>
                      <label className="mt-1 flex items-center gap-2">
                        <input type="radio" name="resultado" value="com_problema" /> {RESULTADOS_USO.com_problema}
                      </label>
                    </fieldset>
                    <Campo rotulo="O que aconteceu" dica="Obrigatório se foi usado com problema (mínimo de 10 letras). Fica no histórico.">
                      <textarea name="texto" rows={3} className={estiloEntrada} />
                    </Campo>
                    <BotaoEnviar enviando="Registrando…">Registrar uso</BotaoEnviar>
                  </form>
                )}
              </div>
            )}
            {pode('fechar') && veiculo && (
              <div className="space-y-3">
                {!veiculo.jaPodeConfirmarUso ? (
                  <p className="text-sm text-texto-suave">Confirmar uso: disponível depois da saída ({momentoBR(veiculo.saida)}).</p>
                ) : (
                  <FormularioConfirmado
                    acao={acaoFecharVeiculo}
                    campos={{ id: r.id, versao: r.versao }}
                    rotulo="Confirmar uso"
                    variante="primario"
                    perigoso={false}
                    titulo="Confirmar o uso do veículo?"
                    mensagem="Ao confirmar, o pedido é encerrado e não pode ser reaberto. Confira a quilometragem antes."
                    confirmar="Confirmar uso"
                  >
                    <fieldset className="text-sm">
                      <legend className="font-semibold">Como foi o uso</legend>
                      <label className="mt-2 flex items-center gap-2">
                        <input type="radio" name="resultado" value="sem_problema" required /> {RESULTADOS_USO_VEICULO.sem_problema}
                      </label>
                      <label className="mt-1 flex items-center gap-2">
                        <input type="radio" name="resultado" value="com_problema" /> {RESULTADOS_USO_VEICULO.com_problema}
                      </label>
                    </fieldset>
                    <Campo rotulo="O que aconteceu" dica="Obrigatório se foi usado com problema (mínimo de 10 letras). Fica no histórico.">
                      <textarea name="problema" rows={3} className={estiloEntrada} />
                    </Campo>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Campo rotulo="Quilometragem de saída" obrigatorio dica="Número inteiro, como está no painel.">
                        <input name="km_saida" inputMode="numeric" required className={estiloEntrada} />
                      </Campo>
                      <Campo rotulo="Quilometragem de volta" obrigatorio dica="Não pode ser menor que a de saída.">
                        <input name="km_volta" inputMode="numeric" required className={estiloEntrada} />
                      </Campo>
                    </div>
                  </FormularioConfirmado>
                )}
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
            {pode('concluir') && servico && (
              <form action={acaoConcluir} className="space-y-3">
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="versao" value={r.versao} />
                <fieldset className="text-sm">
                  <legend className="font-semibold">Resultado</legend>
                  <label className="mt-2 flex items-center gap-2">
                    <input type="radio" name="resultado" value="resolvido" required /> {mobiliario ? 'Feito' : 'Resolvido'}
                  </label>
                  <label className="mt-1 flex items-center gap-2">
                    <input type="radio" name="resultado" value="parcial" /> {mobiliario ? 'Feito em parte ou não feito' : 'Resolvido em parte ou não resolvido'}
                  </label>
                </fieldset>
                <Campo rotulo="O que foi feito" dica="Quem pediu vê no histórico. Se ficou algo pendente, diga o quê e por quê.">
                  <textarea name="comentario" rows={3} required className={estiloEntrada} />
                </Campo>
                <Campo rotulo="Valor gasto (opcional)" dica="Aparece no projeto como compras ligadas; não substitui o realizado do Orçamento.">
                  <input name="valor_gasto" inputMode="decimal" className={estiloEntrada} />
                </Campo>
                <BotaoEnviar enviando="Concluindo…">Concluir atendimento</BotaoEnviar>
              </form>
            )}
            {pode('concluir') && !servico && (
              <form action={acaoConcluir} className="space-y-3">
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="versao" value={r.versao} />
                <p className="text-sm">Confira quanto foi entregue de cada item. Se faltou algo, explique no comentário.</p>
                <ul className="space-y-2">
                  {d.itens.map((i) => (
                    <li key={i.id} className="grid grid-cols-[1fr_8rem] items-center gap-3 text-sm">
                      <label htmlFor={`item_${i.id}`}>
                        {i.descricao}{' '}
                        <span className="text-texto-suave">
                          (pedido: {numeroBR(i.quantidade)} {i.unidade})
                        </span>
                      </label>
                      <input
                        id={`item_${i.id}`}
                        name={`item_${i.id}`}
                        inputMode="decimal"
                        defaultValue={String(i.quantidade).replace('.', ',')}
                        className={`${estiloEntrada} !mt-0 text-right`}
                      />
                    </li>
                  ))}
                </ul>
                <Campo rotulo="Comentário">
                  <textarea name="comentario" rows={2} className={estiloEntrada} />
                </Campo>
                <Campo rotulo="Valor gasto (opcional)" dica="Aparece no projeto como compras ligadas; não substitui o realizado do Orçamento.">
                  <input name="valor_gasto" inputMode="decimal" className={estiloEntrada} />
                </Campo>
                <BotaoEnviar enviando="Concluindo…">Concluir atendimento</BotaoEnviar>
              </form>
            )}
            {pode('cancelar') && (
              <FormularioConfirmado
                acao={acaoCancelar}
                campos={campos}
                rotulo={reservaAprovada ? 'Cancelar reserva' : 'Cancelar requisição'}
                variante="fantasma"
                titulo={`Cancelar ${r.numero}?`}
                mensagem={
                  reservaAprovada
                    ? 'A reserva aprovada é cancelada e o veículo fica livre nesse horário. Quem pediu vê o motivo no histórico. Não dá para desfazer.'
                    : 'A requisição sai da fila e fica no histórico como cancelada. Não dá para desfazer: se precisar, abra outra.'
                }
                confirmar={reservaAprovada ? 'Cancelar reserva' : 'Cancelar requisição'}
              >
                <Campo rotulo={reservaAprovada ? 'Motivo' : 'Motivo (opcional)'} obrigatorio={reservaAprovada}>
                  <textarea name="comentario" rows={2} required={reservaAprovada} className={estiloEntrada} />
                </Campo>
              </FormularioConfirmado>
            )}
          </div>
        </Secao>
      )}

      {d.podeCorrigirValorGasto && (
        <Secao titulo="Valor gasto" id="t-valor-gasto" className="print:hidden">
          <form action={acaoCorrigirValorGasto} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="versao" value={r.versao} />
            <Campo rotulo="Valor gasto (opcional)" dica="Aparece no projeto como compras ligadas; não substitui o realizado do Orçamento.">
              <input name="valor_gasto" inputMode="decimal" defaultValue={r.valor_gasto != null ? String(r.valor_gasto).replace('.', ',') : ''} className={estiloEntrada} />
            </Campo>
            <BotaoEnviar enviando="Salvando…" variante="secundario">
              Salvar valor gasto
            </BotaoEnviar>
          </form>
        </Secao>
      )}

      {d.sla && (
        <dl className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ['Aprovação', d.sla.aprovacao],
              ...(reserva || veiculo ? [] : [['Atendimento', d.sla.atendimento] as const]),
            ] as const
          ).map(([nome, s]) => (
            <div key={nome} className="rounded-cartao border border-borda bg-superficie px-4 py-3">
              <dt className="text-sm text-texto-suave">Prazo de {nome.toLowerCase()}</dt>
              {s ? (
                <dd className={s.situacao === 'atrasada' ? 'font-semibold text-erro' : 'font-semibold'}>
                  {s.situacao === 'atrasada' ? 'Atrasada' : s.encerrada ? 'Cumprido' : 'No prazo'}: {textoHoras(s.horas, d.expediente)} de{' '}
                  {textoHoras(s.prazo, d.expediente)}
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
          {r.grupo_nome && <Dado rotulo="Grupo de despesa">{r.grupo_nome}</Dado>}
          {d.centros.length > 0 && <Dado rotulo="Centros de custo">{d.centros.map((c) => `${c.nome} (${numeroBR(c.percentual)}%)`).join(' · ')}</Dado>}
          {r.recebida_por && <Dado rotulo="Recebida por">{r.recebida_por}</Dado>}
          {r.executada_por && <Dado rotulo="Executada por">{r.executada_por}</Dado>}
          {r.projeto_id && (
            <Dado rotulo="Projeto">
              {r.projeto_codigo} · {r.projeto_titulo}
              {r.atividade_descricao ? ` · ${r.atividade_descricao}` : ''}
            </Dado>
          )}
          {r.valor_estimado != null && <Dado rotulo="Valor estimado (informado por quem aprovou)">{moedaBR(r.valor_estimado)}</Dado>}
          {r.valor_gasto != null && <Dado rotulo="Valor gasto (informado por quem atendeu)">{moedaBR(r.valor_gasto)}</Dado>}
        </dl>

        {d.itens.length > 0 && (
          <div className="mt-5 overflow-x-auto rounded-lg border border-borda">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Itens solicitados</caption>
              <thead className="bg-superficie-2 text-texto-suave">
                <tr>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">
                    Qtd.
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Unid.
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Item
                  </th>
                  {mostrarAtendido && (
                    <th scope="col" className="px-3 py-2 text-right font-semibold">
                      Entregue
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {d.itens.map((i) => (
                  <PiscaOndeMudou key={i.id} chave={`item:${i.id}`} como="tr" className="border-t border-borda">
                    <td className="px-3 py-2 text-right tabular-nums">{numeroBR(i.quantidade)}</td>
                    <td className="px-3 py-2">{i.unidade}</td>
                    <td className="px-3 py-2">{i.descricao}</td>
                    {mostrarAtendido && (
                      <td className={`px-3 py-2 text-right tabular-nums ${i.atendido !== null && i.atendido < i.quantidade ? 'font-semibold text-aviso' : ''}`}>
                        {i.atendido !== null ? numeroBR(i.atendido) : '—'}
                      </td>
                    )}
                  </PiscaOndeMudou>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {reserva && (
          <dl className="mt-5 grid gap-4 sm:grid-cols-3">
            <Dado rotulo="Espaço">
              {reserva.espaco}
              {reserva.local ? ` · ${reserva.local}` : ''}
            </Dado>
            <Dado rotulo="Quando">
              {dataBR(reserva.data)}, {reserva.inicio} às {reserva.fim}
            </Dado>
            <Dado rotulo="Pessoas esperadas">
              <span className={reserva.acimaDaCapacidade ? 'text-aviso' : ''}>
                {reserva.pessoas}
                {reserva.acimaDaCapacidade && reserva.capacidade ? ` (acima da capacidade: ${reserva.capacidade})` : ''}
              </span>
            </Dado>
            <Dado rotulo="Finalidade">{reserva.finalidade}</Dado>
            {reserva.usoExterno && <Dado rotulo="Cedido para fora (organização ou pessoa)">{reserva.organizacaoExterna}</Dado>}
            {reserva.fechamento && (
              <Dado rotulo="Uso registrado">
                {RESULTADOS_USO[reserva.fechamento.resultado]}
                {reserva.fechamento.texto ? `: ${reserva.fechamento.texto}` : ''}
              </Dado>
            )}
          </dl>
        )}

        {veiculo && (
          <dl className="mt-5 grid gap-4 sm:grid-cols-3">
            <Dado rotulo="Veículo">
              {veiculo.nome} · {veiculo.placa}
              {veiculo.capacidade ? ` (até ${veiculo.capacidade} passageiros)` : ''}
            </Dado>
            <Dado rotulo="Saída">{momentoBR(veiculo.saida)}</Dado>
            <Dado rotulo="Volta prevista">{momentoBR(veiculo.volta)}</Dado>
            <Dado rotulo="Destino">{veiculo.destino}</Dado>
            <Dado rotulo="Condutor">{veiculo.condutor}</Dado>
            <div className="sm:col-span-3">
              <dt className="text-sm text-texto-suave">Finalidade</dt>
              <dd className="whitespace-pre-line font-medium">{veiculo.finalidade}</dd>
            </div>
            {veiculo.uso && (
              <>
                <Dado rotulo="Uso confirmado">
                  {veiculo.uso.resultadoNome}
                  {veiculo.uso.problema ? `: ${veiculo.uso.problema}` : ''}
                </Dado>
                <Dado rotulo="Quilometragem">
                  {numeroBR(veiculo.uso.kmSaida)} → {numeroBR(veiculo.uso.kmVolta)} ({numeroBR(veiculo.uso.kmVolta - veiculo.uso.kmSaida)} km)
                </Dado>
              </>
            )}
          </dl>
        )}

        {chamado && (
          <dl className="mt-5 grid gap-4 sm:grid-cols-3">
            <Dado rotulo="Do que é">{CATEGORIAS_TI[chamado.categoria]}</Dado>
            <Dado rotulo="Urgência">
              <span className={chamado.urgencia === 'critica' || chamado.urgencia === 'alta' ? 'text-erro' : ''}>{URGENCIAS[chamado.urgencia]}</span>
            </Dado>
            <Dado rotulo="Onde está">{chamado.local}</Dado>
            <Dado rotulo="Equipamento ou sistema">{chamado.equipamento}</Dado>
            <Dado rotulo="Nº de patrimônio">{chamado.patrimonio}</Dado>
            <Dado rotulo="Contato">{chamado.contato}</Dado>
            <div className="sm:col-span-3">
              <dt className="text-sm text-texto-suave">O que está acontecendo</dt>
              <dd className="whitespace-pre-line font-medium">{chamado.problema}</dd>
            </div>
          </dl>
        )}

        {manutencao && (
          <dl className="mt-5 grid gap-4 sm:grid-cols-3">
            <Dado rotulo="Tipo de serviço">{SERVICOS_MANUTENCAO[manutencao.servico]}</Dado>
            <Dado rotulo="Urgência">
              <span className={manutencao.urgencia === 'critica' || manutencao.urgencia === 'alta' ? 'text-erro' : ''}>{URGENCIAS[manutencao.urgencia]}</span>
            </Dado>
            <Dado rotulo="Onde é">{manutencao.local}</Dado>
            <Dado rotulo="Equipamento">{manutencao.equipamento}</Dado>
            <Dado rotulo="Nº de patrimônio">{manutencao.patrimonio}</Dado>
            <Dado rotulo="Contato">{manutencao.contato}</Dado>
            <Dado rotulo="Melhor horário">{manutencao.horario}</Dado>
            <div className="sm:col-span-3">
              <dt className="text-sm text-texto-suave">Qual é o problema</dt>
              <dd className="whitespace-pre-line font-medium">{manutencao.problema}</dd>
            </div>
          </dl>
        )}

        {mobiliario && (
          <>
            <dl className="mt-5 grid gap-4 sm:grid-cols-3">
              <Dado rotulo="O que fazer">{SERVICOS_MOBILIARIO[mobiliario.servico]}</Dado>
              <Dado rotulo="De onde">{mobiliario.origem}</Dado>
              <Dado rotulo="Para onde">{mobiliario.destino}</Dado>
              <Dado rotulo="Para quando">
                {dataBR(mobiliario.data)}
                {mobiliario.horario ? ` às ${mobiliario.horario}` : ''}
              </Dado>
              {mobiliario.devolucao && <Dado rotulo="Devolução">{dataBR(mobiliario.devolucao)}</Dado>}
              <Dado rotulo="Contato">{mobiliario.contato}</Dado>
            </dl>
            <div className="mt-5 overflow-x-auto rounded-lg border border-borda">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Móveis</caption>
                <thead className="bg-superficie-2 text-texto-suave">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">
                      Qtd.
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Móvel
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Nº de patrimônio
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mobiliario.moveis.map((m, k) => (
                    <tr key={k} className="border-t border-borda">
                      <td className="px-3 py-2 text-right tabular-nums">{m.quantidade}</td>
                      <td className="px-3 py-2">{m.descricao}</td>
                      <td className="px-3 py-2">{m.patrimonio || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <dl className="mt-5 grid gap-4 sm:grid-cols-3">
          {!servico && det.entrega && (
            <>
              <Dado rotulo={det.entrega.modo === 'retirada' ? 'Retirada' : 'Entrega'}>
                {[det.entrega.horario, det.entrega.local].filter(Boolean).join(' · ') || (det.entrega.modo === 'retirada' ? 'No almoxarifado' : 'No local')}
              </Dado>
              <Dado rotulo={det.entrega.modo === 'retirada' ? 'Quem vai retirar' : 'Quem vai receber'}>{det.entrega.responsavel}</Dado>
            </>
          )}
          {!servico && det.evento && (
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

      {d.anexos.length > 0 && (
        <Secao titulo="Fotos e vídeo" descricao="Clique na foto para ver em tamanho grande." id="t-anexos">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {d.anexos.map((a) => (
              <li key={a.id} className="overflow-hidden rounded-lg border border-borda bg-superficie-2">
                {a.tipo === 'foto' ? (
                  <a
                    href={`/requisicoes/anexos/${a.id}`}
                    target="_blank"
                    rel="noopener"
                    className="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--destaque)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/requisicoes/anexos/${a.id}`}
                      alt={`Foto anexada à ${r.numero}`}
                      loading="lazy"
                      className="aspect-[4/3] w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                    />
                  </a>
                ) : (
                  <video src={`/requisicoes/anexos/${a.id}`} controls playsInline preload="metadata" className="aspect-[4/3] w-full bg-black object-contain">
                    Seu navegador não mostra este vídeo.
                  </video>
                )}
                <p className="px-3 py-1.5 text-xs text-texto-suave">
                  {a.tipo === 'foto' ? 'Foto' : `Vídeo${a.duracao ? ` · ${Math.round(a.duracao)} s` : ''}`} ·{' '}
                  {a.tamanho < 1024 * 1024
                    ? `${Math.max(1, Math.round(a.tamanho / 1024))} KB`
                    : `${(a.tamanho / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`}
                </p>
              </li>
            ))}
          </ul>
        </Secao>
      )}

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
