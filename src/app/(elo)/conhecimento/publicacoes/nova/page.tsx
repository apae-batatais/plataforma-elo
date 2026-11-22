import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { listarCategorias } from '@/modulos/conhecimento/aplicacao/categorias';
import { opcoesDePublico } from '@/modulos/conhecimento/aplicacao/publicacoes';
import { FormularioPublicacao } from '@/modulos/conhecimento/telas/formulario-publicacao';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { LinkBotao } from '@/ui/botao';
import { CabecalhoPagina } from '@/ui/pagina';
import { acaoIniciarEnvioAnexo, acaoSalvarPublicacao } from '../../acoes';

export const metadata: Metadata = { title: 'Nova publicação' };

export default async function NovaPublicacao() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissao('conhecimento.publicar')) redirect('/conhecimento');
  const { planilhas } = await obterAplicacao();
  const categorias = (await listarCategorias(planilhas, usuario.autorizador)).filter((c) => c.ativo);
  const { perfis, areas } = await opcoesDePublico(planilhas, usuario.autorizador);
  const gerencia = usuario.autorizador.temPermissao('conhecimento.categorias.gerenciar');

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Base de Conhecimento', href: '/conhecimento' }, { rotulo: 'Publicações', href: '/conhecimento/publicacoes' }, { rotulo: 'Nova publicação' }]}
        titulo="Nova publicação"
        descricao="Salve como rascunho para revisar antes; ninguém é avisado até você publicar."
      />
      {categorias.length === 0 ? (
        <Aviso
          tipo="atencao"
          titulo="Falta uma categoria"
          acao={gerencia ? <LinkBotao href="/conhecimento/categorias" variante="secundario">Cadastrar categoria</LinkBotao> : undefined}
        >
          Toda publicação precisa de uma categoria. {gerencia ? 'Cadastre a primeira para continuar.' : 'Peça a quem administra a Base de Conhecimento para cadastrar.'}
        </Aviso>
      ) : (
        <FormularioPublicacao acao={acaoSalvarPublicacao} iniciarEnvio={acaoIniciarEnvioAnexo} categorias={categorias} perfis={perfis} areas={areas} />
      )}
    </div>
  );
}
