-- =====================================================================
-- Núcleo · permissões e Row Level Security
-- O banco só entrega ao usuário o que o perfil dele permite,
-- mesmo que uma tela tenha erro. Não existe política de DELETE:
-- nenhum usuário apaga registros (eles são encerrados).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Funções de permissão
-- ---------------------------------------------------------------------

-- Atribuições vigentes do usuário logado.
create or replace function core.atribuicoes_vigentes()
returns table (perfil_id uuid, escopo_tipo text, escopo_id uuid)
language sql stable security definer set search_path = core, pg_temp as $$
  select a.perfil_id, a.escopo_tipo, a.escopo_id
    from core.atribuicao a
    join core.usuario u on u.id = a.usuario_id and u.ativo
   where a.usuario_id = auth.uid()
     and a.inicio <= current_date
     and (a.fim is null or a.fim >= current_date)
$$;

-- O usuário tem a permissão no escopo pedido?
-- Escopo global cobre tudo. Escopo de unidade cobre os serviços da unidade.
-- Sem escopo informado: basta ter a permissão com atribuição global.
create or replace function core.tem_permissao(
  p_permissao text, p_escopo_tipo text default null, p_escopo_id uuid default null)
returns boolean
language sql stable security definer set search_path = core, pg_temp as $$
  select exists (
    select 1
      from core.atribuicoes_vigentes() a
      join core.perfil_permissao pp on pp.perfil_id = a.perfil_id
     where pp.permissao = p_permissao
       and (
         a.escopo_tipo = 'global'
         or (p_escopo_tipo is not null and a.escopo_tipo = p_escopo_tipo and a.escopo_id = p_escopo_id)
         or (p_escopo_tipo = 'servico' and a.escopo_tipo = 'unidade'
             and a.escopo_id = (select s.unidade_id from core.servico s where s.id = p_escopo_id))
         or (p_escopo_tipo = 'servico' and a.escopo_tipo = 'area'
             and a.escopo_id = (select s.area_id from core.servico s where s.id = p_escopo_id))
       )
  )
$$;

-- O usuário tem a permissão em pelo menos um escopo?
create or replace function core.tem_permissao_algum_escopo(p_permissao text)
returns boolean
language sql stable security definer set search_path = core, pg_temp as $$
  select exists (
    select 1
      from core.atribuicoes_vigentes() a
      join core.perfil_permissao pp on pp.perfil_id = a.perfil_id
     where pp.permissao = p_permissao
  )
$$;

-- A pessoa ainda não tem nenhum vínculo ativo com serviço?
create or replace function core.pessoa_sem_vinculo_ativo(p_pessoa_id uuid)
returns boolean
language sql stable security definer set search_path = core, pg_temp as $$
  select not exists (
    select 1 from core.vinculo_servico vs where vs.pessoa_id = p_pessoa_id and vs.saida is null)
$$;

-- O usuário pode ver esta pessoa?
-- Sim se: tem a permissão global; ou a pessoa está em um serviço do escopo
-- dele; ou é familiar de alguém nessa situação; ou é a própria pessoa do usuário;
-- ou foi ele quem a cadastrou e ela ainda não tem vínculo com serviço
-- (necessário para cadastrar e em seguida vincular).
create or replace function core.pode_ver_pessoa(p_pessoa_id uuid)
returns boolean
language sql stable security definer set search_path = core, pg_temp as $$
  select
    core.tem_permissao('core.pessoas.ver')
    or exists (select 1 from core.usuario u where u.id = auth.uid() and u.pessoa_id = p_pessoa_id)
    or exists (
      select 1 from core.pessoa p
       where p.id = p_pessoa_id and p.criado_por = auth.uid()
         and core.pessoa_sem_vinculo_ativo(p_pessoa_id))
    or exists (
      select 1 from core.vinculo_servico vs
       where vs.pessoa_id = p_pessoa_id and vs.saida is null
         and core.tem_permissao('core.pessoas.ver', 'servico', vs.servico_id))
    or exists (
      select 1
        from core.vinculo_familiar vf
        join core.vinculo_servico vs on vs.pessoa_id = vf.pessoa_id and vs.saida is null
       where vf.relacionado_id = p_pessoa_id and vf.fim is null
         and core.tem_permissao('core.pessoas.ver', 'servico', vs.servico_id))
$$;

create or replace function core.pode_editar_pessoa(p_pessoa_id uuid)
returns boolean
language sql stable security definer set search_path = core, pg_temp as $$
  select core.pode_ver_pessoa(p_pessoa_id)
     and core.tem_permissao_algum_escopo('core.pessoas.editar')
$$;

-- ---------------------------------------------------------------------
-- Permissões de uso do schema
-- ---------------------------------------------------------------------
grant usage on schema core to authenticated, service_role;
grant select, insert, update on all tables in schema core to authenticated;
revoke delete, truncate on all tables in schema core from authenticated;
grant all on all tables in schema core to service_role;
grant usage on all sequences in schema core to authenticated, service_role;
grant execute on all functions in schema core to authenticated, service_role;

-- Tabelas que o usuário nunca escreve diretamente.
revoke insert, update on core.auditoria, core.evento_dominio, core.evento_entrega,
                         core.indicador, core.valor_indicador from authenticated;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'core' loop
    -- Sem FORCE: as funções "security definer" (dono do schema) precisam ler
    -- atribuições e vínculos para decidir o acesso dos demais usuários.
    execute format('alter table core.%I enable row level security', t);
  end loop;
end $$;

-- Organização: todos leem; só quem gerencia altera.
do $$
declare t text;
begin
  foreach t in array array['unidade', 'area', 'servico', 'perfil'] loop
    execute format('create policy ler on core.%I for select to authenticated using (true)', t);
    execute format($p$create policy incluir on core.%I for insert to authenticated
                     with check (core.tem_permissao('core.organizacao.gerenciar'))$p$, t);
    execute format($p$create policy alterar on core.%I for update to authenticated
                     using (core.tem_permissao('core.organizacao.gerenciar'))
                     with check (core.tem_permissao('core.organizacao.gerenciar'))$p$, t);
  end loop;
end $$;

-- Pessoas
-- A segunda condição cobre o "insert ... returning" logo após o cadastro.
create policy ler on core.pessoa for select to authenticated
  using (core.pode_ver_pessoa(id)
         or (criado_por = auth.uid() and core.pessoa_sem_vinculo_ativo(id)));
create policy incluir on core.pessoa for insert to authenticated
  with check (core.tem_permissao_algum_escopo('core.pessoas.editar'));
create policy alterar on core.pessoa for update to authenticated
  using (core.pode_editar_pessoa(id))
  with check (core.pode_editar_pessoa(id));

-- Papéis e vínculos familiares seguem a visibilidade da pessoa.
create policy ler on core.papel_pessoa for select to authenticated
  using (core.pode_ver_pessoa(pessoa_id));
create policy incluir on core.papel_pessoa for insert to authenticated
  with check (core.pode_editar_pessoa(pessoa_id));
create policy alterar on core.papel_pessoa for update to authenticated
  using (core.pode_editar_pessoa(pessoa_id)) with check (core.pode_editar_pessoa(pessoa_id));

create policy ler on core.vinculo_familiar for select to authenticated
  using (core.pode_ver_pessoa(pessoa_id) and core.pode_ver_pessoa(relacionado_id));
create policy incluir on core.vinculo_familiar for insert to authenticated
  with check (core.pode_editar_pessoa(pessoa_id));
create policy alterar on core.vinculo_familiar for update to authenticated
  using (core.pode_editar_pessoa(pessoa_id)) with check (core.pode_editar_pessoa(pessoa_id));

-- Vínculo com serviço: alterado por quem tem permissão naquele serviço.
create policy ler on core.vinculo_servico for select to authenticated
  using (core.pode_ver_pessoa(pessoa_id));
create policy incluir on core.vinculo_servico for insert to authenticated
  with check (core.tem_permissao('core.vinculos.editar', 'servico', servico_id));
create policy alterar on core.vinculo_servico for update to authenticated
  using (core.tem_permissao('core.vinculos.editar', 'servico', servico_id))
  with check (core.tem_permissao('core.vinculos.editar', 'servico', servico_id));

-- Usuários, atribuições e permissões de perfil.
create policy ler on core.usuario for select to authenticated
  using (id = auth.uid() or core.tem_permissao('core.acessos.gerenciar'));
create policy incluir on core.usuario for insert to authenticated
  with check (core.tem_permissao('core.acessos.gerenciar'));
create policy alterar on core.usuario for update to authenticated
  using (core.tem_permissao('core.acessos.gerenciar'))
  with check (core.tem_permissao('core.acessos.gerenciar'));

create policy ler on core.atribuicao for select to authenticated
  using (usuario_id = auth.uid() or core.tem_permissao('core.acessos.gerenciar'));
create policy incluir on core.atribuicao for insert to authenticated
  with check (core.tem_permissao('core.acessos.gerenciar'));
create policy alterar on core.atribuicao for update to authenticated
  using (core.tem_permissao('core.acessos.gerenciar'))
  with check (core.tem_permissao('core.acessos.gerenciar'));

create policy ler on core.perfil_permissao for select to authenticated using (true);
create policy incluir on core.perfil_permissao for insert to authenticated
  with check (core.tem_permissao('core.acessos.gerenciar'));

-- Documentos: internos para todos; pessoais e sensíveis só com acesso à pessoa.
create policy ler on core.documento for select to authenticated
  using (
    sigilo = 'interno'
    or core.tem_permissao('core.documentos.ver_todos')
    or (dono_tipo = 'pessoa' and core.pode_ver_pessoa(dono_id))
  );
create policy incluir on core.documento for insert to authenticated
  with check (sigilo = 'interno' or (dono_tipo = 'pessoa' and core.pode_editar_pessoa(dono_id)));
create policy alterar on core.documento for update to authenticated
  using (criado_por = auth.uid() or core.tem_permissao('core.documentos.ver_todos'))
  with check (criado_por = auth.uid() or core.tem_permissao('core.documentos.ver_todos'));

-- Auditoria: só leitura, por quem tem permissão.
create policy ler on core.auditoria for select to authenticated
  using (core.tem_permissao('core.auditoria.ver'));

-- Indicadores: leitura para todos os usuários logados.
create policy ler on core.indicador for select to authenticated using (true);
create policy ler on core.valor_indicador for select to authenticated using (true);

-- evento_dominio e evento_entrega: sem políticas para "authenticated".
-- Só a rotina de entrega (service_role) lê; a publicação usa core.publicar_evento().
