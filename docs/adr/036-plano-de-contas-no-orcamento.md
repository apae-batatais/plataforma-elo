# ADR-036 · Plano de contas estruturado no Orçamento

Situação: proposta · Data: 20 de novembro de 2026 · Proposta: #221

## Contexto

Em 10/11/2026 (#127) a Diretoria decidiu que o Elo "não mantém plano de contas": o Orçamento só
guarda um código de texto livre (`codigo_conta`) em Grupos de gasto e em Fontes. Uma análise
contábil × gerencial mostrou que isso não basta: o mesmo nome de grupo aparece em áreas com sentidos
diferentes, a área contábil de uma despesa pode divergir da área do serviço, e o plano muda de um
exercício para o outro. Em 20/11/2026 a Diretoria reverteu a decisão de propósito.

## Decisão

1. O Orçamento passa a manter um **plano de contas** com três cadastros: **Área** (do plano, independente
   da Área do Serviço em `CentrosCusto`), **Grupo de Contas** com seus **Itens Contábeis**, e o **Plano de
   Contas** (Área × Grupo × Itens habilitados).
2. **Grupo de Contas é o próprio `GruposGasto`**: a aba e os identificadores são mantidos, para
   `Despesas.grupo_id`, regras de rateio e `CategoriasPlanoOrigens` (`grupo:<id>`) continuarem valendo
   sem migração de dados. Só muda o nome na tela.
3. Abas novas na planilha `orcamento`: `AreasPlano`, `ItensContabeis`, `PlanoContas`. `Despesas` e
   `Realizado` ganham colunas opcionais `item_id` e `area_plano_id`.
4. **Vigência por exercício**: `PlanoContas` só recebe inclusões, em lotes completos (como `Lotacoes`);
   para um exercício vale o lote mais recente cuja vigência já começou. O plano de um ano nunca apaga o
   do anterior. Áreas, Grupos e Itens são cadastros únicos, encerrados (`ativo = FALSE`), nunca apagados;
   "existe no exercício" é estar no plano daquele exercício.
5. O plano **orienta, nunca bloqueia**: lançar com item ou área fora do plano grava, com aviso.
6. O plano estruturado substitui o texto livre nos **Grupos**. A coluna `codigo_conta` de `GruposGasto`
   continua na planilha (nada é apagado) e passa a ser o código do Grupo de Contas. As **Fontes** não
   fazem parte do plano (são receita) e mantêm o `codigo_conta` da #127.
7. Nenhuma mudança no Núcleo; a Área do Serviço continua em `CentrosCusto`.

## Consequências

- Divergência entre a área do plano e a área do serviço fica visível (lançamentos com as duas
  diferentes), e o realizado importado no futuro casa por conta e centro sem decisão manual.
- Se a decisão 2 estiver errada (Diretoria quiser Grupo de Contas separado do Grupo de gasto), é preciso
  migrar `grupo_id` das despesas: custo médio, por isso a decisão foi ligada à própria proposta.
- Agrupar painéis pelo plano e importar o plano de planilha ficam para outra proposta.
