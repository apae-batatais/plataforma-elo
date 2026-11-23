import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { opcoesDoPedido } from '@/modulos/comunicacao/aplicacao/pedidos';
import { FormularioPedido } from '@/modulos/comunicacao/telas/formulario-pedido';
import { projetosParaPedido } from '@/plataforma/ligacoes';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { CabecalhoPagina } from '@/ui/pagina';
import { acaoEnviarPedido, acaoIniciarEnvioAnexo } from '../acoes';

export const metadata: Metadata = { title: 'Novo pedido' };

export default async function NovoPedido() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo('comunicacao.solicitar')) redirect('/comunicacao');
  const { planilhas, arquivos } = await obterAplicacao();
  const opcoes = await opcoesDoPedido(planilhas, usuario.autorizador);
  return (
    <div className="max-w-3xl">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Comunicação', href: '/comunicacao' }, { rotulo: 'Novo pedido' }]}
        titulo="Novo pedido"
        descricao="Depois de enviado, o pedido vai para a revisão da Comunicação. Você acompanha cada etapa em Meus pedidos."
      />
      <FormularioPedido acao={acaoEnviarPedido} {...opcoes} projetos={await projetosParaPedido(planilhas, usuario.autorizador)} rotuloEnviar="Enviar pedido" iniciarEnvio={arquivos ? acaoIniciarEnvioAnexo : undefined} />
    </div>
  );
}
