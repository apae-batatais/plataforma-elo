import { redirect } from 'next/navigation';
import { Historico } from '@/modulos/orcamento/dados/tabelas';
import { ErroArmazenamento, ErroEstruturaAusente } from '@/nucleo/armazenamento/armazenamento';
import { lerTabelas } from '@/nucleo/armazenamento/tabela';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { EstadoVazio } from '@/ui/pagina';
import { ConfiguracaoInvalida } from '../../configuracao-invalida';

function Indisponivel() {
  return (
    <section className="mx-auto max-w-2xl py-8">
      <EstadoVazio titulo="O Histórico ainda não está disponível">Fale com a administração da sua instituição.</EstadoVazio>
    </section>
  );
}

/** O Histórico usa a planilha "orcamento_execucao": confere se ela existe e já tem as abas. */
export default async function LayoutHistorico({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissao('orcamento.historico.ver')) redirect('/orcamento');
  try {
    const { planilhas } = await obterAplicacao();
    await lerTabelas(planilhas, [Historico] as const);
  } catch (erro) {
    const administra = usuario.autorizador.temPermissao('core.organizacao.gerenciar');
    if (erro instanceof ErroEstruturaAusente || (erro instanceof ErroArmazenamento && /sem as colunas/.test(erro.message))) {
      if (!administra) return <Indisponivel />;
      return (
        <ConfiguracaoInvalida
          titulo="Falta preparar as abas do Histórico"
          mensagem={`${erro.message} A administração faz isso em Preparar estrutura (na área da rede ou em Administração › Estrutura das planilhas).`}
        />
      );
    }
    if (erro instanceof ErroArmazenamento) {
      if (!administra) return <Indisponivel />;
      return <ConfiguracaoInvalida titulo="O Histórico ainda não tem planilha" mensagem={erro.message} />;
    }
    throw erro;
  }
  return children;
}
