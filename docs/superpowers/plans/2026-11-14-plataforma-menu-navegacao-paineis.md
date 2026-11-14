# Menu, navegação, painéis e movimento nos gráficos (entrega da #118)

Especificação: `docs/especificacao-plataforma.md`, seção "Menu, navegação, leiaute dos painéis e movimento nos gráficos". Ramo: `feat/plataforma-menu-navegacao-paineis`.

Passos (um commit por passo):

1. Cores e ícones por app (lilás, oliva), mapa único `src/plataforma/icones-dos-apps.ts`, testes.
2. Menu com três níveis, grupos recolhíveis (`grupos-do-menu.ts`), menu do usuário no rodapé, grupo "Ideias e projetos".
3. Tela inicial: pendências por app (`pendencias.ts`), cartões de mesma altura, textos (entrada e mês).
4. `AtalhosSecoes` e as 5 seções do Painel geral do Orçamento.
5. Tabelas largas: primeira coluna fixa, sombra e dica.
6. Movimento dos gráficos (`movimento.ts` com as contas e `use-valores-animados.ts`).
7. Documentação (identidade visual, habilidades telas e gráficos).

Testes: `tests/ui/menu-e-apps.test.ts` e `tests/ui/movimento.test.ts`.
