-- =====================================================================
-- SOMENTE PARA TESTES LOCAIS (PGlite). NÃO é uma migração.
-- Reproduz o mínimo do ambiente Supabase que as migrações esperam:
-- papéis (anon, authenticated, service_role), schema auth e auth.uid().
-- No Supabase real, tudo isto já existe.
-- =====================================================================

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;

create table auth.users (
  id uuid primary key,
  email text unique
);

-- Mesma lógica do Supabase: lê o "sub" das claims do JWT da requisição.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
