# Plano: Plano de contas, entrega 2 de 3 (#221)

Especificação: seção "Plano de contas estruturado" (regras 7, 8 e 11). Ver andamento em `...-2-andamento.md`.

1. Colunas `item_id` e `area_plano_id` em `Despesas` e `Realizado`; regras puras (`dominio/plano-contas.ts`).
2. Casos de uso: `aplicacao/plano-lancamento.ts`, `salvarDespesa`, `salvarRealizadoDoMes`, CSV.
3. Telas: `CamposPlano` na despesa e na grade do Realizado; Ajuda.
4. Testes, verificação, build, PR.

Fora: importação de despesas com as colunas novas (roadmap).
