/**
 * Manifesto do módulo Requisições — entrega 1: base do módulo e requisição de
 * Materiais (Almoxarifado). TI, Mobiliário e Manutenção entram uma por entrega.
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
    { rotulo: 'Tipos de requisição', caminho: '/tipos', permissao: 'requisicoes.tipos.gerenciar', secao: 'Cadastros' },
  ],
  permissoes: {
    'requisicoes.acessar': 'Entrar no módulo Requisições',
    'requisicoes.solicitar': 'Abrir requisições e acompanhar as próprias',
    'requisicoes.aprovar': 'Aprovar, devolver ou recusar requisições (coordenação: no seu escopo; Diretoria: todas)',
    'requisicoes.atender': 'Receber e atender as requisições dos tipos do seu setor',
    'requisicoes.ver_todas': 'Ver todas as requisições e o histórico',
    'requisicoes.tipos.gerenciar': 'Cadastrar os tipos de requisição, o setor responsável, os prazos e o expediente',
  },
  perfis: [{ codigo: 'almoxarifado', nome: 'Almoxarifado', descricao: 'Recebe e atende as requisições de materiais.' }],
  permissoesPorPerfil: {
    administrador_plataforma: [...BASE, 'requisicoes.tipos.gerenciar'],
    diretoria: [...BASE, 'requisicoes.aprovar', 'requisicoes.ver_todas', 'requisicoes.tipos.gerenciar'],
    financeiro: [...BASE],
    coordenacao_servico: [...BASE, 'requisicoes.aprovar'],
    tecnico_avaliador: [...BASE],
    leitura: [...BASE],
    departamento_pessoal: [...BASE],
    compras: [...BASE],
    almoxarifado: [...BASE, 'requisicoes.atender'],
  },
  eventos: { publica: [], consome: [] },
  indicadores: ['requisicoes_aprovacao_no_prazo', 'requisicoes_atendimento_no_prazo'],
});
