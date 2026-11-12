import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { listarProjetos } from '@/modulos/projetos/aplicacao/ideias';
import { ListaProjetos } from '@/modulos/projetos/telas/lista-projetos';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { CabecalhoPagina } from '@/ui/pagina';

export const metadata: Metadata = { title: 'Ideias à espera de responsável' };

export default async function Ideias() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo('projetos.assumir')) redirect('/projetos');
  const { planilhas } = await obterAplicacao();
  const linhas = await listarProjetos(planilhas, usuario.autorizador, 'aguardando');
  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Projetos', href: '/projetos' }, { rotulo: 'Ideias à espera de responsável' }]}
        titulo="Ideias à espera de responsável"
        descricao="Abra uma ideia e use “Assumir como responsável” para conduzi-la até as portas de decisão."
      />
      <ListaProjetos linhas={linhas} legenda="Ideias à espera de responsável" vazio="Nenhuma ideia esperando responsável." />
    </div>
  );
}
