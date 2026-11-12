import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { listarProjetos } from '@/modulos/projetos/aplicacao/ideias';
import { ListaProjetos } from '@/modulos/projetos/telas/lista-projetos';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { CabecalhoPagina } from '@/ui/pagina';

export const metadata: Metadata = { title: 'Todos os projetos' };

export default async function Todos() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissao('projetos.ver_todos')) redirect('/projetos');
  const { planilhas } = await obterAplicacao();
  const linhas = await listarProjetos(planilhas, usuario.autorizador, 'todos');
  return (
    <div className="space-y-6">
      <CabecalhoPagina trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Projetos', href: '/projetos' }, { rotulo: 'Todos os projetos' }]} titulo="Todos os projetos" descricao="Todas as ideias e projetos da instituição, em qualquer etapa." />
      <ListaProjetos linhas={linhas} legenda="Todos os projetos" vazio="Nenhum projeto cadastrado ainda." />
    </div>
  );
}
