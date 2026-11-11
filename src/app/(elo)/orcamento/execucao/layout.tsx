import { redirect } from 'next/navigation';
import { Realizado } from '@/modulos/orcamento/dados/tabelas';
import { ErroArmazenamento, ErroEstruturaAusente } from '@/nucleo/armazenamento/armazenamento';
import { lerTabelas } from '@/nucleo/armazenamento/tabela';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { EstadoVazio } from '@/ui/pagina';
import { ConfiguracaoInvalida } from '../../configuracao-invalida';

/** Quem não administra a plataforma não tem o que consertar: só vê um aviso simples. */
function IndisponivelParaPessoas() {
  return (
    <section className="mx-auto max-w-2xl py-8">
      <EstadoVazio titulo="A Execução ainda não está disponível">Fale com a administração da sua instituição.</EstadoVazio>
    </section>
  );
}

/** A Execução usa a planilha "orcamento_execucao": confere se ela existe e já tem a aba Realizado. */
export default async function LayoutExecucao({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const a = usuario.autorizador;
  if (!a.temPermissaoAlgumEscopo('orcamento.execucao.ver') && !a.temPermissao('orcamento.realizado.editar') && !a.temPermissao('orcamento.painel.ver')) redirect('/orcamento');
  try {
    const { planilhas } = await obterAplicacao();
    await lerTabelas(planilhas, [Realizado] as const);
  } catch (erro) {
    const administra = a.temPermissao('core.organizacao.gerenciar');
    if (erro instanceof ErroEstruturaAusente || (erro instanceof ErroArmazenamento && /sem as colunas/.test(erro.message))) {
      if (!administra) return <IndisponivelParaPessoas />;
      return (
        <ConfiguracaoInvalida
          titulo="Falta preparar a aba do realizado"
          mensagem={`${erro.message} A administração faz isso em Preparar estrutura (na área da rede ou em Administração › Estrutura das planilhas).`}
        />
      );
    }
    if (erro instanceof ErroArmazenamento) {
      if (!administra) return <IndisponivelParaPessoas />;
      return (
        <ConfiguracaoInvalida
          titulo="A Execução ainda não tem planilha"
          mensagem={`${erro.message} Crie uma planilha em branco no Drive da instituição, compartilhe com a conta de serviço e informe o ID no cadastro da instituição na rede (campo Orçamento — execução e tesouraria).`}
        />
      );
    }
    throw erro;
  }
  return children;
}
