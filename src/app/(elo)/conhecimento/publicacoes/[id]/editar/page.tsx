import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { listarCategorias } from '@/modulos/conhecimento/aplicacao/categorias';
import { opcoesDePublico, publicacaoParaEditar } from '@/modulos/conhecimento/aplicacao/publicacoes';
import { ErroConhecimento } from '@/modulos/conhecimento/dominio/publicacao';
import { FormularioPublicacao } from '@/modulos/conhecimento/telas/formulario-publicacao';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { CabecalhoPagina } from '@/ui/pagina';
import { acaoIniciarEnvioAnexo, acaoSalvarPublicacao } from '../../../acoes';

export const metadata: Metadata = { title: 'Editar publicação' };

export default async function EditarPublicacao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissao('conhecimento.publicar')) redirect('/conhecimento');
  const { planilhas } = await obterAplicacao();
  let valor;
  try {
    valor = await publicacaoParaEditar(planilhas, usuario.autorizador, id);
  } catch (erro) {
    if (erro instanceof ErroConhecimento) notFound();
    throw erro;
  }
  // Categoria desativada que a publicação já usa continua na lista, para não perder a escolha.
  const categorias = (await listarCategorias(planilhas, usuario.autorizador)).filter((c) => c.ativo || c.codigo === valor.categoria);
  const { perfis, areas } = await opcoesDePublico(planilhas, usuario.autorizador);

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Base de Conhecimento', href: '/conhecimento' }, { rotulo: 'Publicações', href: '/conhecimento/publicacoes' }, { rotulo: 'Editar' }]}
        titulo={`Editar “${valor.titulo}”`}
        descricao="Mudar título, resumo, categoria, público ou anexo não pede nova ciência. Mudar o texto pede que você escolha."
      />
      <FormularioPublicacao acao={acaoSalvarPublicacao} iniciarEnvio={acaoIniciarEnvioAnexo} categorias={categorias} perfis={perfis} areas={areas} valor={valor} />
    </div>
  );
}
