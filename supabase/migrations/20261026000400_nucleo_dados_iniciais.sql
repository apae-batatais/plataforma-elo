-- =====================================================================
-- Núcleo · dados iniciais de configuração (não são dados de pessoas)
-- Unidades, áreas, perfis e permissões do Núcleo.
-- Permissões de cada módulo entram na migração do próprio módulo.
-- =====================================================================

insert into core.unidade (codigo, nome) values
  ('sede',  'Sede'),
  ('cer',   'CER'),
  ('rural', 'APAE Rural');

insert into core.area (codigo, nome) values
  ('saude',                  'Saúde'),
  ('educacao',               'Educação'),
  ('assistencia_social',     'Assistência Social'),
  ('administrativo',         'Administrativo'),
  ('mobilizacao',            'Mobilização'),
  ('projetos_intersetoriais','Projetos Intersetoriais'),
  ('comunicacao',            'Comunicação'),
  ('rural',                  'Rural');

insert into core.perfil (codigo, nome, descricao) values
  ('administrador_plataforma', 'Administrador da plataforma',
     'Configura organização, usuários e perfis. Não vê dados de pessoas por padrão.'),
  ('diretoria', 'Diretoria',
     'Vê indicadores de todos os serviços e aprova. Consultas individuais ficam registradas.'),
  ('financeiro', 'Financeiro', 'Opera o Orçamento.'),
  ('coordenacao_servico', 'Coordenação de serviço',
     'Gerencia atendidos e avaliações do seu serviço (atribuição com escopo de serviço).'),
  ('tecnico_avaliador', 'Técnico avaliador',
     'Vê atendidos e aplica avaliações nos serviços em que atua.'),
  ('leitura', 'Leitura', 'Vê apenas painéis agregados.');

-- Permissões do Núcleo por perfil
insert into core.perfil_permissao (perfil_id, permissao)
select p.id, x.permissao
  from (values
    ('administrador_plataforma', 'core.organizacao.gerenciar'),
    ('administrador_plataforma', 'core.acessos.gerenciar'),
    ('administrador_plataforma', 'core.auditoria.ver'),
    ('diretoria',                'core.pessoas.ver'),
    ('diretoria',                'core.auditoria.ver'),
    ('coordenacao_servico',      'core.pessoas.ver'),
    ('coordenacao_servico',      'core.pessoas.editar'),
    ('coordenacao_servico',      'core.vinculos.editar'),
    ('tecnico_avaliador',        'core.pessoas.ver')
  ) as x(perfil, permissao)
  join core.perfil p on p.codigo = x.perfil;
