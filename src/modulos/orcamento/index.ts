/** Interface pública do módulo Orçamento (usada só pela composição e pelas rotas). */
export { manifesto } from './manifesto';
export { TABELAS_ORCAMENTO } from './dados/tabelas';
export { popularCedidosFicticia, popularFolhaFicticia, popularHistoricoFicticia, popularPrevisaoFicticia, popularTesourariaFicticia } from './dados/ficticios';
export { custoDoServico, type CustoDoServico } from './aplicacao/ligacao';
export { painelSustentabilidade, type CatalogoParcerias } from './aplicacao/sustentabilidade';
export type { TermoDoPainel } from './dominio/sustentabilidade';
