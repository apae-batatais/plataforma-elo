/** Interface pública do app Projetos (usada só pela composição e pelas rotas). */
export { manifesto } from './manifesto';
export { TABELAS_PROJETOS } from './dados/tabelas';
export { popularProjetosFicticios } from './dados/ficticios';
export { projetosDoServico, projetosParaCompra, projetosParaRealizado, type ProjetoParaCompra, type ProjetoParaRealizado, type ProjetosDoServico } from './aplicacao/ligacao';
export { itensDaAgenda, buscar } from './aplicacao/agenda-busca';
export { projetosComTermoParadosOuCancelados, type CatalogoTermos, type TermoLigado, type PedidoRascunhoDeTermo } from './aplicacao/termo';
export type { CatalogoLeitura, CompraLigada, ItemLigado, LeitorLigacao } from './aplicacao/catalogo-leitura';
export type { CatalogoReceitas, FonteDeReceita, PedidoReceitaDoEvento } from './aplicacao/catalogo-orcamento';
