import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { opcoesDeDestinatarios } from '@/modulos/comunicacao/aplicacao/contatos';
import { publicacaoAutomaticaDisponivel, publicacaoDoPedido } from '@/modulos/comunicacao/aplicacao/publicacoes';
import { destinatariosDoPedido, detalharPedido, emailProntoDoPedido, listarPedidos, opcoesDoPedido } from '@/modulos/comunicacao/aplicacao/pedidos';
import { ErroComunicacao, NOME_TIPO_PECA, SITUACOES_FINAIS } from '@/modulos/comunicacao/dominio/pedido';
import { ACOES_DA_EQUIPE } from '@/modulos/comunicacao/telas/acoes-da-equipe';
import { AcoesDeAgendamento, EmailPronto } from '@/modulos/comunicacao/telas/agendamento';
import { AcoesPedido } from '@/modulos/comunicacao/telas/acoes-pedido';
import { dataCurta } from '@/modulos/comunicacao/telas/mes';
import { dataHoraBR, EtiquetaSituacao, EtiquetaUrgente } from '@/modulos/comunicacao/telas/rotulos';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { LinkBotao } from '@/ui/botao';
import { FormularioConfirmado } from '@/ui/confirmar';
import { CabecalhoPagina, Etiqueta, Secao } from '@/ui/pagina';
import { Aviso } from '@/ui/aviso';
import { acaoAgendarPedido, acaoCancelarPedido, acaoDecidirPedido, acaoJuntarPedido, acaoPublicarPedido, acaoRevisarPedido, acaoTentarDeNovoPublicacao } from '../acoes';

export const metadata: Metadata = { title: 'Pedido' };

const NOME_ACAO: Record<string, string> = {
  enviar: 'Pedido enviado',
  editar: 'Dados alterados na revisão',
  reenviar: 'Pedido ajustado e reenviado',
  cancelar: 'Pedido cancelado',
  iniciar_revisao: 'Revisão iniciada',
  enviar_aprovacao: 'Enviado para aprovação',
  devolver: 'Devolvido para ajuste',
  recusar: 'Recusado',
  juntar: 'Juntado a outro pedido',
  aprovar: 'Aprovado',
  pedir_ajustes: 'Ajustes pedidos',
  agendar: 'Agendado',
  reagendar: 'Reagendado',
  publicar: 'Publicado',
  publicacao_falhou: 'A publicação no Instagram falhou',
  tentar_de_novo: 'Publicação no Instagram colocada na fila de novo',
};

function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-texto-suave">{rotulo}</dt>
      <dd className="font-medium">{children || '—'}</dd>
    </div>
  );
}

export default async function FichaPedido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const { planilhas, instituicao } = await obterAplicacao();
  let d;
  try {
    d = await detalharPedido(planilhas, usuario.autorizador, id);
  } catch (erro) {
    if (erro instanceof ErroComunicacao) notFound();
    if (erro instanceof ErroPermissao) redirect('/comunicacao');
    throw erro;
  }
  const r = d.pedido;
  const podeJuntar = d.acoes.includes('juntar');
  const destinos = podeJuntar
    ? (await listarPedidos(planilhas, usuario.autorizador, 'todos'))
        .filter((x) => x.id !== r.id && !SITUACOES_FINAIS.has(x.situacao))
        .map((x) => ({ id: x.id, rotulo: `${x.numero} · ${x.titulo}` }))
    : [];
  const daEquipe = d.acoes.some((a) => ACOES_DA_EQUIPE.includes(a));
  const doAgendamento = d.acoes.some((a) => a === 'agendar' || a === 'reagendar' || a === 'publicar');
  const sai = r.tipo_peca === 'release' || r.tipo_peca === 'artigo';
  const destino = doAgendamento && sai ? await opcoesDeDestinatarios(planilhas, usuario.autorizador) : { grupos: [], contatos: [] };
  const escolhidos = doAgendamento && sai ? await destinatariosDoPedido(planilhas, usuario.autorizador, r.id) : { grupos: [], contatos: [] };
  const email = r.situacao === 'agendado' && sai && d.acoes.includes('publicar') ? await emailProntoDoPedido(planilhas, usuario.autorizador, r.id) : null;
  const podeRevisar = usuario.autorizador.temPermissao('comunicacao.revisar');
  const emInstagram = r.tipo_peca === 'post_instagram' && podeRevisar;
  const instagram = emInstagram && doAgendamento
    ? { ...(await publicacaoAutomaticaDisponivel(planilhas, usuario.autorizador, r, instituicao.codigo).then((x) => ({ disponivel: x.disponivel, motivo: x.disponivel ? null : x.motivo }))), podeConfigurar: usuario.autorizador.temPermissao('comunicacao.configurar'), automatica: r.publicacao_automatica === true }
    : null;
  const publicacao = emInstagram && (r.publicacao_automatica || r.situacao === 'publicado') ? await publicacaoDoPedido(planilhas, usuario.autorizador, r.id) : null;
  const nomeDaArea = (await opcoesDoPedido(planilhas, usuario.autorizador)).areas.find((a) => a.codigo === r.area)?.nome ?? r.area;
  return (
    <div className="max-w-4xl space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Comunicação', href: '/comunicacao' }, { rotulo: r.numero }]}
        titulo={
          <span className="flex flex-wrap items-center gap-3">
            {r.numero}
            <EtiquetaSituacao situacao={r.situacao} />
            {r.urgente && <EtiquetaUrgente />}
          </span>
        }
        descricao={r.titulo}
      />

      {(d.acoes.includes('reenviar') || d.acoes.includes('cancelar') || daEquipe || doAgendamento) && (
        <Secao titulo="O que você pode fazer" id="t-acoes">
          <div className="flex flex-wrap items-center gap-3">
            {d.acoes.includes('reenviar') && <LinkBotao href={`/comunicacao/${r.id}/editar`}>Ajustar e reenviar</LinkBotao>}
            {d.acoes.includes('cancelar') && (
              <FormularioConfirmado
                acao={acaoCancelarPedido}
                campos={{ id: r.id, versao: r.versao }}
                rotulo="Cancelar pedido"
                titulo="Cancelar este pedido?"
                mensagem="O pedido deixa de andar, mas fica guardado no histórico. Para publicar o assunto depois, será preciso fazer um novo pedido."
                confirmar="Cancelar pedido"
              />
            )}
          </div>
          {daEquipe && (
            <div className="mt-3">
              <AcoesPedido acoes={d.acoes} situacao={r.situacao} id={r.id} versao={r.versao} destinos={destinos} revisar={acaoRevisarPedido} decidir={acaoDecidirPedido} juntar={acaoJuntarPedido} />
            </div>
          )}
          {doAgendamento && (
            <div className="mt-3">
              <AcoesDeAgendamento
                acoes={d.acoes}
                id={r.id}
                versao={r.versao}
                tipoPeca={r.tipo_peca}
                agendadoPara={r.agendado_para}
                destino={destino}
                escolhidos={escolhidos}
                instagram={instagram}
                agendar={acaoAgendarPedido}
                publicar={acaoPublicarPedido}
              />
            </div>
          )}
        </Secao>
      )}

      {publicacao && publicacao.situacao !== 'cancelada' && (
        <Secao titulo="Instagram" id="t-instagram">
          <div className="space-y-3">
            <p className="flex flex-wrap items-center gap-2">
              <Etiqueta tipo={publicacao.situacao === 'publicada' ? 'sucesso' : publicacao.situacao === 'falhou' || publicacao.atrasada ? 'erro' : 'info'}>
                {publicacao.situacao === 'publicada'
                  ? `Publicado em ${dataHoraBR(publicacao.publicadaEm ?? publicacao.previstaPara)}`
                  : publicacao.situacao === 'falhou'
                    ? 'Falhou: tente de novo'
                    : publicacao.situacao === 'publicando'
                      ? 'Publicando agora'
                      : `Publica pelo Elo em ${dataHoraBR(publicacao.previstaPara)}`}
              </Etiqueta>
            </p>
            {publicacao.situacao === 'pendente' && publicacao.erro && (
              <p className="text-sm text-texto-suave">A última tentativa não deu certo ({publicacao.erro}). O Elo tenta de novo sozinho; já foram {publicacao.tentativas} de 3.</p>
            )}
            {publicacao.atrasada && publicacao.situacao !== 'falhou' && (
              <Aviso tipo="atencao" titulo="A publicação está atrasada">
                Passou mais de 1 hora da hora marcada. Confira se a conta do Instagram continua conectada; se precisar, publique à mão.
              </Aviso>
            )}
            {publicacao.situacao === 'falhou' && (
              <Aviso tipo="erro" titulo="O Elo não conseguiu publicar">
                {publicacao.erro ?? 'O Instagram não respondeu como esperado.'} Você pode tentar de novo ou publicar à mão (use “Marcar como publicado” acima, com o link do post).
              </Aviso>
            )}
            {publicacao.link && (
              <p className="text-sm">
                <a href={publicacao.link} className="text-destaque underline" target="_blank" rel="noreferrer">
                  Abrir o post no Instagram
                </a>
              </p>
            )}
            {publicacao.situacao === 'falhou' && r.situacao === 'agendado' && (
              <FormularioConfirmado
                acao={acaoTentarDeNovoPublicacao}
                campos={{ id: r.id }}
                rotulo="Tentar de novo"
                perigoso={false}
                titulo="Tentar publicar de novo?"
                mensagem="O pedido volta para a fila e sai na próxima rodada, em até 15 minutos."
                confirmar="Tentar de novo"
              />
            )}
          </div>
        </Secao>
      )}

      {email && (
        <Secao titulo="E-mail pronto" id="t-email">
          <EmailPronto {...email} />
        </Secao>
      )}

      <Secao titulo="Dados do pedido" id="t-dados">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Dado rotulo="Tipo de peça">{NOME_TIPO_PECA[r.tipo_peca]}</Dado>
          <Dado rotulo="Tema do calendário">{r.calendario_tema ?? 'Fora do calendário'}</Dado>
          <Dado rotulo="Data desejada">{dataCurta(r.data_desejada)}</Dado>
          <Dado rotulo="Quem pediu">{r.solicitante_nome}</Dado>
          <Dado rotulo="Área">{nomeDaArea}</Dado>
          <Dado rotulo="Enviado em">{dataHoraBR(r.enviado_em)}</Dado>
          {r.link_video && (
            <Dado rotulo="Pasta do vídeo">
              <a href={r.link_video} className="text-destaque underline" target="_blank" rel="noreferrer">
                Abrir a pasta
              </a>
            </Dado>
          )}
          {r.agendado_para && <Dado rotulo="Agendado para">{dataHoraBR(r.agendado_para)}</Dado>}
          {r.link_publicacao && (
            <Dado rotulo="Link da publicação">
              <a href={r.link_publicacao} className="text-destaque underline" target="_blank" rel="noreferrer">
                Abrir a publicação
              </a>
            </Dado>
          )}
          {r.publicado_em && <Dado rotulo={r.situacao === 'realizada' ? 'Realizada em' : 'Publicado em'}>{dataHoraBR(r.publicado_em)}</Dado>}
          {r.juntado_a && <Dado rotulo="Juntado ao pedido">{r.juntado_a}</Dado>}
          {r.imagem_confirmada_em && <Dado rotulo="Uso de imagem confirmado em">{dataHoraBR(r.imagem_confirmada_em)}</Dado>}
        </dl>
        <p className="mt-4 whitespace-pre-line">{r.descricao}</p>
      </Secao>

      {d.anexos.length > 0 && (
        <Secao titulo="Fotos e documentos" descricao="Clique na foto para ver em tamanho grande. Cada abertura fica registrada." id="t-anexos">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {d.anexos.map((a) => (
              <li key={a.id} className="overflow-hidden rounded-lg border border-borda bg-superficie-2">
                {a.tipo === 'foto' ? (
                  <a
                    href={`/comunicacao/anexos/${a.id}`}
                    target="_blank"
                    rel="noopener"
                    className="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--destaque)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/comunicacao/anexos/${a.id}`}
                      alt={`Foto anexada ao pedido ${r.numero}`}
                      loading="lazy"
                      className="aspect-[4/3] w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                    />
                  </a>
                ) : (
                  <a
                    href={`/comunicacao/anexos/${a.id}`}
                    target="_blank"
                    rel="noopener"
                    className="flex aspect-[4/3] items-center justify-center px-2 text-center text-sm font-semibold text-destaque underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--destaque)]"
                  >
                    Abrir {a.mime === 'application/pdf' ? 'PDF' : 'documento Word'}
                  </a>
                )}
                <p className="truncate px-3 py-1.5 text-xs text-texto-suave" title={a.nome}>
                  {a.nome} ·{' '}
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
        <ol className="space-y-3 text-sm">
          {d.historico.map((h) => (
            <li key={h.id}>
              <p className="font-semibold">{h.acao === 'juntar' && h.de === h.para ? 'Outro pedido foi juntado a este' : (NOME_ACAO[h.acao] ?? h.acao)}</p>
              <p className="text-texto-suave">{dataHoraBR(h.em)}</p>
              {h.comentario && <p className="mt-1">{h.comentario}</p>}
            </li>
          ))}
        </ol>
      </Secao>
    </div>
  );
}
