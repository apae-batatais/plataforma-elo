/**
 * Manifesto do módulo Orçamento — Entrega 1A (Folha de Pagamento).
 * As permissões das entregas 1B e 1C entram quando forem construídas.
 */
import { defineModulo } from '@/nucleo/modulos/manifesto';

export const manifesto = defineModulo({
  id: 'orcamento',
  nome: 'Orçamento',
  descricao: 'Folha de pagamento e rateio por centro de custo. Previsão e execução em breve.',
  icone: 'calculator',
  schema: 'orcamento',
  rota: '/orcamento',
  permissaoAcesso: 'orcamento.folha.ver',
  menu: [
    { rotulo: 'Resumo da folha', caminho: '/', permissao: 'orcamento.folha.ver' },
    { rotulo: 'Postos', caminho: '/postos', permissao: 'orcamento.folha.ver_individual' },
    { rotulo: 'Rateio geral', caminho: '/rateio', permissao: 'orcamento.folha.editar' },
    { rotulo: 'Cargos e centros de custo', caminho: '/cadastros', permissao: 'orcamento.folha.ver' },
    { rotulo: 'Parâmetros', caminho: '/parametros', permissao: 'orcamento.folha.ver' },
    { rotulo: 'Importar planilha', caminho: '/importar', permissao: 'orcamento.folha.editar' },
  ],
  permissoes: {
    'orcamento.folha.ver': 'Ver os totais da folha por centro de custo',
    'orcamento.folha.ver_individual': 'Ver o custo e os salários de cada posto',
    'orcamento.folha.editar': 'Cadastrar postos, componentes e rateios; importar a folha',
    'orcamento.parametros.editar': 'Editar cargos, tabela salarial, centros de custo e parâmetros da folha',
  },
  perfis: [
    { codigo: 'departamento_pessoal', nome: 'Departamento Pessoal', descricao: 'Cadastra a folha e o rateio. Vê salários individuais.' },
  ],
  permissoesPorPerfil: {
    diretoria: ['orcamento.folha.ver', 'orcamento.folha.ver_individual'],
    financeiro: ['orcamento.folha.ver', 'orcamento.folha.ver_individual', 'orcamento.folha.editar', 'orcamento.parametros.editar'],
    departamento_pessoal: ['orcamento.folha.ver', 'orcamento.folha.ver_individual', 'orcamento.folha.editar'],
    coordenacao_servico: ['orcamento.folha.ver'],
    leitura: ['orcamento.folha.ver'],
  },
  eventos: { publica: [], consome: [] },
  indicadores: ['custo_folha_centro', 'folha_sem_rateio'],
});
