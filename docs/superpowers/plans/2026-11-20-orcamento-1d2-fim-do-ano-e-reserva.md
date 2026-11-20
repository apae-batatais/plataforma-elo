# Plano — Orçamento 1D.2: fim do ano e reserva (issue #186)

Especificação: `src/modulos/orcamento/especificacao-execucao-tesouraria.md`, seção "Revisão de 17/11/2026".
Frentes: telas, regras e dados. Uma tarefa e um commit por parte.

## Arquivos

- Regras puras: `dominio/conferencia.ts`, `dominio/fim-do-ano.ts`, `dominio/reserva.ts`.
- Casos de uso: `aplicacao/base-execucao.ts` (leitura comum), `conferencia.ts`, `fim-do-ano.ts`, `reserva.ts`, `visao-geral.ts`.
- Abas novas (planilha `orcamento_execucao`): `PoliticaReserva`, `UsosReserva`. Permissão nova: `orcamento.reserva.aprovar` (Diretoria).
- Telas: `telas/situacao.tsx`, `visao-geral.tsx`, `fim-do-ano.ts`, `formularios-reserva.tsx`; rotas `visao-geral`, `tesouraria/conferencia`, `tesouraria/fim-do-ano`, `tesouraria/reserva`.
- Ponto de entrada do módulo: `/orcamento` redireciona (Visão geral, ou Resumo da folha para quem só vê a folha); o Resumo da folha mudou para `/orcamento/resumo`.
- Demonstração: `popularReservaFicticia` (realizado, política proposta e um pedido de uso).

## Tarefas

1. Abas, permissão e menu.
2. Regras puras e testes (conferência, fim do ano, reserva, sinais).
3. Casos de uso e testes de acesso.
4. Telas: Conferência, Fim do ano, Reserva, Visão geral.
5. Demonstração, documentação e verificação.
