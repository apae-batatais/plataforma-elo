import type { Metadata } from 'next';
import { instituicaoAtual } from '@/plataforma/instituicao';
import { Suspense } from 'react';
import { ErroArmazenamento } from '@/nucleo/armazenamento/armazenamento';
import { ErroConfiguracao, lerConfig } from '@/nucleo/config';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { navegacaoDoUsuario } from '@/plataforma/navegacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Casca } from '@/ui/casca';
import { Notificacao } from '@/ui/notificacao';
import { sair } from './acoes-sessao';
import { ConfiguracaoInvalida } from './configuracao-invalida';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Elo · Apae Batatais', template: '%s · Elo' },
  description: 'Elo: a plataforma de gestão da Apae Batatais',
};

export const dynamic = 'force-dynamic';

function Documento({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

const faixaDemonstracao = (
  <div className="border-b border-aviso/30 bg-aviso-fundo px-4 py-2 text-center text-sm font-semibold text-aviso" role="status">
    Demonstração<span className="hidden sm:inline">: todos os dados são fictícios e as alterações podem ser perdidas</span>
    <span className="sm:hidden"> com dados fictícios</span>.
  </div>
);

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let app, usuario;
  try {
    lerConfig();
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
    if (erro instanceof ErroArmazenamento) return problema(erro.message, 'A plataforma não conseguiu acessar as planilhas');
    throw erro;
  }
  const demonstracao = app.config.modo === 'demonstracao';

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
        grupos={navegacaoDoUsuario(usuario.autorizador, usuario.estruturaPendente)}
        usuario={{ nome: usuario.nome, email: usuario.email, perfis: usuario.perfis.map((p) => p.nome) }}
        sair={sair}
        faixa={demonstracao ? faixaDemonstracao : undefined}
        instituicao={instituicaoAtual().nome}
      >
        <Suspense>
          <Notificacao />
        </Suspense>
        {children}
      </Casca>
    </Documento>
  );
}
