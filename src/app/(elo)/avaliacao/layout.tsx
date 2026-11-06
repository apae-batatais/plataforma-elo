import { redirect } from 'next/navigation';
import { manifesto } from '@/modulos/avaliacao';
import { Avaliacoes } from '@/modulos/avaliacao/dados/tabelas';
import { ErroArmazenamento, ErroEstruturaAusente } from '@/nucleo/armazenamento/armazenamento';
import { lerTabelas } from '@/nucleo/armazenamento/tabela';
import { menuDoUsuario } from '@/nucleo/modulos/registro';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { ConfiguracaoInvalida } from '../configuracao-invalida';

export default async function LayoutAvaliacao({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (usuario.estruturaPendente) redirect('/admin/estrutura');
  const [app] = menuDoUsuario([manifesto], usuario.autorizador.permissoes());
  if (!app) redirect('/');
  try {
    const { planilhas } = await obterAplicacao();
    await lerTabelas(planilhas, [Avaliacoes] as const);
  } catch (erro) {
    // Aba ou coluna nova de uma versão publicada: falta rodar Preparar estrutura.
    if (erro instanceof ErroEstruturaAusente || (erro instanceof ErroArmazenamento && /sem as colunas/.test(erro.message))) {
      return (
        <ConfiguracaoInvalida
          titulo="Falta preparar a aba da Avaliação de Serviços Sociais"
          mensagem={`${erro.message} A administração faz isso em Preparar estrutura (na área da rede ou em Administração › Estrutura das planilhas).`}
        />
      );
    }
    if (erro instanceof ErroArmazenamento) {
      return (
        <ConfiguracaoInvalida
          titulo="A Avaliação de Serviços Sociais ainda não tem planilha"
          mensagem={`${erro.message} Crie uma planilha em branco no Drive da instituição (só para as avaliações, porque guarda dados sensíveis), compartilhe com a conta de serviço e informe o ID no cadastro da instituição na rede (campo Avaliação de Serviços Sociais).`}
        />
      );
    }
    throw erro;
  }
  return children;
}
