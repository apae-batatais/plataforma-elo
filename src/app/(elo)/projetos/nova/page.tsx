import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { servicosParaEscolher } from '@/modulos/projetos/aplicacao/ideias';
import { FormularioIdeia } from '@/modulos/projetos/telas/formulario-ideia';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { CabecalhoPagina } from '@/ui/pagina';
import { acaoSalvarIdeia } from '../acoes';

export const metadata: Metadata = { title: 'Nova ideia' };

export default async function NovaIdeia() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo('projetos.propor')) redirect('/projetos');
  const { planilhas } = await obterAplicacao();
  return (
    <div className="max-w-3xl">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Projetos', href: '/projetos' }, { rotulo: 'Nova ideia' }]}
        titulo="Nova ideia"
        descricao="Conte a ideia. Você pode salvar como rascunho ou enviar para uma coordenação assumir como responsável."
      />
      <FormularioIdeia acao={acaoSalvarIdeia} servicos={await servicosParaEscolher(planilhas)} />
    </div>
  );
}
