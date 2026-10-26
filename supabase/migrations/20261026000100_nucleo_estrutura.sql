-- =====================================================================
-- Núcleo · estrutura das tabelas
-- Schema "core": organização, pessoas, acesso, documentos, auditoria,
-- eventos de domínio e indicadores.
-- Regra da plataforma: nada é apagado; registros são encerrados.
-- =====================================================================

create schema if not exists core;

-- ---------------------------------------------------------------------
-- Carimbo de alteração (atualizado_em / atualizado_por)
-- ---------------------------------------------------------------------
create or replace function core.tg_carimbo() returns trigger
language plpgsql as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Organização
-- ---------------------------------------------------------------------
create table core.unidade (
  id             uuid primary key default gen_random_uuid(),
  codigo         text not null unique check (codigo ~ '^[a-z0-9_]+$'),
  nome           text not null,
  ativa          boolean not null default true,
  criado_em      timestamptz not null default now(),
  criado_por     uuid default auth.uid(),
  atualizado_em  timestamptz,
  atualizado_por uuid
);

create table core.area (
  id             uuid primary key default gen_random_uuid(),
  codigo         text not null unique check (codigo ~ '^[a-z0-9_]+$'),
  nome           text not null,
  ativa          boolean not null default true,
  criado_em      timestamptz not null default now(),
  criado_por     uuid default auth.uid(),
  atualizado_em  timestamptz,
  atualizado_por uuid
);

create table core.servico (
  id             uuid primary key default gen_random_uuid(),
  codigo         text not null unique check (codigo ~ '^[a-z0-9_]+$'),
  nome           text not null,
  eixo           text not null check (eixo in ('assistencia_social', 'educacao', 'saude')),
  unidade_id     uuid not null references core.unidade(id),
  area_id        uuid references core.area(id),
  vagas          integer check (vagas is null or vagas >= 0),
  inicio         date not null default current_date,
  fim            date,
  criado_em      timestamptz not null default now(),
  criado_por     uuid default auth.uid(),
  atualizado_em  timestamptz,
  atualizado_por uuid,
  check (fim is null or fim >= inicio)
);

-- ---------------------------------------------------------------------
-- Cadastro Único de Pessoas
-- ---------------------------------------------------------------------
create table core.pessoa (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null check (length(trim(nome)) > 1),
  nome_social     text,
  data_nascimento date,
  cpf             text unique check (cpf is null or cpf ~ '^[0-9]{11}$'),
  nis             text unique check (nis is null or nis ~ '^[0-9]{11}$'),
  email           text,
  telefone        text,
  endereco        jsonb,
  ativa           boolean not null default true,
  criado_em       timestamptz not null default now(),
  criado_por      uuid default auth.uid(),
  atualizado_em   timestamptz,
  atualizado_por  uuid
);

comment on column core.pessoa.cpf is 'sigilo:pessoal';
comment on column core.pessoa.nis is 'sigilo:pessoal';
comment on column core.pessoa.data_nascimento is 'sigilo:pessoal';
comment on column core.pessoa.endereco is 'sigilo:pessoal';

create table core.papel_pessoa (
  id             uuid primary key default gen_random_uuid(),
  pessoa_id      uuid not null references core.pessoa(id),
  papel          text not null check (papel in
                   ('atendido', 'familiar', 'colaborador', 'voluntario', 'doador', 'parceiro')),
  inicio         date not null default current_date,
  fim            date,
  criado_em      timestamptz not null default now(),
  criado_por     uuid default auth.uid(),
  atualizado_em  timestamptz,
  atualizado_por uuid,
  check (fim is null or fim >= inicio)
);
create unique index papel_pessoa_ativo_unico
  on core.papel_pessoa (pessoa_id, papel) where fim is null;

create table core.vinculo_familiar (
  id                 uuid primary key default gen_random_uuid(),
  pessoa_id          uuid not null references core.pessoa(id),
  relacionado_id     uuid not null references core.pessoa(id),
  parentesco         text not null,
  responsavel_legal  boolean not null default false,
  cuidador_principal boolean not null default false,
  inicio             date not null default current_date,
  fim                date,
  criado_em          timestamptz not null default now(),
  criado_por         uuid default auth.uid(),
  atualizado_em      timestamptz,
  atualizado_por     uuid,
  check (pessoa_id <> relacionado_id),
  check (fim is null or fim >= inicio)
);
create unique index vinculo_familiar_ativo_unico
  on core.vinculo_familiar (pessoa_id, relacionado_id) where fim is null;

create table core.vinculo_servico (
  id             uuid primary key default gen_random_uuid(),
  pessoa_id      uuid not null references core.pessoa(id),
  servico_id     uuid not null references core.servico(id),
  entrada        date not null default current_date,
  saida          date,
  motivo_saida   text,
  criado_em      timestamptz not null default now(),
  criado_por     uuid default auth.uid(),
  atualizado_em  timestamptz,
  atualizado_por uuid,
  check (saida is null or saida >= entrada),
  check ((saida is null) = (motivo_saida is null))
);
create unique index vinculo_servico_ativo_unico
  on core.vinculo_servico (pessoa_id, servico_id) where saida is null;

-- ---------------------------------------------------------------------
-- Identidade e acesso
-- ---------------------------------------------------------------------
create table core.usuario (
  id             uuid primary key references auth.users(id),
  pessoa_id      uuid not null unique references core.pessoa(id),
  email          text not null unique,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  criado_por     uuid default auth.uid(),
  atualizado_em  timestamptz,
  atualizado_por uuid
);

create table core.perfil (
  id             uuid primary key default gen_random_uuid(),
  codigo         text not null unique check (codigo ~ '^[a-z0-9_]+$'),
  nome           text not null,
  descricao      text,
  criado_em      timestamptz not null default now(),
  criado_por     uuid default auth.uid(),
  atualizado_em  timestamptz,
  atualizado_por uuid
);

-- Permissões são textos no formato "<modulo>.<recurso>.<acao>",
-- declarados no manifesto de cada módulo.
create table core.perfil_permissao (
  perfil_id  uuid not null references core.perfil(id),
  permissao  text not null check (permissao ~ '^[a-z0-9_]+(\.[a-z0-9_]+)+$'),
  criado_em  timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  primary key (perfil_id, permissao)
);

create table core.atribuicao (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references core.usuario(id),
  perfil_id      uuid not null references core.perfil(id),
  escopo_tipo    text not null check (escopo_tipo in ('global', 'unidade', 'area', 'servico')),
  escopo_id      uuid,
  inicio         date not null default current_date,
  fim            date,
  criado_em      timestamptz not null default now(),
  criado_por     uuid default auth.uid(),
  atualizado_em  timestamptz,
  atualizado_por uuid,
  check ((escopo_tipo = 'global') = (escopo_id is null)),
  check (fim is null or fim >= inicio)
);
create index atribuicao_usuario on core.atribuicao (usuario_id);

-- ---------------------------------------------------------------------
-- Documentos (arquivo no Storage; aqui só o registro)
-- ---------------------------------------------------------------------
create table core.documento (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  caminho_storage text not null unique,
  tipo            text not null,
  dono_tipo       text not null,
  dono_id         uuid,
  sigilo          text not null check (sigilo in ('interno', 'pessoal', 'sensivel')),
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now(),
  criado_por      uuid default auth.uid(),
  atualizado_em   timestamptz,
  atualizado_por  uuid
);

-- ---------------------------------------------------------------------
-- Auditoria (somente inclusão)
-- ---------------------------------------------------------------------
create table core.auditoria (
  id          bigint generated always as identity primary key,
  ocorrido_em timestamptz not null default now(),
  usuario_id  uuid,
  acao        text not null check (acao in ('leitura', 'inclusao', 'alteracao', 'exclusao', 'exportacao')),
  entidade    text not null,
  registro_id text,
  detalhes    jsonb not null default '{}'::jsonb
);
create index auditoria_registro on core.auditoria (entidade, registro_id);
create index auditoria_usuario on core.auditoria (usuario_id, ocorrido_em desc);

-- ---------------------------------------------------------------------
-- Eventos de domínio (outbox) e entregas por consumidor
-- ---------------------------------------------------------------------
create table core.evento_dominio (
  id            bigint generated always as identity primary key,
  tipo          text not null check (tipo ~ '^[A-Z][A-Za-z]+$'),
  versao        integer not null default 1 check (versao >= 1),
  payload       jsonb not null,
  publicado_por text not null,
  publicado_em  timestamptz not null default now(),
  usuario_id    uuid default auth.uid()
);
create index evento_dominio_tipo on core.evento_dominio (tipo, id);

create table core.evento_entrega (
  evento_id    bigint not null references core.evento_dominio(id),
  consumidor   text not null,
  entregue_em  timestamptz,
  tentativas   integer not null default 0,
  ultimo_erro  text,
  primary key (evento_id, consumidor)
);

-- ---------------------------------------------------------------------
-- Indicadores
-- ---------------------------------------------------------------------
create table core.indicador (
  codigo        text primary key check (codigo ~ '^[a-z0-9_]+$'),
  modulo        text not null,
  nome          text not null,
  unidade       text not null check (unidade in ('percentual', 'moeda', 'quantidade', 'indice')),
  referencia    jsonb,
  criado_em     timestamptz not null default now()
);

create table core.valor_indicador (
  id               bigint generated always as identity primary key,
  indicador_codigo text not null references core.indicador(codigo),
  periodo          text not null,
  escopo_tipo      text not null default 'global' check (escopo_tipo in ('global', 'unidade', 'area', 'servico')),
  escopo_id        uuid,
  valor            numeric not null,
  calculado_em     timestamptz not null default now()
);
create unique index valor_indicador_unico
  on core.valor_indicador (indicador_codigo, periodo, escopo_tipo, coalesce(escopo_id, '00000000-0000-0000-0000-000000000000'));

-- ---------------------------------------------------------------------
-- Gatilhos de carimbo
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['unidade','area','servico','pessoa','papel_pessoa','vinculo_familiar',
                           'vinculo_servico','usuario','perfil','atribuicao','documento']
  loop
    execute format('create trigger carimbo before update on core.%I
                    for each row execute function core.tg_carimbo()', t);
  end loop;
end $$;
