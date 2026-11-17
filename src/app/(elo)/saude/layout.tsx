import { redirect } from 'next/navigation';
import { manifesto } from '@/modulos/saude';
import { Aplicacoes, Instrumentos, Respostas } from '@/modulos/saude/dados/tabelas';
import { ErroArmazenamento, ErroEstruturaAusente } from '@/nucleo/armazenamento/armazenamento';
import { lerTabelas } from '@/nucleo/armazenamento/tabela';
import { menuDoUsuario } from '@/nucleo/modulos/registro';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { ConfiguracaoInvalida } from '../configuracao-invalida';

export default async function LayoutSaude({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (usuario.estruturaPendente) redirect('/admin/estrutura');
  const [app] = menuDoUsuario([manifesto], usuario.autorizador.permissoes());
  if (!app) redirect('/');
  try {
    const { planilhas } = await obterAplicacao();
    await lerTabelas(planilhas, [Instrumentos, Aplicacoes, Respostas] as const);
  } catch (erro) {
    // Aba ou coluna nova de uma versão publicada: falta rodar Preparar estrutura.
    if (erro instanceof ErroEstruturaAusente || (erro instanceof ErroArmazenamento && /sem as colunas/.test(erro.message))) {
      return (
        <ConfiguracaoInvalida
          titulo="Falta preparar as abas do app Saúde"
          mensagem={`${erro.message} A administração faz isso em Preparar estrutura (na área da rede ou em Administração › Estrutura das planilhas).`}
        />
      );
    }
    if (erro instanceof ErroArmazenamento) {
      return (
        <ConfiguracaoInvalida
          titulo="O app Saúde ainda não tem planilha"
          mensagem={`${erro.message} Crie uma planilha em branco no Drive da instituição (só para as avaliações de Saúde, porque guarda dados sensíveis), compartilhe com a conta de serviço e informe o ID no cadastro da instituição na rede (campo Avaliação de Saúde).`}
        />
      );
    }
    throw erro;
  }
  return children;
}
