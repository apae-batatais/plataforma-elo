import type { Metadata } from 'next';
import { ScriptTema } from '@/ui/tema-script';
import Link from 'next/link';
import { Suspense } from 'react';
import { ErroConfiguracao } from '@/nucleo/config';
import { ErroArmazenamento } from '@/nucleo/armazenamento/armazenamento';
import { configGeral } from '@/plataforma/instituicao';
import { administradorDaRedeLogado, aplicacaoDaRedeAtual, enderecoDaRede } from '@/plataforma/sessao-rede';
import { IconeSair } from '@/ui/icones';
import { MarcaElo, NOME_PLATAFORMA, textoVersao } from '@/ui/marca';
import { Notificacao } from '@/ui/notificacao';
import { ConfiguracaoInvalida } from '../../(elo)/configuracao-invalida';
import { acaoSairDaRede } from './acoes';
import '../../globals.css';

export const metadata: Metadata = { title: { default: 'Elo · Rede de instituições', template: '%s · Elo · Rede' } };
export const dynamic = 'force-dynamic';

/**
 * Área da Administração da rede (ADR-012): layout próprio, separado das
 * instituições. Aqui não aparece nenhum dado de pessoas, folha ou orçamento.
 */
export default async function LayoutRede({ children }: { children: React.ReactNode }) {
  const corpo = (conteudo: React.ReactNode) => (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <ScriptTema />
        {conteudo}
      </body>
    </html>
  );
  let demonstracao = false;
  let nomeOperadora: string | undefined;
  let adm;
  try {
    const geral = configGeral();
    demonstracao = geral.modo === 'demonstracao';
    if (geral.modo === 'demonstracao') nomeOperadora = geral.rede.nome;
    if (!(await enderecoDaRede())) {
      return corpo(
        <main className="px-4 py-12">
          <ConfiguracaoInvalida titulo="Use o endereço da rede" mensagem="A Administração da rede só abre no endereço da Operadora do Elo." />
        </main>,
      );
    }
    if (!(await aplicacaoDaRedeAtual())) {
      return corpo(
        <main className="px-4 py-12">
          <ConfiguracaoInvalida
            titulo="A rede ainda não foi configurada"
            mensagem="Crie a planilha da rede no Drive da Operadora, compartilhe com a conta de serviço e cadastre a variável REDE na Netlify (planilha, domínio e administradores). Depois, publique de novo."
          />
        </main>,
      );
    }
    adm = await administradorDaRedeLogado();
  } catch (erro) {
    if (erro instanceof ErroConfiguracao || erro instanceof ErroArmazenamento) {
      return corpo(
        <main className="px-4 py-12">
          <ConfiguracaoInvalida
            mensagem={erro.message}
            titulo={erro instanceof ErroArmazenamento ? 'A rede não conseguiu acessar a planilha da rede' : undefined}
          />
        </main>,
      );
    }
    throw erro;
  }

  return corpo(
    <>
      {demonstracao && (
        <div className="border-b border-aviso/30 bg-aviso-fundo px-4 py-2 text-center text-sm font-semibold text-aviso" role="status">
          Demonstração<span className="hidden sm:inline">: instituições e dados fictícios</span>.
        </div>
      )}
      <header className="bg-lateral text-lateral-texto">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/rede" aria-label={`${NOME_PLATAFORMA}: Rede de instituições`}>
            <MarcaElo instituicao={nomeOperadora ?? 'Rede de instituições'} />
          </Link>
          {adm && (
            <nav aria-label="Rede" className="flex flex-wrap items-center gap-1 text-sm">
              <Link href="/rede" className="rounded-md px-3 py-1.5 hover:bg-white/10">
                Instituições
              </Link>
              <Link href="/rede/administradores" className="rounded-md px-3 py-1.5 hover:bg-white/10">
                Administradores
              </Link>
              <span className="mx-2 hidden h-5 w-px bg-white/15 sm:block" aria-hidden="true" />
              <span className="hidden text-lateral-suave sm:inline">{adm.nome}</span>
              <form action={acaoSairDaRede}>
                <button aria-label="Sair da rede" title="Sair" className="rounded-md p-2 hover:bg-white/10">
                  <IconeSair />
                </button>
              </form>
            </nav>
          )}
        </div>
      </header>
      <main id="conteudo" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
        <Suspense>
          <Notificacao />
        </Suspense>
        {children}
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-texto-suave sm:px-6">
        {NOME_PLATAFORMA} · {textoVersao()} · Administração da rede: aqui não aparecem pessoas, folha nem orçamento das instituições.
      </footer>
    </>,
  );
}
