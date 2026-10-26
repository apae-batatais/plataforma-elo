-- =====================================================================
-- Núcleo · marcação do tipo de ambiente do banco
--
-- Cada banco declara se é de "demonstracao" (só dados fictícios) ou de
-- "producao" (dados reais). A plataforma usa isso como trava de segurança:
-- - o login de demonstração (escolher um usuário fictício sem senha) só
--   funciona em banco marcado como "demonstracao";
-- - os dados fictícios só são gravados em banco vazio ou de "demonstracao",
--   nunca em banco de "producao".
-- A marcação é definitiva: depois de feita, não muda.
-- =====================================================================

create table core.ambiente (
  unico      boolean primary key default true check (unico),
  tipo       text not null check (tipo in ('demonstracao', 'producao')),
  definido_em timestamptz not null default now()
);

comment on table core.ambiente is
  'Tipo do banco (uma linha só). Trava o login de demonstração e os dados fictícios.';

alter table core.ambiente enable row level security;
-- Sem políticas: usuários comuns não leem nem alteram. Só o dono do banco.
revoke all on core.ambiente from authenticated;

create or replace function core.tg_ambiente_imutavel() returns trigger
language plpgsql as $$
begin
  raise exception 'O tipo de ambiente do banco já foi definido e não muda'
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger imutavel before update or delete on core.ambiente
  for each row execute function core.tg_ambiente_imutavel();
