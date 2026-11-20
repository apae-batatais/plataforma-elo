import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PERM } from '@/modulos/saude/aplicacao/avaliacoes';
import { comparativoDaPessoa } from '@/modulos/saude/aplicacao/comparativo';
import { ErroSaude } from '@/modulos/saude/dominio/cer';
import { ComparativoPessoa } from '@/modulos/saude/telas/comparativo-pessoa';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { LinkBotao, pequeno } from '@/ui/botao';
import { CabecalhoPagina } from '@/ui/pagina';

export const metadata: Metadata = { title: 'Comparativo da pessoa' };

export default async function ComparativoDeSaude({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo(PERM.avaliar)) redirect('/saude/sobre');
  const app = await obterAplicacao();
  let c;
  try {
    c = await comparativoDaPessoa(app.planilhas, usuario.autorizador, id);
  } catch (erro) {
    if (erro instanceof ErroSaude || erro instanceof ErroPermissao) redirect(`/saude?erro=${encodeURIComponent(erro.message)}`);
    throw erro;
  }
  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Saúde', href: '/saude' }, { rotulo: c.pessoaNome, href: `/saude/${id}` }, { rotulo: 'Comparativo' }]}
        titulo={`Comparativo de ${c.pessoaNome}`}
        descricao="Só entram avaliações concluídas e não corrigidas, da mesma versão do instrumento."
        acoes={
          c.abertaId ? (
            <LinkBotao href={`/saude/${c.abertaId}`} className={pequeno}>Continuar rascunho</LinkBotao>
          ) : (
            <LinkBotao href={`/saude/nova?pessoa=${encodeURIComponent(c.pessoaId)}`} className={pequeno}>Reavaliar</LinkBotao>
          )
        }
      />
      <ComparativoPessoa c={c} />
    </div>
  );
}
