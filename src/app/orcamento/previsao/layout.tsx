import { redirect } from 'next/navigation';
import { Exercicios } from '@/modulos/orcamento/dados/tabelas';
import { ErroArmazenamento, ErroEstruturaAusente } from '@/nucleo/armazenamento/armazenamento';
import { lerTabelas } from '@/nucleo/armazenamento/tabela';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { ConfiguracaoInvalida } from '../../configuracao-invalida';

/** A previsão usa a planilha "orcamento": confere se ela existe e já tem as abas. */
export default async function LayoutPrevisao({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const a = usuario.autorizador;
  if (!a.temPermissao('orcamento.painel.ver') && !a.temPermissao('orcamento.previsao.editar') && !a.temPermissaoAlgumEscopo('orcamento.previsao.propor')) redirect('/orcamento');
  try {
    const { planilhas } = await obterAplicacao();
    await lerTabelas(planilhas, [Exercicios] as const);
  } catch (erro) {
    if (erro instanceof ErroEstruturaAusente) {
      return (
        <ConfiguracaoInvalida
          titulo="Falta preparar as abas da Previsão"
          mensagem={`${erro.message} A administração da plataforma faz isso em Administração › Estrutura das planilhas › Preparar estrutura.`}
        />
      );
    }
    if (erro instanceof ErroArmazenamento) return <ConfiguracaoInvalida titulo="A Previsão ainda não tem a sua planilha" mensagem={erro.message} />;
    throw erro;
  }
  return children;
}
