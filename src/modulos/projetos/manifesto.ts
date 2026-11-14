/** Manifesto do app Projetos — entrega P1 (base: ideia, responsável, porta 1, pareceres, decisões e alçada). */
import { defineModulo } from '@/nucleo/modulos/manifesto';

// Pareceristas e decisores de alçada são designados por e-mail na configuração (ADR-021); a permissão abre a
// ação e a designação é conferida no caso de uso. Por isso `parecer` e `decidir_alcada` vão para todos os perfis.
const BASE = ['projetos.acessar', 'projetos.propor', 'projetos.parecer', 'projetos.decidir_alcada'];
const COORDENACAO = [...BASE, 'projetos.assumir', 'projetos.gerenciar'];
const DIRETORIA = [...COORDENACAO, 'projetos.ver_todos', 'projetos.decidir', 'projetos.configurar'];

export const manifesto = defineModulo({
  id: 'projetos',
  nome: 'Projetos',
  descricao: 'Da ideia ao encerramento: responsável, portas de decisão com pareceres e alçada.',
  icone: 'projetos',
  schema: 'projetos',
  rota: '/projetos',
  permissaoAcesso: 'projetos.acessar',
  menu: [
    { rotulo: 'Meus projetos e ideias', caminho: '/', permissao: 'projetos.acessar', secao: 'Ideias e projetos' },
    { rotulo: 'Nova ideia', caminho: '/nova', permissao: 'projetos.propor', secao: 'Ideias e projetos' },
    { rotulo: 'Ideias à espera de responsável', caminho: '/ideias', permissao: 'projetos.assumir', secao: 'Ideias e projetos' },
    { rotulo: 'Todos os projetos', caminho: '/todos', permissao: 'projetos.ver_todos', secao: 'Diretoria' },
    { rotulo: 'Configurações', caminho: '/configuracoes', permissao: 'projetos.configurar', secao: 'Diretoria' },
  ],
  permissoes: {
    'projetos.acessar': 'Entrar no app Projetos',
    'projetos.propor': 'Cadastrar ideias de projeto e acompanhar as próprias',
    'projetos.assumir': 'Assumir ideias como responsável',
    'projetos.gerenciar': 'Desenvolver e gerenciar os projetos de que é responsável (e os do seu escopo)',
    'projetos.parecer': 'Dar parecer nas portas, no tipo para o qual foi designado na configuração',
    'projetos.ver_todos': 'Ver todos os projetos e os pareceres',
    'projetos.decidir': 'Decidir as portas (seguir, ajustar ou parar) e retomar projetos parados',
    'projetos.decidir_alcada': 'Decidir as portas acima do limite de alçada, se designado na configuração',
    'projetos.configurar': 'Configurar pareceres exigidos, limite de alçada e designados',
  },
  permissoesPorPerfil: {
    administrador_plataforma: [...BASE],
    diretoria: [...DIRETORIA],
    financeiro: [...BASE],
    coordenacao_servico: [...COORDENACAO],
    tecnico_avaliador: [...BASE],
    leitura: ['projetos.acessar'],
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
  },
  eventos: { publica: [], consome: [] },
  indicadores: [],
});
