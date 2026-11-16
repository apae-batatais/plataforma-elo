# Plano: painel de indicadores da Diretoria (issue #57)

Especificação: `docs/especificacao-indicadores.md` · ADR-025.

1. Molde e permissão: `src/capacidades/indicadores/molde.ts`, permissão `plataforma.indicadores.ver` (Diretoria), testes.
2. Requisições: `indicadoresDaPlataforma` com o cálculo de `painelDePrazos`.
3. Comunicação: `indicadoresDaPlataforma` com `montarIndicadores`, mês a mês.
4. Orçamento: `indicadoresDaPlataforma` com `painelGeral`, um ponto por exercício.
5. Composição `src/plataforma/indicadores.ts`, rota `/indicadores`, item "Indicadores" no menu e ícone.
6. Verificar, construir, revisar a usabilidade e abrir o PR.
