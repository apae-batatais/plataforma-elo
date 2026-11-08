import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { detalharPedido, opcoesDoPedido } from '@/modulos/comunicacao/aplicacao/pedidos';
import { ErroComunicacao } from '@/modulos/comunicacao/dominio/pedido';
import { EditarNaRevisao } from '@/modulos/comunicacao/telas/editar-na-revisao';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { CabecalhoPagina } from '@/ui/pagina';
import { acaoEditarNaRevisao, acaoIniciarEnvioAnexo } from '../../acoes';

export const metadata: Metadata = { title: 'Editar pedido na revisão' };

export default async function EditarPedidoNaRevisao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const { planilhas, arquivos } = await obterAplicacao();
  let d;
  try {
    d = await detalharPedido(planilhas, usuario.autorizador, id);
  } catch (erro) {
    if (erro instanceof ErroComunicacao) notFound();
    if (erro instanceof ErroPermissao) redirect('/comunicacao');
    throw erro;
  }
  if (!d.acoes.includes('enviar_aprovacao')) redirect(`/comunicacao/${id}`);
  const opcoes = await opcoesDoPedido(planilhas, usuario.autorizador);
  const r = d.pedido;
  return (
    <div className="max-w-3xl">
      <CabecalhoPagina
        trilha={[
          { rotulo: 'Início', href: '/' },
          { rotulo: 'Comunicação', href: '/comunicacao' },
          { rotulo: r.numero, href: `/comunicacao/${id}` },
          { rotulo: 'Editar' },
        ]}
        titulo={`Editar ${r.numero}`}
        descricao="As alterações ficam registradas no histórico do pedido, com o nome dos campos que mudaram."
      />
      <EditarNaRevisao
        acao={acaoEditarNaRevisao}
        id={id}
        versao={r.versao}
        itens={opcoes.itens}
        iniciarEnvio={arquivos ? acaoIniciarEnvioAnexo : undefined}
        anexosIniciais={d.anexos.map((a) => ({
          chave: a.id,
          tipo: a.tipo,
          nome: a.nome,
          arquivoId: a.id,
          previa: a.tipo === 'foto' ? `/comunicacao/anexos/${a.id}` : null,
          progresso: 100,
          erro: null,
        }))}
        inicial={{
          titulo: r.titulo,
          descricao: r.descricao,
          tipoPeca: r.tipo_peca,
          calendarioId: r.calendario_id,
          calendarioTema: r.calendario_tema,
          dataDesejada: r.data_desejada,
        }}
      />
    </div>
  );
}
