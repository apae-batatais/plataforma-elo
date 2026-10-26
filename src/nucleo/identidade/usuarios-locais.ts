/**
 * Lista os usuários fictícios para a tela de entrada da demonstração.
 * Lê como dono do banco (sem RLS), por isso só funciona em demonstração.
 */
import 'server-only';
import { sql } from 'drizzle-orm';
import { modoDemonstracao, obterBanco } from '@/nucleo/db/cliente';
import { linhas } from '@/nucleo/db/linhas';

export interface UsuarioLocal {
  id: string;
  nome: string;
  perfis: string;
}

export async function listarUsuariosLocais(): Promise<UsuarioLocal[]> {
  if (!modoDemonstracao()) throw new Error('listarUsuariosLocais só pode ser usado no modo demonstração.');
  const db = await obterBanco();
  return linhas<UsuarioLocal>(
    await db.execute(sql`
      select u.id, p.nome,
             string_agg(pf.nome || coalesce(' · ' || s.nome, ''), ', ' order by pf.nome) as perfis
        from core.usuario u
        join core.pessoa p on p.id = u.pessoa_id
        left join core.atribuicao a on a.usuario_id = u.id and a.fim is null
        left join core.perfil pf on pf.id = a.perfil_id
        left join core.servico s on a.escopo_tipo = 'servico' and s.id = a.escopo_id
       where u.ativo
       group by u.id, p.nome
       order by p.nome`),
  );
}
