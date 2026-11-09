# Orçamento 1E — Histórico — plano

Especificação: `src/modulos/orcamento/especificacao-execucao-tesouraria.md` (PR #44), regras 23 a 26 e telas 12 a 14. Issue #56.

## Escopo

| Entra | Fica para depois |
| --- | --- |
| Importar ano fechado (2017 a ano anterior) com DE-PARA de colunas e de fontes e conferência do total em centavos (regras 23 e 24) | Histórico vindo do próprio realizado (regra 25): depende da 1C |
| Indicadores históricos e tabela comparativa (tela 12) | Painel geral da 1B usar o Histórico (fim da especificação): fica no roadmap |
| Fontes de receita ano a ano (tela 13) | — |
| Ano em andamento marcado como parcial; crescimento só entre anos completos (regra 26) | — |

## Tarefas

1. Regras puras: `dominio/historico.ts` (leitura da aba, conferência do total, indicadores).
2. Abas `Historico` e `HistoricoAnos` (planilha `orcamento_execucao`), permissões e menu.
3. Casos de uso: ler, analisar, importar e desfazer, com `Autorizador` e auditoria.
4. Telas: Indicadores, Fontes de receita, Importar ano fechado.
5. Dados fictícios, documentação, verificação e PR.
