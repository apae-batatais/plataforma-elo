import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { detalharPedido, opcoesDoPedido } from '@/modulos/comunicacao/aplicacao/pedidos';
import { ErroComunicacao, NOME_TIPO_PECA } from '@/modulos/comunicacao/dominio/pedido';
import { dataCurta } from '@/modulos/comunicacao/telas/mes';
import { dataHoraBR, EtiquetaSituacao, EtiquetaUrgente } from '@/modulos/comunicacao/telas/rotulos';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { LinkBotao } from '@/ui/botao';
import { FormularioConfirmado } from '@/ui/confirmar';
import { CabecalhoPagina, Secao } from '@/ui/pagina';
import { acaoCancelarPedido } from '../acoes';

export const metadata: Metadata = { title: 'Pedido' };

const NOME_ACAO: Record<string, string> = {
  enviar: 'Pedido enviado',
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

      {(d.acoes.includes('reenviar') || d.acoes.includes('cancelar')) && (
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
          {r.imagem_confirmada_em && <Dado rotulo="Uso de imagem confirmado em">{dataHoraBR(r.imagem_confirmada_em)}</Dado>}
        </dl>
        <p className="mt-4 whitespace-pre-line">{r.descricao}</p>
        {d.anexos.length > 0 && (
          <ul className="mt-4 list-disc pl-5 text-sm">
            {d.anexos.map((a) => (
              <li key={a.id}>{a.nome}</li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao titulo="Histórico" id="t-historico">
        <ol className="space-y-3 text-sm">
          {d.historico.map((h) => (
            <li key={h.id}>
              <p className="font-semibold">{NOME_ACAO[h.acao] ?? h.acao}</p>
              <p className="text-texto-suave">{dataHoraBR(h.em)}</p>
              {h.comentario && <p className="mt-1">{h.comentario}</p>}
            </li>
          ))}
        </ol>
      </Secao>
    </div>
  );
}
