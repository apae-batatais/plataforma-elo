import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { comoUsuario } from '@/nucleo/db/contexto';
import { obterBanco } from '@/nucleo/db/cliente';
import { linhas } from '@/nucleo/db/linhas';
import { usuarioLogado } from '@/nucleo/identidade/sessao';

interface PessoaVisivel {
  id: string;
  nome: string;
  papeis: string | null;
  servicos: string | null;
}

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

  // A lista vem filtrada pelo próprio banco (Row Level Security):
  // cada perfil recebe apenas as pessoas que pode ver.
  const pessoas = await comoUsuario(await obterBanco(), usuario.usuarioId, async (tx) =>
    linhas<PessoaVisivel>(
      await tx.execute(sql`
        select p.id, coalesce(p.nome_social, p.nome) as nome,
               (select string_agg(pp.papel, ',' order by pp.papel)
                  from core.papel_pessoa pp where pp.pessoa_id = p.id and pp.fim is null) as papeis,
               (select string_agg(s.nome, ', ' order by s.nome)
                  from core.vinculo_servico vs join core.servico s on s.id = vs.servico_id
                 where vs.pessoa_id = p.id and vs.saida is null) as servicos
          from core.pessoa p
         where p.ativa
         order by 2`),
    ),
  );

  return (
    <div>
      <Link href="/" className="text-sm text-destaque hover:underline">← Portal</Link>
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
                <td className="px-4 py-3">
                  {(p.papeis ?? '').split(',').filter(Boolean).map((papel) => ROTULO_PAPEL[papel] ?? papel).join(', ')}
                </td>
                <td className="px-4 py-3 text-texto-suave">{p.servicos ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
