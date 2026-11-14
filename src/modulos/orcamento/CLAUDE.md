# Módulo Orçamento — regras para o agente

Leia antes `especificacao.md` desta pasta e o `CLAUDE.md` da raiz.

- Escopo: altere apenas `src/modulos/orcamento/` e as rotas `src/app/orcamento/`.
- Armazenamento: as abas do módulo são declaradas com `definirTabela` em
  `dados/tabelas.ts`, nas planilhas `orcamento`, `orcamento_folha` e `orcamento_execucao` do catálogo `PLANILHAS`. Não leia
  nem grave abas de outros módulos; use os casos de uso do Núcleo.
- Pastas: `dominio/` regras puras; `aplicacao/` casos de uso (sempre com
  `Autorizador` e `registrarAuditoria`); `dados/` tabelas; `telas/`; `testes/`.
- Dados sensíveis deste módulo: `Postos.colaborador` e todos os valores de
  `Componentes` (pessoal). Só aparecem com `orcamento.folha.ver_individual`;
  abrir a ficha de um posto registra auditoria de leitura. Os demais veem totais.
- Rateio: nunca salvar fora de 100% (`validarRateio`). Abas com vigência só
  recebem inclusões; a linha mais recente vale a partir da vigência.
- Previsão (1B): planilha `orcamento`, sem dados pessoais. O RH da folha entra automático
  (`resumoFolha`, custo × lotação) e fecha em centavos com o Resumo da folha.
- Tesouraria (1D.1): planilha `orcamento_execucao` (abas `Contas`, `Saldos`, `AjustesConciliacao`, `MudancasClasse`), sem dados
  pessoais. Saldos só para quem tem `orcamento.tesouraria.ver` (Diretoria e Financeiro); editar é do Financeiro.
  Totais por classe são sempre somas calculadas pelo Elo; o mês atual é o de Brasília.
- Permissões: `orcamento.<recurso>.<acao>`, declaradas no manifesto.
- Histórico (1E): abas `Historico` e `HistoricoAnos` na planilha `orcamento_execucao`, sem dados pessoais.
  Importar ano fechado só confere e grava se o total bater em centavos com o da planilha; reimportar ou
  desfazer cancela (`ativo = FALSE`). Ver: `orcamento.historico.ver`; importar: `orcamento.historico.editar`.
- Rateio dos custos comuns (R1, ADR-020): regras e bases próprias na planilha `orcamento`; só `orcamento.parametros.editar`
  altera, quem vê o painel vê o resultado. Cálculo puro em `dominio/rateio-custos.ts` (comuns → apoio → administrativo;
  precedência item > grupo > serviço > base do painel). O total do orçamento nunca muda pelo rateio.
- Realizado (1C.1): aba `Realizado` na planilha `orcamento_execucao`, totais mensais informados à mão (sem coluna pessoal).
  Informar/corrigir/remover: `orcamento.realizado.editar` (Financeiro); ver: `orcamento.execucao.ver` (Coordenação só o seu escopo,
  sem receitas). Salvar o mês é tudo ou nada (versão lida); remover encerra (`ativo = FALSE`). Regras puras em `dominio/realizado.ts`.
- Folha em caixa (P1 da #126): `dominio/caixa.ts` (puro). O custo do mês não muda; o Resumo soma o deslocamento de 13º, 1/3 de férias e abono (com encargos) ao custo. Calendário na aba `CalendarioPagamento` (só inclusões, só `orcamento.parametros.editar`); `contrato` e `mes_ferias` em `Funcionarios`.
- Cedidos (C1 da #125): `dominio/cedidos.ts` (puro) e `aplicacao/cedidos.ts`. Abas `Cedidos`, `ValoresCedidos`, `LotacaoCedidos` (planilha da folha, nome e valor pessoais) e `Cedentes` (planilha `orcamento`). Nada altera folha, caixa ou passivo. Ver e abrir ficha: `folha.ver_individual` (com auditoria de leitura); alterar: `folha.editar`. Aviso de fim de cessão (parâmetro `cessao_aviso_dias`): DP, Financeiro e Diretoria com nome; coordenação só no seu escopo e sem nome.
