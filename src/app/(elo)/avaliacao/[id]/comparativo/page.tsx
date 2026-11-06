import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { historicoDaPessoa, PERM } from '@/modulos/avaliacao/aplicacao/avaliacoes';
import { ErroAvaliacao } from '@/modulos/avaliacao/dominio/avaliacao';
import { BarraImpressao } from '@/modulos/avaliacao/telas/barra-impressao';
import { ComparativoPessoa } from '@/modulos/avaliacao/telas/comparativo-pessoa';
import { agoraBrasilia, Folha } from '@/modulos/avaliacao/telas/folha';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { LinkBotao, pequeno } from '@/ui/botao';

export const metadata: Metadata = { title: 'Comparativo das avaliações' };

const br = (iso: string) => iso.split('-').reverse().join('/');

export default async function ComparativoDaPessoa({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo(PERM.avaliar)) redirect('/avaliacao/painel');
  const app = await obterAplicacao();
  let h;
  try {
    h = await historicoDaPessoa(app.planilhas, usuario.autorizador, id);
  } catch (erro) {
    if (erro instanceof ErroAvaliacao || erro instanceof ErroPermissao) redirect(`/avaliacao?erro=${encodeURIComponent(erro.message)}`);
    throw erro;
  }
  const ultima = h.avaliacoes[h.avaliacoes.length - 1];
  return (
    <div>
      <BarraImpressao voltar="/avaliacao" rotuloVoltar="Voltar para as avaliações" />
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end print:hidden">
        <LinkBotao href={`/avaliacao/nova?de=${ultima.id}`} className={pequeno}>
          Fazer o acompanhamento anual
        </LinkBotao>
      </div>
      <Folha
        instituicao={app.instituicao.nome}
        titulo="Comparativo das avaliações"
        subtitulo={`${h.iniciais} · ${br(h.nascimento)} · ${h.sexo} — ${ultima.servicoNome}`}
        emitidoPor={usuario.nome}
        emitidoEm={agoraBrasilia()}
        sigilo="Documento com dados pessoais sensíveis (LGPD). Guarde no prontuário, em local restrito."
      >
        <ComparativoPessoa h={h} />
      </Folha>
    </div>
  );
}
