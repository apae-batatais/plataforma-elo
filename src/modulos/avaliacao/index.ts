/** Interface pública do módulo Avaliação de Serviços Sociais (usada só pela composição e pelas rotas). */
export { manifesto } from './manifesto';
export { TABELAS_AVALIACAO } from './dados/tabelas';
export { popularAplicacoesFicticias, popularAvaliacoesFicticias } from './dados/ficticios';
export { avaliacaoDoServico, indicadoresDoServico, itensDaAgenda, type AvaliacaoDoServico, type IndicadoresDoServico } from './aplicacao/avaliacoes';
export { cadastrarInstrumento } from './aplicacao/aplicacoes';
export { avaliacoesParaLigar, confirmarLigacao, desfazerLigacao } from './aplicacao/ligacoes';
