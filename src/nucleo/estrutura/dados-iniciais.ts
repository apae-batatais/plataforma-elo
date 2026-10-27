/**
 * Configuração inicial (não são dados de pessoas): unidades, áreas, perfis e
 * as permissões do Núcleo. Gravada por "Preparar estrutura" só em abas vazias.
 */
export const UNIDADES_INICIAIS = [
  { codigo: 'sede', nome: 'Sede' },
  { codigo: 'cer', nome: 'CER' },
  { codigo: 'rural', nome: 'APAE Rural' },
];

export const AREAS_INICIAIS = [
  { codigo: 'saude', nome: 'Saúde' },
  { codigo: 'educacao', nome: 'Educação' },
  { codigo: 'assistencia_social', nome: 'Assistência Social' },
  { codigo: 'administrativo', nome: 'Administrativo' },
  { codigo: 'mobilizacao', nome: 'Mobilização' },
  { codigo: 'projetos_intersetoriais', nome: 'Projetos Intersetoriais' },
  { codigo: 'comunicacao', nome: 'Comunicação' },
  { codigo: 'rural', nome: 'Rural' },
];

export const PERFIS_INICIAIS = [
  { codigo: 'administrador_plataforma', nome: 'Administrador da plataforma', descricao: 'Configura organização, usuários e perfis. Não vê atendidos.' },
  { codigo: 'diretoria', nome: 'Diretoria', descricao: 'Vê todas as pessoas e a auditoria; aprova.' },
  { codigo: 'financeiro', nome: 'Financeiro', descricao: 'Opera o Orçamento e a Folha.' },
  { codigo: 'coordenacao_servico', nome: 'Coordenação de serviço', descricao: 'Gerencia atendidos do seu escopo.' },
  { codigo: 'tecnico_avaliador', nome: 'Técnico avaliador', descricao: 'Vê atendidos do seu escopo e aplica avaliações.' },
  { codigo: 'leitura', nome: 'Leitura', descricao: 'Vê apenas painéis agregados.' },
];

export const PERMISSOES_INICIAIS: { perfil: string; permissao: string }[] = [
  { perfil: 'administrador_plataforma', permissao: 'core.organizacao.gerenciar' },
  { perfil: 'administrador_plataforma', permissao: 'core.acessos.gerenciar' },
  { perfil: 'administrador_plataforma', permissao: 'core.auditoria.ver' },
  { perfil: 'diretoria', permissao: 'core.pessoas.ver' },
  { perfil: 'diretoria', permissao: 'core.auditoria.ver' },
  { perfil: 'coordenacao_servico', permissao: 'core.pessoas.ver' },
  { perfil: 'coordenacao_servico', permissao: 'core.pessoas.editar' },
  { perfil: 'coordenacao_servico', permissao: 'core.vinculos.editar' },
  { perfil: 'tecnico_avaliador', permissao: 'core.pessoas.ver' },
];
