/**
 * Manifesto do módulo Orçamento — Entregas 1A (Folha de Pagamento) e 1B (Previsão).
 * As permissões da 1C (execução) entram quando ela for construída.
 */
import { defineModulo } from '@/nucleo/modulos/manifesto';

export const manifesto = defineModulo({
  id: 'orcamento',
  nome: 'Orçamento',
  descricao: 'Previsão do orçamento, folha de pagamento e lotação por serviço. Execução em breve.',
  icone: 'calculator',
  schema: 'orcamento',
  rota: '/orcamento',
  permissaoAcesso: 'orcamento.acessar',
  menu: [
    { rotulo: 'Painel geral', caminho: '/previsao/geral', permissao: 'orcamento.painel.ver', secao: 'Painéis' },
    { rotulo: 'Previsão do ano', caminho: '/previsao', permissao: 'orcamento.painel.ver', secao: 'Painéis' },
    { rotulo: 'Análise por área', caminho: '/previsao/areas', permissao: 'orcamento.painel.ver', secao: 'Painéis' },
    { rotulo: 'Despesas', caminho: '/previsao/despesas', permissao: 'orcamento.painel.ver', secao: 'Planejamento' },
    { rotulo: 'Receitas', caminho: '/previsao/receitas', permissao: 'orcamento.painel.ver', secao: 'Planejamento' },
    { rotulo: 'Propostas', caminho: '/previsao/propostas', permissao: 'orcamento.previsao.propor', secao: 'Planejamento' },
    { rotulo: 'Cotações', caminho: '/previsao/propostas', permissao: 'orcamento.previsao.cotar', secao: 'Planejamento' },
    { rotulo: 'Remanejamentos', caminho: '/previsao/ajustes', permissao: 'orcamento.painel.ver', secao: 'Planejamento' },
    { rotulo: 'Importar despesas e receitas', caminho: '/previsao/importar', permissao: 'orcamento.previsao.editar', secao: 'Planejamento' },
    { rotulo: 'Grupos de gasto', caminho: '/previsao/grupos', permissao: 'orcamento.previsao.editar', secao: 'Cadastros' },
    { rotulo: 'Fontes de recurso', caminho: '/previsao/fontes', permissao: 'orcamento.previsao.editar', secao: 'Cadastros' },
    { rotulo: 'Centros de custo', caminho: '/previsao/centros', permissao: 'orcamento.painel.ver', secao: 'Cadastros' },
    { rotulo: 'Resumo da folha', caminho: '/', permissao: 'orcamento.folha.ver', secao: 'Folha de pagamento' },
    { rotulo: 'Folha completa', caminho: '/folha', permissao: 'orcamento.folha.ver_individual', secao: 'Folha de pagamento' },
    { rotulo: 'Lotação', caminho: '/lotacao', permissao: 'orcamento.folha.editar', secao: 'Folha de pagamento' },
    { rotulo: 'Parâmetros', caminho: '/parametros', permissao: 'orcamento.folha.ver', secao: 'Folha de pagamento' },
    { rotulo: 'Importar planilha', caminho: '/importar', permissao: 'orcamento.folha.editar', secao: 'Folha de pagamento' },
  ],
  permissoes: {
    'orcamento.acessar': 'Entrar no módulo Orçamento (o que aparece depende das demais permissões)',
    'orcamento.folha.ver': 'Ver os totais da folha por serviço',
    'orcamento.folha.ver_individual': 'Ver o custo e os salários de cada funcionário',
    'orcamento.folha.editar': 'Cadastrar funcionários, valores e lotação; importar a folha',
    'orcamento.parametros.editar': 'Editar os parâmetros da folha',
    'orcamento.painel.ver': 'Ver a previsão do orçamento (despesas, receitas e indicadores)',
    'orcamento.previsao.editar': 'Lançar despesas e receitas, cadastrar grupos e fontes, abrir o exercício, decidir propostas e pedir remanejamentos',
    'orcamento.previsao.propor': 'Propor itens de despesa nos serviços do seu escopo',
    'orcamento.previsao.cotar': 'Informar a cotação (quantidade, valor e meses) das propostas pendentes, sem decidir',
    'orcamento.exercicio.aprovar': 'Aprovar e encerrar o exercício; aprovar remanejamentos e suplementações',
  },
  perfis: [
    { codigo: 'departamento_pessoal', nome: 'Departamento Pessoal', descricao: 'Cadastra a folha e a lotação. Vê salários individuais.' },
    { codigo: 'compras', nome: 'Compras', descricao: 'Cota as propostas de despesa das coordenações. Não decide nem vê a folha.' },
  ],
  permissoesPorPerfil: {
    diretoria: ['orcamento.acessar', 'orcamento.folha.ver', 'orcamento.folha.ver_individual', 'orcamento.painel.ver', 'orcamento.exercicio.aprovar'],
    financeiro: [
      'orcamento.acessar', 'orcamento.folha.ver', 'orcamento.folha.ver_individual', 'orcamento.folha.editar', 'orcamento.parametros.editar',
      'orcamento.painel.ver', 'orcamento.previsao.editar', 'orcamento.previsao.propor',
    ],
    departamento_pessoal: ['orcamento.acessar', 'orcamento.folha.ver', 'orcamento.folha.ver_individual', 'orcamento.folha.editar'],
    coordenacao_servico: ['orcamento.acessar', 'orcamento.folha.ver', 'orcamento.previsao.propor'],
    leitura: ['orcamento.acessar', 'orcamento.folha.ver', 'orcamento.painel.ver'],
    compras: ['orcamento.acessar', 'orcamento.previsao.cotar'],
  },
  eventos: { publica: [], consome: [] },
  indicadores: ['custo_folha_centro', 'folha_sem_rateio', 'folha_sobre_receita', 'dependencia_recursos_publicos', 'recursos_livres', 'resultado_previsto'],
});
