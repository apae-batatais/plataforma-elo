import type { Metadata } from 'next';
import { ScriptTema } from '@/ui/tema-script';
import { situacaoDaEstrutura } from '@/plataforma/estrutura';
import { configGeral, ErroInstituicao, instituicaoAtual } from '@/plataforma/instituicao';
import { Suspense } from 'react';
import { ErroArmazenamento } from '@/nucleo/armazenamento/armazenamento';
import { ErroConfiguracao } from '@/nucleo/config';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { navegacaoDoUsuario } from '@/plataforma/navegacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Casca } from '@/ui/casca';
import { Notificacao } from '@/ui/notificacao';
import { alertasDoMenu } from '@/plataforma/alertas';
import { sair } from './acoes-sessao';
import { ConfiguracaoInvalida } from './configuracao-invalida';
import '../globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const nome = await instituicaoAtual()
    .then((i) => i.nome)
    .catch(() => null);
  return {
    title: { default: nome ? `Elo · ${nome}` : 'Elo', template: '%s · Elo' },
    description: nome ? `Elo: a plataforma de gestão da ${nome}` : 'Elo: plataforma de gestão',
  };
}

export const dynamic = 'force-dynamic';

function Documento({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <ScriptTema />
        {children}
      </body>
    </html>
  );
}

const faixaDemonstracao = (
  <div className="border-b border-aviso/30 bg-aviso-fundo px-4 py-2 text-center text-sm font-semibold text-aviso print:hidden" role="status">
    Demonstração<span className="hidden sm:inline">: todos os dados são fictícios e as alterações podem ser perdidas</span>
    <span className="sm:hidden"> com dados fictícios</span>.
  </div>
);

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let app, usuario;
  try {
    configGeral();
    [app, usuario] = await Promise.all([obterAplicacao(), usuarioLogado()]);
  } catch (erro) {
    const problema = (mensagem: string, titulo?: string) => (
      <Documento>
        <main className="mx-auto max-w-5xl px-4 py-12">
          <ConfiguracaoInvalida mensagem={mensagem} titulo={titulo} />
        </main>
      </Documento>
    );
    if (erro instanceof ErroConfiguracao) return problema(erro.message);
    if (erro instanceof ErroInstituicao) {
      return problema(
        erro.motivo === 'desconhecida'
          ? `${erro.message} Confira o endereço digitado. Se a sua instituição está chegando ao Elo agora, o endereço é ativado pela Administração da rede.`
          : erro.motivo === 'preparacao'
            ? `${erro.message} A Administração da rede ativa o acesso assim que as planilhas estiverem conferidas.`
            : `${erro.message} Fale com a Administração da rede.`,
        { desconhecida: 'Endereço não cadastrado', preparacao: 'Instituição em preparação', suspensa: 'Acesso suspenso' }[erro.motivo],
      );
    }
    if (erro instanceof ErroArmazenamento) return problema(erro.message, 'A plataforma não conseguiu acessar as planilhas');
    throw erro;
  }
  const demonstracao = app.config.modo === 'demonstracao';
  // Só quem pode preparar a estrutura recebe o aviso de atualização pendente.
  const estruturaDesatualizada =
    !!usuario && !usuario.estruturaPendente && usuario.autorizador.temPermissao('core.organizacao.gerenciar') && Boolean((await situacaoDaEstrutura())?.desatualizada);

  if (!usuario) {
    return (
      <Documento>
        {demonstracao && faixaDemonstracao}
        {children}
      </Documento>
    );
  }

  return (
    <Documento>
      <Casca
        grupos={navegacaoDoUsuario(usuario.autorizador, usuario.estruturaPendente, { estruturaDesatualizada, comRede: !!configGeral().rede, alertasApps: usuario.estruturaPendente ? {} : await alertasDoMenu(usuario.autorizador) })}
        usuario={{ nome: usuario.nome, email: usuario.email, perfis: usuario.perfis.map((p) => p.nome) }}
        sair={sair}
        faixa={demonstracao ? faixaDemonstracao : undefined}
        instituicao={app.instituicao.nome}
        comBusca={!usuario.estruturaPendente}
      >
        <Suspense>
          <Notificacao />
        </Suspense>
        {children}
      </Casca>
    </Documento>
  );
}
