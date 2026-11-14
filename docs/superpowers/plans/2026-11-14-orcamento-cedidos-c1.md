# Plano — Orçamento: profissionais cedidos, C1 (cadastro e avisos) da #125

Especificação: `src/modulos/orcamento/especificacao-cedidos.md` (C1). A C2 (custo real, visão com/sem cedidos e participação) fica para entrega própria.

1. Regras puras (`dominio/cedidos.ts`): validações, ativo no mês, valor vigente, aviso de fim.
2. Abas: `Cedentes`, `Cedidos`, `ValoresCedidos`, `LotacaoCedidos` e parâmetro `cessao_aviso_dias`.
3. Casos de uso (`aplicacao/cedidos.ts`): quem cede, cedido, valor, lotação, prorrogar, encerrar, avisos.
4. Telas: Cedidos (lista, ficha, formulário), Quem cede, faixa de aviso, parâmetro e número no menu.
5. Testes de acesso, verificar, build, revisão de usabilidade e PR.
