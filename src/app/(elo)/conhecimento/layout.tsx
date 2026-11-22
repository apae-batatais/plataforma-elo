import { redirect } from 'next/navigation';
import { manifesto } from '@/modulos/conhecimento';
import { CategoriasConhecimento } from '@/modulos/conhecimento/dados/tabelas';
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
      <EstadoVazio titulo="A Base de Conhecimento ainda não está disponível">Fale com a administração da sua instituição.</EstadoVazio>
    </section>
  );
}

export default async function LayoutConhecimento({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (usuario.estruturaPendente) redirect('/admin/estrutura');
  const [app] = menuDoUsuario([manifesto], usuario.autorizador.permissoes());
  if (!app) redirect('/');
  try {
    const { planilhas } = await obterAplicacao();
    await lerTabelas(planilhas, [CategoriasConhecimento] as const);
  } catch (erro) {
    const administra = usuario.autorizador.temPermissao('core.organizacao.gerenciar');
    if (erro instanceof ErroEstruturaAusente || (erro instanceof ErroArmazenamento && /sem as colunas/.test(erro.message))) {
      if (!administra) return <IndisponivelParaPessoas />;
      return (
        <ConfiguracaoInvalida
          titulo="Falta preparar as abas da Base de Conhecimento"
          mensagem={`${erro.message} A administração faz isso em Preparar estrutura (na área da rede ou em Administração › Estrutura das planilhas).`}
        />
      );
    }
    if (erro instanceof ErroArmazenamento) {
      if (!administra) return <IndisponivelParaPessoas />;
      return (
        <ConfiguracaoInvalida
          titulo="A Base de Conhecimento ainda não tem planilha"
          mensagem={`${erro.message} Crie uma planilha em branco no Drive da instituição, compartilhe com a conta de serviço e informe o ID no cadastro da instituição na rede (campo Base de Conhecimento).`}
        />
      );
    }
    throw erro;
  }
  return children;
}
