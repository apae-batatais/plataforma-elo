import type { Metadata } from 'next';
import Link from 'next/link';
import { modoDemonstracao } from '@/nucleo/db/cliente';
import { usuarioLogado } from '@/nucleo/identidade/sessao';
import { sair } from './acoes-sessao';
import './globals.css';

export const metadata: Metadata = {
  title: 'Plataforma APAE Batatais',
  description: 'Ferramentas de gestão da APAE Batatais',
};

export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const usuario = await usuarioLogado();
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">
        {modoDemonstracao() && (
          <div className="bg-aviso-fundo px-4 py-2 text-center text-sm text-aviso" role="status">
            Demonstração: todos os dados são fictícios.
          </div>
        )}
        <header className="border-b border-borda bg-superficie">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
            <Link href="/" className="text-lg font-semibold text-texto">
              APAE Batatais <span className="font-normal text-texto-suave">· Plataforma</span>
            </Link>
            {usuario && (
              <div className="flex items-center gap-4 text-sm">
                <span className="text-texto-suave">{usuario.nome}</span>
                <form action={sair}>
                  <button className="rounded-md border border-borda px-3 py-1.5 hover:bg-destaque-suave">Sair</button>
                </form>
              </div>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
