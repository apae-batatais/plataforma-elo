/**
 * Manifesto do módulo Orçamento — Entregas 1A (Folha de Pagamento) e 1B.1 (Previsão).
 * As permissões da 1B.2 (aprovação) e da 1C entram quando forem construídas.
 */
import { defineModulo } from '@/nucleo/modulos/manifesto';

export const manifesto = defineModulo({
  id: 'orcamento',
  nome: 'Orçamento',
  descricao: 'Previsão do orçamento, folha de pagamento e lotação por serviço. Execução em breve.',
  icone: 'calculator',
  schema: 'orcamento',
  rota: '/orcamento',
  permissaoAcesso: 'orcamento.folha.ver',
  menu: [
    { rotulo: 'Previsão', caminho: '/previsao', permissao: 'orcamento.painel.ver' },
    { rotulo: 'Análise por área', caminho: '/previsao/areas', permissao: 'orcamento.painel.ver' },
    { rotulo: 'Despesas', caminho: '/previsao/despesas', permissao: 'orcamento.painel.ver' },
    { rotulo: 'Receitas', caminho: '/previsao/receitas', permissao: 'orcamento.painel.ver' },
    { rotulo: 'Grupos de gasto', caminho: '/previsao/grupos', permissao: 'orcamento.previsao.editar' },
    { rotulo: 'Fontes de recurso', caminho: '/previsao/fontes', permissao: 'orcamento.previsao.editar' },
    { rotulo: 'Centros de custo', caminho: '/previsao/centros', permissao: 'orcamento.painel.ver' },
    { rotulo: 'Resumo da folha', caminho: '/', permissao: 'orcamento.folha.ver' },
    { rotulo: 'Folha de Pagamento', caminho: '/folha', permissao: 'orcamento.folha.ver_individual' },
    { rotulo: 'Lotação', caminho: '/lotacao', permissao: 'orcamento.folha.editar' },
    { rotulo: 'Parâmetros', caminho: '/parametros', permissao: 'orcamento.folha.ver' },
    { rotulo: 'Importar planilha', caminho: '/importar', permissao: 'orcamento.folha.editar' },
  ],
  permissoes: {
    'orcamento.folha.ver': 'Ver os totais da folha por serviço',
    'orcamento.folha.ver_individual': 'Ver o custo e os salários de cada funcionário',
    'orcamento.folha.editar': 'Cadastrar funcionários, valores e lotação; importar a folha',
    'orcamento.parametros.editar': 'Editar os parâmetros da folha',
    'orcamento.painel.ver': 'Ver a previsão do orçamento (despesas, receitas e indicadores)',
    'orcamento.previsao.editar': 'Lançar despesas e receitas, cadastrar grupos e fontes, abrir o exercício',
  },
  perfis: [
    { codigo: 'departamento_pessoal', nome: 'Departamento Pessoal', descricao: 'Cadastra a folha e a lotação. Vê salários individuais.' },
  ],
  permissoesPorPerfil: {
    diretoria: ['orcamento.folha.ver', 'orcamento.folha.ver_individual', 'orcamento.painel.ver'],
    financeiro: [
      'orcamento.folha.ver', 'orcamento.folha.ver_individual', 'orcamento.folha.editar', 'orcamento.parametros.editar',
      'orcamento.painel.ver', 'orcamento.previsao.editar',
    ],
    departamento_pessoal: ['orcamento.folha.ver', 'orcamento.folha.ver_individual', 'orcamento.folha.editar'],
    coordenacao_servico: ['orcamento.folha.ver'],
    leitura: ['orcamento.folha.ver', 'orcamento.painel.ver'],
  },
  eventos: { publica: [], consome: [] },
  indicadores: ['custo_folha_centro', 'folha_sem_rateio', 'folha_sobre_receita', 'dependencia_recursos_publicos', 'recursos_livres', 'resultado_previsto'],
});
