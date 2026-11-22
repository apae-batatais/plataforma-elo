# Plano: Ligações onda 2, L4 — indicadores do marco lógico com número automático (#242)

Regras L1 a L6 e L12 da especificação do app Projetos ("Ligações, onda 2"). Frentes: telas, regras e dados.

1. Domínio (`dominio/indicadores.ts`): fontes, situação contra a meta, frases.
2. Abas: colunas novas em `MarcoLogico` e aba `IndicadoresMedidos` (declarada com `definirTabela`, registrada em `TABELAS_PROJETOS`).
3. Casos de uso (`aplicacao/indicadores.ts`): `lerIndicadores`, `definirFonteDoItem`, `fotografarIndicadores`, `registrarMedicao`.
4. Tela: aba Marco lógico (bloco Indicadores, escolha da fonte e do serviço, meta, "Registrar medição", histórico).
5. Demonstração, Ajuda, `CLAUDE.md` do módulo e especificação.
6. Testes (quem vê e quem altera), `npm run verificar`, `npm run build`, PR.
