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
