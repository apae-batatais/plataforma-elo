/**
 * Quem é o usuário e o que ele pode fazer, lido do banco com as
 * próprias regras de acesso (o usuário só enxerga as próprias atribuições).
 */
import { sql } from 'drizzle-orm';
import { comoUsuario, type Banco } from '@/nucleo/db/contexto';
import { linhas } from '@/nucleo/db/linhas';

export interface ContextoUsuario {
  usuarioId: string;
  nome: string;
  email: string;
  perfis: { codigo: string; nome: string; escopo: string }[];
  permissoes: ReadonlySet<string>;
}

export async function carregarContextoUsuario(db: Banco, usuarioId: string): Promise<ContextoUsuario | null> {
  return comoUsuario(db, usuarioId, async (tx) => {
    const [conta] = linhas<{ nome: string; email: string }>(
      await tx.execute(sql`
        select coalesce(p.nome_social, p.nome) as nome, u.email
          from core.usuario u join core.pessoa p on p.id = u.pessoa_id
         where u.id = ${usuarioId} and u.ativo`),
    );
    if (!conta) return null;

    const perfis = linhas<{ codigo: string; nome: string; escopo: string }>(
      await tx.execute(sql`
        select distinct pf.codigo, pf.nome,
               case a.escopo_tipo
                 when 'global'  then 'toda a instituição'
                 when 'unidade' then 'unidade ' || (select nome from core.unidade where id = a.escopo_id)
                 when 'area'    then 'área ' || (select nome from core.area where id = a.escopo_id)
                 when 'servico' then 'serviço ' || (select nome from core.servico where id = a.escopo_id)
               end as escopo
          from core.atribuicoes_vigentes() a
          join core.perfil pf on pf.id = a.perfil_id
         order by pf.nome`),
    );

    const permissoes = linhas<{ permissao: string }>(
      await tx.execute(sql`
        select distinct pp.permissao
          from core.atribuicoes_vigentes() a
          join core.perfil_permissao pp on pp.perfil_id = a.perfil_id`),
    ).map((l) => l.permissao);

    return { usuarioId, nome: conta.nome, email: conta.email, perfis, permissoes: new Set(permissoes) };
  });
}
