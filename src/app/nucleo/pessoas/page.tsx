import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listarPessoasVisiveis } from '@/nucleo/pessoas/servico';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';

const ROTULO_PAPEL: Record<string, string> = {
  atendido: 'Atendido',
  familiar: 'Familiar',
  colaborador: 'Colaborador',
  voluntario: 'Voluntário',
  doador: 'Doador',
  parceiro: 'Parceiro',
};

export default async function Pessoas() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (usuario.estruturaPendente) redirect('/admin/estrutura');
  const app = await obterAplicacao();

  // A camada de aplicação filtra pelo perfil: cada um recebe só quem pode ver.
  const pessoas = await listarPessoasVisiveis(app.planilhas, usuario.autorizador);

  return (
    <div>
      <Link href="/" className="text-sm text-destaque hover:underline">
        ← Portal
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Pessoas</h1>
      <p className="mt-1 text-texto-suave">
        {pessoas.length} {pessoas.length === 1 ? 'pessoa visível' : 'pessoas visíveis'} para o seu perfil. Quem não aparece aqui está fora do seu escopo de acesso.
      </p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-borda bg-superficie">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-borda text-texto-suave">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Nome</th>
              <th scope="col" className="px-4 py-3 font-medium">Papel</th>
              <th scope="col" className="px-4 py-3 font-medium">Serviço</th>
            </tr>
          </thead>
          <tbody>
            {pessoas.map((p) => (
              <tr key={p.id} className="border-b border-borda last:border-0">
                <td className="px-4 py-3">{p.nome}</td>
                <td className="px-4 py-3">{p.papeis.map((x) => ROTULO_PAPEL[x] ?? x).join(', ')}</td>
                <td className="px-4 py-3 text-texto-suave">{p.servicos.join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
