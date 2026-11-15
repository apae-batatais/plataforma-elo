/** Interface pública do módulo Orçamento (usada só pela composição e pelas rotas). */
export { manifesto } from './manifesto';
export { TABELAS_ORCAMENTO } from './dados/tabelas';
export { popularCedidosFicticia, popularFolhaFicticia, popularHistoricoFicticia, popularPrevisaoFicticia, popularTesourariaFicticia } from './dados/ficticios';
export { custoDoServico, saldoParaConferencia, type CustoDoServico, type GrupoDeGasto, type SaldoParaConferencia } from './aplicacao/ligacao';
export { cedidosPorServicoECedente, type CedidoDoServicoPorCedente } from './aplicacao/participacao';
