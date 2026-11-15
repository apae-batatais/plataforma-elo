import { redirect } from 'next/navigation';
import { Exercicios } from '@/modulos/orcamento/dados/tabelas';
import { ErroArmazenamento, ErroEstruturaAusente } from '@/nucleo/armazenamento/armazenamento';
import { lerTabelas } from '@/nucleo/armazenamento/tabela';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { ConfiguracaoInvalida } from '../../configuracao-invalida';

/** O painel de sustentabilidade usa a planilha "orcamento": confere se ela existe e já tem as abas. */
export default async function LayoutSustentabilidade({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissao('orcamento.sustentabilidade.ver')) redirect('/');
  try {
    const { planilhas } = await obterAplicacao();
    await lerTabelas(planilhas, [Exercicios] as const);
  } catch (erro) {
    if (erro instanceof ErroEstruturaAusente) {
      return (
        <ConfiguracaoInvalida
          titulo="Falta preparar as abas do Orçamento"
          mensagem={`${erro.message} A administração da plataforma faz isso em Administração › Estrutura das planilhas › Preparar estrutura.`}
        />
      );
    }
    if (erro instanceof ErroArmazenamento) return <ConfiguracaoInvalida titulo="O Orçamento ainda não tem a sua planilha" mensagem={erro.message} />;
    throw erro;
  }
  return children;
}
