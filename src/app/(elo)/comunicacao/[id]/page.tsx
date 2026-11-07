import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { detalharPedido, listarPedidos, opcoesDoPedido } from '@/modulos/comunicacao/aplicacao/pedidos';
import { ErroComunicacao, NOME_TIPO_PECA, SITUACOES_FINAIS } from '@/modulos/comunicacao/dominio/pedido';
import { ACOES_DA_EQUIPE } from '@/modulos/comunicacao/telas/acoes-da-equipe';
import { AcoesPedido } from '@/modulos/comunicacao/telas/acoes-pedido';
import { dataCurta } from '@/modulos/comunicacao/telas/mes';
import { dataHoraBR, EtiquetaSituacao, EtiquetaUrgente } from '@/modulos/comunicacao/telas/rotulos';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { LinkBotao } from '@/ui/botao';
import { FormularioConfirmado } from '@/ui/confirmar';
import { CabecalhoPagina, Secao } from '@/ui/pagina';
import { acaoCancelarPedido, acaoDecidirPedido, acaoJuntarPedido, acaoRevisarPedido } from '../acoes';

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
  const { planilhas } = await obterAplicacao();
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

      {(d.acoes.includes('reenviar') || d.acoes.includes('cancelar') || daEquipe) && (
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
                  {a.tipo === 'foto' ? 'Foto' : a.nome} ·{' '}
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
