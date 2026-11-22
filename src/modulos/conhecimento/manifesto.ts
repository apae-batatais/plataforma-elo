/** Manifesto do módulo Base de Conhecimento — entrega 1 (publicação e ciência). */
import { defineModulo } from '@/nucleo/modulos/manifesto';

const BASE = ['conhecimento.acessar', 'conhecimento.ler'];
const EDITOR = [...BASE, 'conhecimento.publicar', 'conhecimento.acompanhar', 'conhecimento.categorias.gerenciar'];

export const manifesto = defineModulo({
  id: 'conhecimento',
  nome: 'Base de Conhecimento',
  descricao: 'Comunicados, normas e material de referência, com registro de quem leu e deu ciência.',
  icone: 'conhecimento',
  schema: 'conhecimento',
  rota: '/conhecimento',
  permissaoAcesso: 'conhecimento.acessar',
  menu: [
    { rotulo: 'Biblioteca', caminho: '/', permissao: 'conhecimento.acessar' },
    { rotulo: 'Meus documentos', caminho: '/meus-documentos', permissao: 'conhecimento.ler' },
    { rotulo: 'Acompanhamento', caminho: '/acompanhamento', permissao: 'conhecimento.acompanhar', secao: 'Gestão' },
    { rotulo: 'Publicações', caminho: '/publicacoes', permissao: 'conhecimento.publicar', secao: 'Gestão' },
    { rotulo: 'Categorias', caminho: '/categorias', permissao: 'conhecimento.categorias.gerenciar', secao: 'Gestão' },
  ],
  permissoes: {
    'conhecimento.acessar': 'Entrar na Base de Conhecimento',
    'conhecimento.ler': 'Ler as publicações do seu público, dar ciência e ver os seus documentos',
    'conhecimento.publicar': 'Criar, editar e arquivar publicações',
    'conhecimento.acompanhar': 'Ver quem deu ciência e quem está pendente',
    'conhecimento.categorias.gerenciar': 'Cadastrar e desativar categorias',
  },
  perfis: [
    {
      codigo: 'editor_conhecimento',
      nome: 'Editor da Base de Conhecimento',
      descricao: 'Publica comunicados e normas, cadastra categorias e acompanha quem está em dia.',
    },
  ],
  permissoesPorPerfil: {
    administrador_plataforma: [...BASE, 'conhecimento.categorias.gerenciar'],
    diretoria: [...BASE, 'conhecimento.publicar', 'conhecimento.acompanhar'],
    financeiro: [...BASE],
    coordenacao_servico: [...BASE],
    tecnico_avaliador: [...BASE],
    leitura: [...BASE],
    funcionario: [...BASE],
    departamento_pessoal: [...BASE],
    compras: [...BASE],
    almoxarifado: [...BASE],
    informatica: [...BASE],
    patrimonio: [...BASE],
    manutencao: [...BASE],
    cozinha: [...BASE],
    comunicacao: [...BASE],
    coordenacao_comunicacao: [...BASE],
    editor_conhecimento: [...EDITOR],
  },
  eventos: { publica: [], consome: [] },
  indicadores: [],
});
