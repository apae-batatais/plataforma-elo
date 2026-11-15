/** Interface pública do app Projetos (usada só pela composição e pelas rotas). */
export { manifesto } from './manifesto';
export { TABELAS_PROJETOS } from './dados/tabelas';
export { popularProjetosFicticios } from './dados/ficticios';
export { projetosDoServico, projetosParaCompra, type ProjetoParaCompra, type ProjetosDoServico } from './aplicacao/ligacao';
export { itensDaAgenda, buscar } from './aplicacao/agenda-busca';
