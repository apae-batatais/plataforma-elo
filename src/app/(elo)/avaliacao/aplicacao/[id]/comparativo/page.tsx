import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { comparativoDaPessoa } from '@/modulos/avaliacao/aplicacao/aplicacoes';
import { PERM } from '@/modulos/avaliacao/aplicacao/avaliacoes';
import { ErroAvaliacao } from '@/modulos/avaliacao/dominio/avaliacao';
import { ComparativoAplicacoes } from '@/modulos/avaliacao/telas/comparativo-aplicacoes';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { LinkBotao, pequeno } from '@/ui/botao';
import { CabecalhoPagina } from '@/ui/pagina';

export const metadata: Metadata = { title: 'Comparativo da pessoa' };

export default async function ComparativoDaAplicacao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo(PERM.avaliar)) redirect('/avaliacao/painel');
  const app = await obterAplicacao();
  let c;
  try {
    c = await comparativoDaPessoa(app.planilhas, usuario.autorizador, id);
  } catch (erro) {
    if (erro instanceof ErroAvaliacao || erro instanceof ErroPermissao) redirect(`/avaliacao/instrumentos?erro=${encodeURIComponent(erro.message)}`);
    throw erro;
  }
  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[
          { rotulo: 'Início', href: '/' },
          { rotulo: 'Avaliação de Serviços Sociais', href: '/avaliacao' },
          { rotulo: 'Instrumentos', href: '/avaliacao/instrumentos' },
          { rotulo: 'Comparativo' },
        ]}
        titulo={`Comparativo de ${c.iniciais}`}
        descricao={`${c.instrumentoNome}. Só entram aplicações concluídas da mesma versão do instrumento.`}
        acoes={
          c.abertaId ? (
            <LinkBotao href={`/avaliacao/aplicacao/${c.abertaId}`} className={pequeno}>
              Continuar aplicação em aberto
            </LinkBotao>
          ) : (
            <LinkBotao href={`/avaliacao/aplicar/${c.instrumentoCodigo}`} className={pequeno}>
              Nova aplicação
            </LinkBotao>
          )
        }
      />
      <ComparativoAplicacoes c={c} />
    </div>
  );
}
