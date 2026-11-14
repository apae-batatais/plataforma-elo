/** Interface pública do módulo Parcerias (usada só pela composição e pelas rotas). */
export { manifesto } from './manifesto';
export { TABELAS_PARCERIAS } from './dados/tabelas';
export { popularParceriasFicticias } from './dados/ficticios';
export { termosParaOrcamento, type TermoParaOrcamento } from './aplicacao/parcerias';
export { itensDaAgenda, buscar } from './aplicacao/parcerias';
export { definirFonteDaMeta, type HojeDaMeta, type NumerosDePessoas } from './aplicacao/parcerias';
