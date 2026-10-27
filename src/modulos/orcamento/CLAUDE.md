# Módulo Orçamento — regras para o agente

Leia antes `especificacao.md` desta pasta e o `CLAUDE.md` da raiz.

- Escopo: altere apenas `src/modulos/orcamento/` e as rotas `src/app/orcamento/`.
- Armazenamento: as abas do módulo são declaradas com `definirTabela` em
  `dados/tabelas.ts`, nas planilhas `orcamento` e `orcamento_folha` do catálogo `PLANILHAS`. Não leia
  nem grave abas de outros módulos; use os casos de uso do Núcleo.
- Pastas: `dominio/` regras puras; `aplicacao/` casos de uso (sempre com
  `Autorizador` e `registrarAuditoria`); `dados/` tabelas; `telas/`; `testes/`.
- Dados sensíveis deste módulo: `Postos.colaborador` e todos os valores de
  `Componentes` (pessoal). Só aparecem com `orcamento.folha.ver_individual`;
  abrir a ficha de um posto registra auditoria de leitura. Os demais veem totais.
- Rateio: nunca salvar fora de 100% (`validarRateio`). Abas com vigência só
  recebem inclusões; a linha mais recente vale a partir da vigência.
- Permissões: `orcamento.<recurso>.<acao>`, declaradas no manifesto.
