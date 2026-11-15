# Plano: rateio de fonte nas despesas e na folha (R3 e R4), issue #140

Especificação aprovada: PR #152 (seção "Rateio de fonte, R3 e R4" em `src/modulos/orcamento/especificacao.md`).
Quatro entregas, cada uma com PR próprio, nesta ordem:

1. **R3a**: catálogo de Parcerias na plataforma; Cadastros › Fontes dos termos (ligação e conta; categorias do plano).
2. **R3b**: rateio de fonte na despesa; fonte "Várias"; avisos do plano de aplicação.
3. **R4a**: rateio de fonte na folha, horas semanais, "Calcular pelas horas", base "horas".
4. **R4b**: painel Comprometimento das fontes, contrapartida, caixa e indicadores.

## R3a: tarefas
- [x] Abas `FontesTermo` e `CategoriasPlanoOrigens` (`dados/tabelas.ts`)
- [x] Regras puras (`dominio/fontes-termo.ts`) e casos de uso (`aplicacao/fontes-termo.ts`)
- [x] Interface `CatalogoParcerias` e `src/plataforma/catalogos.ts`
- [x] Tela Cadastros › Fontes dos termos, ações e menu
- [x] Testes (regras, acesso, composição) e documentação
