/** Interface pública do módulo Orçamento (usada só pela composição e pelas rotas). */
export { manifesto } from './manifesto';
export { TABELAS_ORCAMENTO } from './dados/tabelas';
export { popularCedidosFicticia, popularFolhaFicticia, popularHistoricoFicticia, popularPrevisaoFicticia, popularReservaFicticia, popularTesourariaFicticia } from './dados/ficticios';
export { custoDoServico, saldoParaConferencia, type CustoDoServico, type GrupoDeGasto, type SaldoParaConferencia } from './aplicacao/ligacao';
export { painelSustentabilidade, type CatalogoParcerias } from './aplicacao/sustentabilidade';
export type { TermoDoPainel } from './dominio/sustentabilidade';
export { cedidosPorServicoECedente, type CedidoDoServicoPorCedente } from './aplicacao/participacao';
export { indicadoresDaPlataforma as indicadoresOrcamento } from './aplicacao/indicadores-plataforma';
