/**
 * Manifesto do módulo Requisições — entregas 1 (base e Materiais / Almoxarifado)
 * 2 (TI / Setor de Informática), 3 (Mobiliário / Setor de Patrimônio), 4 (Manutenção / Setor de Manutenção)
 * e 5 (painel de prazos e feriados).
 */
import { defineModulo } from '@/nucleo/modulos/manifesto';

const BASE = ['requisicoes.acessar', 'requisicoes.solicitar'];

export const manifesto = defineModulo({
  id: 'requisicoes',
  nome: 'Requisições',
  descricao: 'Pedidos de materiais e serviços: aprovação da coordenação, atendimento pelo setor e prazos.',
  icone: 'clipboard',
  schema: 'requisicoes',
  rota: '/requisicoes',
  permissaoAcesso: 'requisicoes.acessar',
  menu: [
    { rotulo: 'Minhas requisições', caminho: '/', permissao: 'requisicoes.solicitar', secao: 'Pedir' },
    { rotulo: 'Nova requisição', caminho: '/nova', permissao: 'requisicoes.solicitar', secao: 'Pedir' },
    { rotulo: 'Para aprovar', caminho: '/aprovar', permissao: 'requisicoes.aprovar', secao: 'Acompanhar' },
    { rotulo: 'Para atender', caminho: '/atender', permissao: 'requisicoes.atender', secao: 'Acompanhar' },
    { rotulo: 'Todas as requisições', caminho: '/todas', permissao: 'requisicoes.ver_todas', secao: 'Acompanhar' },
    { rotulo: 'Painel de prazos', caminho: '/painel', permissao: 'requisicoes.painel', secao: 'Acompanhar' },
    { rotulo: 'Tipos de requisição', caminho: '/tipos', permissao: 'requisicoes.tipos.gerenciar', secao: 'Cadastros' },
    { rotulo: 'Veículos', caminho: '/veiculos', permissao: 'requisicoes.veiculos.cadastrar', secao: 'Cadastros' },
  ],
  permissoes: {
    'requisicoes.acessar': 'Entrar no módulo Requisições',
    'requisicoes.solicitar': 'Abrir requisições e acompanhar as próprias',
    'requisicoes.aprovar': 'Aprovar, devolver ou recusar requisições (coordenação: no seu escopo; Diretoria: todas)',
    'requisicoes.atender': 'Receber e atender as requisições dos tipos do seu setor',
    'requisicoes.ver_todas': 'Ver todas as requisições e o histórico',
    'requisicoes.painel': 'Ver o painel de prazos (SLA) das requisições que a pessoa já pode ver',
    'requisicoes.tipos.gerenciar':
      'Cadastrar e alterar os tipos de requisição, os itens aceitos, o setor responsável, os prazos e o expediente (Administração da plataforma); os feriados são do Núcleo',
    'requisicoes.veiculos.cadastrar':
      'Cadastrar e alterar os veículos institucionais e a manutenção prevista de cada um (Administração da plataforma)',
  },
  perfis: [
    { codigo: 'almoxarifado', nome: 'Almoxarifado', descricao: 'Recebe e atende as requisições de materiais.' },
    { codigo: 'informatica', nome: 'Setor de Informática', descricao: 'Recebe e atende os chamados de TI e as requisições de material de informática.' },
    {
      codigo: 'patrimonio',
      nome: 'Setor de Patrimônio',
      descricao: 'Recebe e atende as requisições de mobiliário (mudança de lugar, empréstimo, recolhimento, montagem).',
    },
    {
      codigo: 'cozinha',
      nome: 'Setor Cozinha',
      descricao: 'Recebe e atende as requisições da cozinha (refeições, lanches e itens de cozinha, inclusive para eventos).',
    },
    {
      codigo: 'manutencao',
      nome: 'Setor de Manutenção',
      descricao: 'Recebe e atende os pedidos de manutenção (elétrica, hidráulica, ar-condicionado, equipamentos, predial).',
    },
  ],
  permissoesPorPerfil: {
    administrador_plataforma: [...BASE, 'requisicoes.tipos.gerenciar', 'requisicoes.veiculos.cadastrar'],
    diretoria: [...BASE, 'requisicoes.aprovar', 'requisicoes.ver_todas', 'requisicoes.painel'],
    financeiro: [...BASE],
    coordenacao_servico: [...BASE, 'requisicoes.aprovar', 'requisicoes.painel'],
    tecnico_avaliador: [...BASE],
    leitura: [...BASE],
    // Perfil básico do Núcleo: qualquer funcionário pede e acompanha as próprias requisições.
    funcionario: [...BASE],
    departamento_pessoal: [...BASE],
    compras: [...BASE],
    almoxarifado: [...BASE, 'requisicoes.atender', 'requisicoes.painel'],
    informatica: [...BASE, 'requisicoes.atender', 'requisicoes.painel'],
    patrimonio: [...BASE, 'requisicoes.atender', 'requisicoes.painel'],
    manutencao: [...BASE, 'requisicoes.atender', 'requisicoes.painel'],
    cozinha: [...BASE, 'requisicoes.atender', 'requisicoes.painel'],
  },
  // Tipos de requisição: só a Administração da plataforma da instituição (decisão de 31/10/2026).
  permissoesRetiradas: { diretoria: ['requisicoes.tipos.gerenciar'] },
  eventos: { publica: [], consome: [] },
  indicadores: ['requisicoes_aprovacao_no_prazo', 'requisicoes_atendimento_no_prazo'],
});
