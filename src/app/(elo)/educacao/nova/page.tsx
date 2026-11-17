import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { opcoesParaNova, PERM } from '@/modulos/educacao/aplicacao/avaliacoes';
import { FormularioAplicacao } from '@/modulos/educacao/telas/formulario-aplicacao';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { CabecalhoPagina } from '@/ui/pagina';
import { acaoSalvarAplicacao } from '../acoes';

export const metadata: Metadata = { title: 'Nova avaliação de Educação' };

const hojeBrasilia = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

export default async function NovaAvaliacao() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissaoAlgumEscopo(PERM.avaliar)) redirect('/educacao/sobre');
  const app = await obterAplicacao();
  const opcoes = await opcoesParaNova(app.planilhas, usuario.autorizador);
  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Educação', href: '/educacao' }, { rotulo: 'Nova avaliação' }]}
        titulo="Nova avaliação"
        descricao="Escolha a pessoa, o período e dê uma nota de 0 a 3 a cada item. O total e os subtotais mudam enquanto você responde."
      />
      {opcoes.servicos.length === 0 ? (
        <Aviso tipo="atencao" titulo="Nenhum serviço de Educação para avaliar">
          Você não tem serviço de Educação no seu escopo. A administração liga o seu acesso ao serviço em Administração › Acessos.
        </Aviso>
      ) : (
        <FormularioAplicacao
          pessoas={opcoes.pessoas}
          servicos={opcoes.servicos}
          instrumentos={opcoes.instrumentos}
          hoje={hojeBrasilia()}
          acao={acaoSalvarAplicacao}
          inicial={{ pessoaId: '', servico: '', instrumento: '', periodoInicio: '', periodoFim: '', dataIngresso: '', profissional: '', funcao: '', justificativa: '', respostas: {} }}
        />
      )}
    </div>
  );
}
