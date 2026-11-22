import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { comparativoDaPessoa, PERM } from '@/modulos/educacao/aplicacao/avaliacoes';
import { ErroEducacao } from '@/modulos/educacao/dominio/educacao';
import { ComparativoPessoa } from '@/modulos/educacao/telas/comparativo-pessoa';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { LinkBotao, pequeno } from '@/ui/botao';
import { CabecalhoPagina } from '@/ui/pagina';

export const metadata: Metadata = { title: 'Comparativo da pessoa' };

export default async function ComparativoDeEducacao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo(PERM.avaliar)) redirect('/educacao/sobre');
  const app = await obterAplicacao();
  let c;
  try {
    c = await comparativoDaPessoa(app.planilhas, usuario.autorizador, id);
  } catch (erro) {
    if (erro instanceof ErroEducacao || erro instanceof ErroPermissao) redirect(`/educacao?erro=${encodeURIComponent(erro.message)}`);
    throw erro;
  }
  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Avaliações' }, { rotulo: 'Educação', href: '/educacao' }, { rotulo: c.pessoaNome, href: `/educacao/${id}` }, { rotulo: 'Comparativo' }]}
        titulo={`Comparativo de ${c.pessoaNome}`}
        descricao="Só entram avaliações concluídas e não corrigidas, da mesma versão do instrumento."
        acoes={
          c.abertaId ? (
            <LinkBotao href={`/educacao/${c.abertaId}`} className={pequeno}>Continuar rascunho</LinkBotao>
          ) : (
            <LinkBotao href={`/educacao/nova?pessoa=${encodeURIComponent(c.pessoaId)}`} className={pequeno}>Reavaliar</LinkBotao>
          )
        }
      />
      <ComparativoPessoa c={c} />
    </div>
  );
}
