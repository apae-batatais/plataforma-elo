# Plano: Lançamento de despesas por rateio (Orçamento, #225)

Especificação: `src/modulos/orcamento/especificacao.md` (seção "Lançamento de despesas por rateio") e ADR-038.

1. Dados e regras: aba `LancamentosRateio`, coluna `lancamento_rateio_id` em `Despesas`, cálculo mês a mês
   (`dominio/lancamento-rateio.ts`), casos de uso e recálculo (`aplicacao/lancamentos-rateio.ts`), gatilhos nos
   cinco pontos, travamento no cadastro comum, testes.
2. Tela: Orçamento › Despesas › Lançamento por rateio (lista, formulário com prévia, exclusão com confirmação) e
   etiqueta "Gerada por rateio" na lista comum de Despesas.
3. Ajuda, CLAUDE.md do módulo, dados fictícios, verificação, revisão de usabilidade e PR.
