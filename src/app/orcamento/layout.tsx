import Link from 'next/link';
import { redirect } from 'next/navigation';
import { manifesto } from '@/modulos/orcamento';
import { Navegacao } from '@/modulos/orcamento/telas/navegacao';
import { CentrosCusto, Parametros } from '@/modulos/orcamento/dados/tabelas';
import { ErroArmazenamento, ErroEstruturaAusente } from '@/nucleo/armazenamento/armazenamento';
import { lerTabelas } from '@/nucleo/armazenamento/tabela';
import { menuDoUsuario } from '@/nucleo/modulos/registro';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { ConfiguracaoInvalida } from '../configuracao-invalida';
import { usuarioLogado } from '@/plataforma/sessao';

export default async function LayoutOrcamento({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (usuario.estruturaPendente) redirect('/admin/estrutura');
  const [app] = menuDoUsuario([manifesto], usuario.autorizador.permissoes());
  if (!app) redirect('/');
  try {
    const { planilhas } = await obterAplicacao();
    // Confere numa leitura pequena se as planilhas existem e já têm as abas.
    await lerTabelas(planilhas, [CentrosCusto, Parametros] as const);
  } catch (erro) {
    if (erro instanceof ErroEstruturaAusente) {
      return (
        <ConfiguracaoInvalida
          titulo="Falta preparar as abas do Orçamento"
          mensagem={`${erro.message} A administração da plataforma faz isso em Portal › Estrutura das planilhas › Preparar estrutura.`}
        />
      );
    }
    if (erro instanceof ErroArmazenamento) return <ConfiguracaoInvalida titulo="O Orçamento ainda não tem as planilhas" mensagem={erro.message} />;
    throw erro;
  }
  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-destaque hover:underline">
          ← Portal
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Orçamento</h1>
      </div>
      <Navegacao itens={app.itens} />
      {children}
    </div>
  );
}
