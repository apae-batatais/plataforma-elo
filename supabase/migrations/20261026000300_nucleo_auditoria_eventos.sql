-- =====================================================================
-- Núcleo · auditoria automática e publicação de eventos
-- =====================================================================

-- ---------------------------------------------------------------------
-- Auditoria de escrita: registra quem incluiu/alterou o quê.
-- Guarda só os NOMES das colunas alteradas, nunca os valores,
-- para a auditoria não virar uma cópia de dados sensíveis.
-- ---------------------------------------------------------------------
create or replace function core.tg_auditar() returns trigger
language plpgsql security definer set search_path = core, pg_temp as $$
declare
  v_registro text;
  v_colunas  text[];
begin
  if tg_op = 'INSERT' then
    v_registro := (to_jsonb(new) ->> 'id');
    insert into core.auditoria (usuario_id, acao, entidade, registro_id)
    values (auth.uid(), 'inclusao', tg_table_schema || '.' || tg_table_name, v_registro);
    return new;
  elsif tg_op = 'UPDATE' then
    v_registro := (to_jsonb(new) ->> 'id');
    select array_agg(n.key order by n.key) into v_colunas
      from jsonb_each(to_jsonb(new)) n
      join jsonb_each(to_jsonb(old)) o using (key)
     where n.value is distinct from o.value
       and n.key not in ('atualizado_em', 'atualizado_por');
    if v_colunas is not null then
      insert into core.auditoria (usuario_id, acao, entidade, registro_id, detalhes)
      values (auth.uid(), 'alteracao', tg_table_schema || '.' || tg_table_name, v_registro,
              jsonb_build_object('colunas', v_colunas));
    end if;
    return new;
  else
    v_registro := (to_jsonb(old) ->> 'id');
    insert into core.auditoria (usuario_id, acao, entidade, registro_id)
    values (auth.uid(), 'exclusao', tg_table_schema || '.' || tg_table_name, v_registro);
    return old;
  end if;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['unidade','area','servico','pessoa','papel_pessoa','vinculo_familiar',
                           'vinculo_servico','usuario','perfil','atribuicao','documento']
  loop
    execute format('create trigger auditar after insert or update or delete on core.%I
                    for each row execute function core.tg_auditar()', t);
  end loop;
end $$;

-- A auditoria é imutável, inclusive para o dono do schema.
create or replace function core.tg_auditoria_imutavel() returns trigger
language plpgsql as $$
begin
  raise exception 'A auditoria é somente inclusão: % não é permitido', tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger imutavel before update or delete on core.auditoria
  for each row execute function core.tg_auditoria_imutavel();
create trigger imutavel_truncate before truncate on core.auditoria
  for each statement execute function core.tg_auditoria_imutavel();

-- ---------------------------------------------------------------------
-- Auditoria de leitura e exportação (chamada pelo app).
-- Usada para toda consulta individual a dado sensível.
-- ---------------------------------------------------------------------
create or replace function core.registrar_acesso(
  p_acao text, p_entidade text, p_registro_id text, p_motivo text default null)
returns void
language plpgsql security definer set search_path = core, pg_temp as $$
begin
  if p_acao not in ('leitura', 'exportacao') then
    raise exception 'registrar_acesso aceita apenas leitura ou exportacao';
  end if;
  if auth.uid() is null then
    raise exception 'registrar_acesso exige usuário identificado';
  end if;
  insert into core.auditoria (usuario_id, acao, entidade, registro_id, detalhes)
  values (auth.uid(), p_acao, p_entidade, p_registro_id,
          case when p_motivo is null then '{}'::jsonb else jsonb_build_object('motivo', p_motivo) end);
end;
$$;

-- ---------------------------------------------------------------------
-- Publicação de eventos de domínio (outbox).
-- Deve ser chamada na mesma transação da operação que gerou o evento.
-- ---------------------------------------------------------------------
create or replace function core.publicar_evento(
  p_tipo text, p_payload jsonb, p_publicado_por text, p_versao integer default 1)
returns bigint
language plpgsql security definer set search_path = core, pg_temp as $$
declare v_id bigint;
begin
  insert into core.evento_dominio (tipo, versao, payload, publicado_por)
  values (p_tipo, p_versao, p_payload, p_publicado_por)
  returning id into v_id;
  return v_id;
end;
$$;

-- O Núcleo publica eventos sobre vínculos com serviços.
create or replace function core.tg_eventos_vinculo_servico() returns trigger
language plpgsql security definer set search_path = core, pg_temp as $$
begin
  if tg_op = 'INSERT' and new.saida is null then
    perform core.publicar_evento('PessoaVinculadaAServico',
      jsonb_build_object('vinculoId', new.id, 'pessoaId', new.pessoa_id,
                         'servicoId', new.servico_id, 'entrada', new.entrada), 'nucleo');
  elsif tg_op = 'UPDATE' and old.saida is null and new.saida is not null then
    perform core.publicar_evento('PessoaDesligadaDeServico',
      jsonb_build_object('vinculoId', new.id, 'pessoaId', new.pessoa_id,
                         'servicoId', new.servico_id, 'saida', new.saida,
                         'motivo', new.motivo_saida), 'nucleo');
  end if;
  return new;
end;
$$;

create trigger eventos after insert or update on core.vinculo_servico
  for each row execute function core.tg_eventos_vinculo_servico();

grant execute on function core.registrar_acesso(text, text, text, text) to authenticated;
grant execute on function core.publicar_evento(text, jsonb, text, integer) to authenticated, service_role;
