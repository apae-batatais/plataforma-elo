import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { instrumentoParaAplicar, pessoasParaAplicar } from '@/modulos/avaliacao/aplicacao/aplicacoes';
import { PERM } from '@/modulos/avaliacao/aplicacao/avaliacoes';
import { ErroAvaliacao } from '@/modulos/avaliacao/dominio/avaliacao';
import { FormularioAplicacao } from '@/modulos/avaliacao/telas/formulario-aplicacao';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { CabecalhoPagina } from '@/ui/pagina';
import { acaoSalvarAplicacao } from '../../acoes';

export const metadata: Metadata = { title: 'Aplicar instrumento' };

const hojeBrasilia = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

export default async function AplicarInstrumento({ params }: { params: Promise<{ instrumento: string }> }) {
  const { instrumento: codigo } = await params;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo(PERM.avaliar)) redirect('/avaliacao/painel');
  const app = await obterAplicacao();
  let instrumento;
  try {
    instrumento = await instrumentoParaAplicar(app.planilhas, usuario.autorizador, codigo);
  } catch (erro) {
    if (erro instanceof ErroAvaliacao) redirect(`/avaliacao/instrumentos?erro=${encodeURIComponent(erro.message)}`);
    throw erro;
  }
  const pessoas = await pessoasParaAplicar(app.planilhas, usuario.autorizador);
  const hoje = hojeBrasilia();
  return (
    <div>
      <CabecalhoPagina
        trilha={[
          { rotulo: 'Início', href: '/' },
          { rotulo: 'Avaliação de Serviços Sociais', href: '/avaliacao' },
          { rotulo: 'Instrumentos', href: '/avaliacao/instrumentos' },
          { rotulo: instrumento.nome },
        ]}
        titulo={instrumento.nome}
        descricao="Escolha a pessoa e responda cada item de 0 a 3. Salve o rascunho quando quiser e conclua quando todos os itens estiverem respondidos."
      />
      {pessoas.length === 0 ? (
        <Aviso tipo="atencao" titulo="Nenhuma pessoa para avaliar">
          Não há pessoas do Cadastro Único com vínculo ativo nos serviços do seu escopo. A pessoa precisa estar vinculada a um serviço em Pessoas.
        </Aviso>
      ) : (
        <FormularioAplicacao
          instrumento={instrumento}
          pessoas={pessoas}
          hoje={hoje}
          acao={acaoSalvarAplicacao}
          inicial={{ pessoaId: '', servico: '', tipo: 'Inicial', data: hoje, respostas: {}, profissional: '', registroProfissional: '', justificativa: '' }}
        />
      )}
    </div>
  );
}
