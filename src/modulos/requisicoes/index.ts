/** Interface pública do módulo Requisições (usada só pela composição e pelas rotas). */
export { manifesto } from './manifesto';
export { TABELAS_REQUISICOES } from './dados/tabelas';
export { popularRequisicoesFicticias } from './dados/ficticios';
export { requisicoesDoServico, type RequisicoesDoServico } from './aplicacao/requisicoes';
export { itensDaAgenda, buscar } from './aplicacao/requisicoes';
export { comprasDoProjeto, type CompraDoProjeto } from './aplicacao/requisicoes';
export type { ProjetoEscolhivel } from './dominio/requisicao';
