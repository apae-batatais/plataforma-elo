import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { usuarioLogado } from '@/plataforma/sessao';
import { LinkBotao } from '@/ui/botao';
import { CabecalhoPagina, EstadoVazio } from '@/ui/pagina';

export const metadata: Metadata = { title: 'Meus pedidos' };

export default async function MeusPedidos() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const cuidaDoCalendario = usuario.autorizador.temPermissao('comunicacao.calendario.gerenciar');
  return (
    <div className="space-y-6">
      <CabecalhoPagina trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Comunicação' }]} titulo="Meus pedidos" />
      <EstadoVazio
        titulo="Os pedidos de publicação chegam na próxima entrega"
        acao={
          cuidaDoCalendario ? (
            <LinkBotao href="/comunicacao/calendario" variante="secundario">
              Abrir o calendário
            </LinkBotao>
          ) : undefined
        }
      >
        Por enquanto, a Comunicação está montando o calendário de temas. Em breve você poderá pedir uma publicação e acompanhar cada pedido aqui.
      </EstadoVazio>
    </div>
  );
}
