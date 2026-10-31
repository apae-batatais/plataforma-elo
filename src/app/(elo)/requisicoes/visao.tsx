import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { listarRequisicoes, type Visao } from '@/modulos/requisicoes/aplicacao/requisicoes';
import { ListaRequisicoes } from '@/modulos/requisicoes/telas/lista-requisicoes';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { CabecalhoPagina } from '@/ui/pagina';

/** Página de lista (minhas, para aprovar, para atender, todas). */
export async function PaginaDeLista({ visao, titulo, descricao, vazio, acoes }: { visao: Visao; titulo: string; descricao: string; vazio: string; acoes?: ReactNode }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const app = await obterAplicacao();
  let linhas;
  try {
    linhas = await listarRequisicoes(app.planilhas, usuario.autorizador, visao);
  } catch (erro) {
    if (erro instanceof ErroPermissao) redirect('/requisicoes');
    throw erro;
  }
  return (
    <div>
      <CabecalhoPagina trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Requisições', href: '/requisicoes' }, { rotulo: titulo }]} titulo={titulo} descricao={descricao} acoes={acoes} />
      <ListaRequisicoes linhas={linhas} legenda={titulo} vazio={vazio} comRequisitante={visao !== 'minhas'} />
    </div>
  );
}
