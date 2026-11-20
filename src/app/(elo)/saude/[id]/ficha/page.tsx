import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PERM } from '@/modulos/saude/aplicacao/avaliacoes';
import { fichaDaAplicacao } from '@/modulos/saude/aplicacao/comparativo';
import { ErroSaude } from '@/modulos/saude/dominio/cer';
import { BarraImpressao } from '@/modulos/saude/telas/barra-impressao';
import { FichaSaude } from '@/modulos/saude/telas/ficha-saude';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';

export const metadata: Metadata = { title: 'Ficha da avaliação de Saúde' };

const agoraBrasilia = () =>
  new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default async function FichaDeSaude({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo(PERM.avaliar)) redirect('/saude/sobre');
  const app = await obterAplicacao();
  let a;
  try {
    a = await fichaDaAplicacao(app.planilhas, usuario.autorizador, id);
  } catch (erro) {
    if (erro instanceof ErroSaude || erro instanceof ErroPermissao) redirect(`/saude?erro=${encodeURIComponent(erro.message)}`);
    throw erro;
  }
  return (
    <div>
      <BarraImpressao voltar={`/saude/${a.id}`} rotuloVoltar="Voltar para a avaliação" />
      <FichaSaude a={a} instituicao={app.instituicao.nome} emitidoPor={usuario.nome} emitidoEm={agoraBrasilia()} />
    </div>
  );
}
