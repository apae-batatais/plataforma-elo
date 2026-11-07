/** Manifesto do módulo Comunicação — entrega 1 (base: pedidos, calendário e contatos). */
import { defineModulo } from '@/nucleo/modulos/manifesto';

const BASE = ['comunicacao.acessar', 'comunicacao.solicitar'];
const EQUIPE = [...BASE, 'comunicacao.revisar', 'comunicacao.ver_todos', 'comunicacao.calendario.gerenciar', 'comunicacao.contatos.gerenciar'];
const COORDENACAO = [...EQUIPE, 'comunicacao.aprovar', 'comunicacao.configurar', 'comunicacao.indicadores'];

export const manifesto = defineModulo({
  id: 'comunicacao',
  nome: 'Comunicação',
  descricao: 'Pedidos de publicação: calendário de temas, revisão, aprovação e agendamento.',
  icone: 'megaphone',
  schema: 'comunicacao',
  rota: '/comunicacao',
  permissaoAcesso: 'comunicacao.acessar',
  // Só as telas já prontas; Contatos e Indicadores voltam ao menu com as suas entregas.
  menu: [
    { rotulo: 'Meus pedidos', caminho: '/', permissao: 'comunicacao.solicitar', secao: 'Pedir' },
    { rotulo: 'Novo pedido', caminho: '/novo', permissao: 'comunicacao.solicitar', secao: 'Pedir' },
    { rotulo: 'Pedidos', caminho: '/pedidos', permissao: 'comunicacao.ver_todos', secao: 'Revisar' },
    { rotulo: 'Calendário', caminho: '/calendario', permissao: 'comunicacao.calendario.gerenciar', secao: 'Cadastros' },
    { rotulo: 'Configurações', caminho: '/configuracoes', permissao: 'comunicacao.configurar', secao: 'Cadastros' },
  ],
  permissoes: {
    'comunicacao.acessar': 'Entrar no módulo Comunicação',
    'comunicacao.solicitar': 'Pedir publicações e acompanhar os próprios pedidos',
    'comunicacao.revisar': 'Revisar, devolver, juntar, agendar e publicar os pedidos',
    'comunicacao.aprovar': 'Aprovar, pedir ajustes ou recusar os pedidos revisados',
    'comunicacao.ver_todos': 'Ver todos os pedidos e o histórico',
    'comunicacao.calendario.gerenciar': 'Cadastrar e alterar os itens do calendário de temas',
    'comunicacao.contatos.gerenciar': 'Cadastrar e alterar os contatos da imprensa e os grupos de envio',
    'comunicacao.configurar': 'Definir a antecedência mínima dos pedidos',
    'comunicacao.indicadores': 'Ver os indicadores da Comunicação',
  },
  perfis: [
    { codigo: 'comunicacao', nome: 'Comunicação', descricao: 'Revisa, agenda e publica os pedidos; cuida do calendário e dos contatos da imprensa.' },
    {
      codigo: 'coordenacao_comunicacao',
      nome: 'Coordenação da Comunicação',
      descricao: 'Tudo da Comunicação, mais aprovar os pedidos, definir a antecedência mínima e ver os indicadores.',
    },
  ],
  permissoesPorPerfil: {
    administrador_plataforma: [...BASE],
    diretoria: [...COORDENACAO],
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
    comunicacao: [...EQUIPE],
    coordenacao_comunicacao: [...COORDENACAO],
  },
  eventos: { publica: [], consome: [] },
  indicadores: [
    'comunicacao_volume',
    'comunicacao_tempo_revisao',
    'comunicacao_tempo_aprovacao',
    'comunicacao_tempo_publicacao',
    'comunicacao_publicados_com_atraso',
    'comunicacao_urgentes',
    'comunicacao_temas_sem_publicacao',
  ],
});
