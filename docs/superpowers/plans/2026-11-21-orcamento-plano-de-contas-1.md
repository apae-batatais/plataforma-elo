# Plano: Plano de contas estruturado, entrega 1 de 3 (#221)

Especificação: `src/modulos/orcamento/especificacao.md` (seção "Plano de contas estruturado") e ADR-036.
Entrega 1: cadastros e plano por exercício. Regras 1 a 6, 11 (CSV do plano) e 13 da especificação.

## Tarefas

1. Abas `AreasPlano`, `ItensContabeis`, `PlanoContas` e regras puras (`dominio/plano-contas.ts`).
2. Casos de uso (`aplicacao/plano-contas.ts`), CSV do plano e testes.
3. Demonstração (`popularPlanoContasFicticio`).
4. Telas: Plano de contas, Áreas do plano, Grupos de Contas (renome) com Itens; menu e rota do CSV.
5. Ajuda, `CLAUDE.md` do módulo, roadmap; verificação, build e revisão de usabilidade; PR.

## Fica para as entregas 2 e 3

Colunas `item_id`/`area_plano_id` nos lançamentos, avisos, importação e CSV com as colunas novas (2);
comparar exercícios e divergências (3). Cadastro em lote de Áreas e Itens: ver andamento.
