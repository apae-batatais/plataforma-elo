import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { listarPedidos } from '@/modulos/comunicacao/aplicacao/pedidos';
import { ListaPedidos } from '@/modulos/comunicacao/telas/lista-pedidos';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { LinkBotao } from '@/ui/botao';
import { CabecalhoPagina, EstadoVazio } from '@/ui/pagina';

export const metadata: Metadata = { title: 'Meus pedidos' };

export default async function MeusPedidos() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const { planilhas } = await obterAplicacao();
  const linhas = await listarPedidos(planilhas, usuario.autorizador, 'meus');
  const novo = (
    <LinkBotao href="/comunicacao/novo" variante="primario">
      Novo pedido
    </LinkBotao>
  );
  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Comunicação' }]}
        titulo="Meus pedidos"
        descricao="Os pedidos de publicação que você fez e em que etapa cada um está."
        acoes={linhas.length > 0 ? novo : undefined}
      />
      {linhas.length === 0 ? (
        <EstadoVazio titulo="Você ainda não fez nenhum pedido" acao={novo}>
          Peça uma publicação (post, reel, release, artigo ou entrevista) e acompanhe cada etapa por aqui.
        </EstadoVazio>
      ) : (
        <ListaPedidos linhas={linhas} legenda="Meus pedidos de publicação" vazio="Nenhum pedido." />
      )}
    </div>
  );
}
