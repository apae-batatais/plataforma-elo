import Link from 'next/link';
import { redirect } from 'next/navigation';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { prepararEstruturaAgora } from './acoes';

export default async function Estrutura({ searchParams }: { searchParams: Promise<{ resultado?: string }> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissao('core.organizacao.gerenciar')) redirect('/');
  const app = await obterAplicacao();
  const { resultado } = await searchParams;

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/" className="text-sm text-destaque hover:underline">
        ← Portal
      </Link>
      <h1 className="text-2xl font-semibold">Estrutura das planilhas</h1>
      <p className="text-texto-suave">
        Cria nas planilhas do Drive as abas que ainda não existem, com o cabeçalho certo, e grava a configuração inicial
        (unidades, áreas e perfis) nas abas vazias. Pode ser usado quantas vezes for preciso: nada que já existe é apagado
        ou alterado.
      </p>
      {app.config.modo === 'producao' && (
        <div className="rounded-lg border border-borda bg-superficie p-4 text-sm">
          <p className="font-medium">Planilhas configuradas</p>
          <ul className="mt-2 space-y-1 text-texto-suave">
            {Object.entries(app.config.planilhas).map(([chave, id]) => (
              <li key={chave}>
                <span className="font-mono">{chave}</span>: {id}
              </li>
            ))}
          </ul>
        </div>
      )}
      <form action={prepararEstruturaAgora}>
        <button className="rounded-md bg-destaque px-4 py-2 font-medium text-white hover:opacity-90">Preparar estrutura</button>
      </form>
      {resultado && (
        <p role="status" className="rounded-md bg-destaque-suave p-3 text-sm">
          {resultado}
        </p>
      )}
    </div>
  );
}
