import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { detalharPedido, opcoesDoPedido } from '@/modulos/comunicacao/aplicacao/pedidos';
import { ErroComunicacao } from '@/modulos/comunicacao/dominio/pedido';
import { FormularioPedido } from '@/modulos/comunicacao/telas/formulario-pedido';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { CabecalhoPagina } from '@/ui/pagina';
import { acaoIniciarEnvioAnexo, acaoReenviarPedido } from '../../acoes';

export const metadata: Metadata = { title: 'Ajustar pedido' };

export default async function AjustarPedido({ params }: { params: Promise<{ id: string }> }) {
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
  if (!d.acoes.includes('reenviar')) redirect(`/comunicacao/${id}`);
  const opcoes = await opcoesDoPedido(planilhas, usuario.autorizador);
  const r = d.pedido;
  const devolucao = [...d.historico].reverse().find((h) => h.acao === 'devolver');
  return (
    <div className="max-w-3xl">
      <CabecalhoPagina
        trilha={[
          { rotulo: 'Início', href: '/' },
          { rotulo: 'Comunicação', href: '/comunicacao' },
          { rotulo: r.numero, href: `/comunicacao/${id}` },
          { rotulo: 'Ajustar' },
        ]}
        titulo={`Ajustar ${r.numero}`}
        descricao="Faça o ajuste pedido e reenvie. O pedido volta para a revisão da Comunicação."
      />
      {devolucao?.comentario && (
        <div className="mb-6">
          <Aviso tipo="atencao" titulo="O que a Comunicação pediu">
            {devolucao.comentario}
          </Aviso>
        </div>
      )}
      <FormularioPedido
        acao={acaoReenviarPedido}
        {...opcoes}
        rotuloEnviar="Reenviar pedido"
        iniciarEnvio={arquivos ? acaoIniciarEnvioAnexo : undefined}
        anexosIniciais={d.anexos.map((a) => ({
          chave: a.id,
          tipo: a.tipo,
          nome: a.nome,
          // O código do arquivo não sai do servidor: o anexo que fica é indicado pelo id dele.
          arquivoId: a.id,
          previa: a.tipo === 'foto' ? `/comunicacao/anexos/${a.id}` : null,
          progresso: 100,
          erro: null,
        }))}
        oculto={{ id: r.id, versao: r.versao }}
        inicial={{
          area: r.area,
          calendarioId: r.calendario_id,
          calendarioTema: r.calendario_tema,
          tipoPeca: r.tipo_peca,
          titulo: r.titulo,
          descricao: r.descricao,
          dataDesejada: r.data_desejada,
          linkVideo: r.link_video,
        }}
      />
    </div>
  );
}
