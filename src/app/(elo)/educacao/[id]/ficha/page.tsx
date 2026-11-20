import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { fichaDaAplicacao, PERM } from '@/modulos/educacao/aplicacao/avaliacoes';
import { ErroEducacao } from '@/modulos/educacao/dominio/educacao';
import { BarraImpressao } from '@/modulos/educacao/telas/barra-impressao';
import { FichaEducacao } from '@/modulos/educacao/telas/ficha-educacao';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';

export const metadata: Metadata = { title: 'Ficha da avaliação de Educação' };

const agoraBrasilia = () =>
  new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default async function FichaDeEducacao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo(PERM.avaliar)) redirect('/educacao/sobre');
  const app = await obterAplicacao();
  let a;
  try {
    a = await fichaDaAplicacao(app.planilhas, usuario.autorizador, id);
  } catch (erro) {
    if (erro instanceof ErroEducacao || erro instanceof ErroPermissao) redirect(`/educacao?erro=${encodeURIComponent(erro.message)}`);
    throw erro;
  }
  return (
    <div>
      <BarraImpressao voltar={`/educacao/${a.id}`} rotuloVoltar="Voltar para a avaliação" />
      <FichaEducacao a={a} instituicao={app.instituicao.nome} emitidoPor={usuario.nome} emitidoEm={agoraBrasilia()} />
    </div>
  );
}
