import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { fichaDaAvaliacao, PERM } from '@/modulos/avaliacao/aplicacao/avaliacoes';
import { ErroAvaliacao } from '@/modulos/avaliacao/dominio/avaliacao';
import { BarraImpressao } from '@/modulos/avaliacao/telas/barra-impressao';
import { FichaAvaliacao } from '@/modulos/avaliacao/telas/ficha-avaliacao';
import { agoraBrasilia, Folha } from '@/modulos/avaliacao/telas/folha';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';

export const metadata: Metadata = { title: 'Ficha da avaliação' };

const br = (iso: string) => iso.split('-').reverse().join('/');

export default async function FichaDaAvaliacao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo(PERM.avaliar)) redirect('/avaliacao/painel');
  const app = await obterAplicacao();
  let av;
  try {
    av = await fichaDaAvaliacao(app.planilhas, usuario.autorizador, id);
  } catch (erro) {
    if (erro instanceof ErroAvaliacao || erro instanceof ErroPermissao) redirect(`/avaliacao?erro=${encodeURIComponent(erro.message)}`);
    throw erro;
  }
  const d = av.dados;
  return (
    <div>
      <BarraImpressao voltar={`/avaliacao/${av.id}`} rotuloVoltar="Voltar para a avaliação" />
      <Folha
        instituicao={app.instituicao.nome}
        titulo="Ficha de avaliação diagnóstica"
        subtitulo={`${d.iniciais} · ${br(d.nascimento)} · ${d.sexo} — ${av.servicoNome}`}
        emitidoPor={usuario.nome}
        emitidoEm={agoraBrasilia()}
        sigilo="Documento com dados pessoais sensíveis (LGPD). Guarde no prontuário, em local restrito."
      >
        <FichaAvaliacao d={d} servicoNome={av.servicoNome} />
      </Folha>
    </div>
  );
}
