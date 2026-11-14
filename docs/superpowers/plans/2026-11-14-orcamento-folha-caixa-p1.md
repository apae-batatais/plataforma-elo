# Plano — Orçamento: folha em caixa (P1 da #126)

Especificação: `src/modulos/orcamento/especificacao-folha-caixa-passivo.md` (P1). P2 (passivo) e P3 (provisão) ficam para entregas próprias.

1. Regras puras do caixa (`dominio/caixa.ts`) e testes.
2. Abas: `CalendarioPagamento` (nova) e colunas `contrato` e `mes_ferias` em `Funcionarios`.
3. Casos de uso: caixa no `resumoFolha`, `calendarioDePagamentos`, `salvarCalendario`, contrato e mês de férias em `salvarPosto`.
4. Telas: controle Custo do mês / Caixa no Resumo, calendário em Parâmetros, campos na ficha.
5. Testes de acesso, verificar, build, revisão de usabilidade e PR.
