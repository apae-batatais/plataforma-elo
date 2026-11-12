import { redirect } from 'next/navigation';
import { manifesto } from '@/modulos/projetos';
import { Projetos } from '@/modulos/projetos/dados/tabelas';
import { ErroArmazenamento, ErroEstruturaAusente } from '@/nucleo/armazenamento/armazenamento';
import { lerTabelas } from '@/nucleo/armazenamento/tabela';
import { menuDoUsuario } from '@/nucleo/modulos/registro';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { EstadoVazio } from '@/ui/pagina';
import { ConfiguracaoInvalida } from '../configuracao-invalida';

/** Quem não administra a plataforma não tem o que consertar: só vê um aviso simples. */
function IndisponivelParaPessoas() {
  return (
    <section className="mx-auto max-w-2xl py-8">
      <EstadoVazio titulo="O app Projetos ainda não está disponível">Fale com a administração da sua instituição.</EstadoVazio>
    </section>
  );
}

export default async function LayoutProjetos({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (usuario.estruturaPendente) redirect('/admin/estrutura');
  const [app] = menuDoUsuario([manifesto], usuario.autorizador.permissoes());
  if (!app) redirect('/');
  try {
    const { planilhas } = await obterAplicacao();
    await lerTabelas(planilhas, [Projetos] as const);
  } catch (erro) {
    const administra = usuario.autorizador.temPermissao('core.organizacao.gerenciar');
    // Aba ou coluna nova de uma versão publicada: falta rodar Preparar estrutura.
    if (erro instanceof ErroEstruturaAusente || (erro instanceof ErroArmazenamento && /sem as colunas/.test(erro.message))) {
      if (!administra) return <IndisponivelParaPessoas />;
      return (
        <ConfiguracaoInvalida
          titulo="Falta preparar as abas de Projetos"
          mensagem={`${erro.message} A administração faz isso em Preparar estrutura (na área da rede ou em Administração › Estrutura das planilhas).`}
        />
      );
    }
    if (erro instanceof ErroArmazenamento) {
      if (!administra) return <IndisponivelParaPessoas />;
      return (
        <ConfiguracaoInvalida
          titulo="O app Projetos ainda não tem planilha"
          mensagem={`${erro.message} Crie uma planilha em branco no Drive da instituição, compartilhe com a conta de serviço e informe o ID no cadastro da instituição na rede (campo Projetos).`}
        />
      );
    }
    throw erro;
  }
  return children;
}
