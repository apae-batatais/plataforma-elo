# ADR-038: Lançamento de despesas por rateio

## Situação

Aprovada (proposta #225, 20/11/2026).

## Contexto

A Entrega R1 (ADR-020, proposta #91) já calcula o rateio dos custos comuns em dois níveis (área e
serviço), por atendidos, m², profissionais ou outras bases — mas só **para mostrar** o resultado na
Análise por área (`dominio/analise-area.ts`, campo `porRegra`). A despesa lançada continua sendo uma
única linha; nada é gravado por serviço.

A Diretoria pediu um passo além: uma despesa prevista e rateada (ex.: uma conta de alimentação
dividida entre vários serviços por nº de atendidos) precisa **gerar uma linha de despesa por
serviço**, com o valor já rateado, em vez de só aparecer calculada no painel. Essas linhas não podem
ser editadas direto no cadastro comum de Despesas, e precisam se manter atualizadas automaticamente
enquanto o orçamento ainda está em elaboração (exercício com `situacao: 'elaboracao'`), se a base, os
participantes da regra ou o valor do lançamento mudarem.

Isso introduz um padrão novo no Orçamento: despesa gerada e travada pelo sistema, não pelo Financeiro
diretamente, por isso a decisão de arquitetura.

## Decisão

1. **Nova aba `LancamentosRateio`** (planilha `orcamento`), separada de `Despesas`: guarda o
   "lançamento mãe" — os mesmos campos de uma despesa (grupo, fonte, descrição, quantidade,
   ocorrências, valor unitário, distribuição, meses, categoria, observação) mais a **Regra de
   rateio** (`RegrasRateio`, já existente, obrigatória). Não pertence a nenhum serviço.
2. **Coluna nova opcional `lancamento_rateio_id` em `Despesas`**: quando preenchida, a linha foi
   gerada por um `LancamentosRateio` e fica travada no cadastro comum (sem editar nem excluir
   direto); mostra de onde veio.
3. **Geração:** ao salvar o lançamento, a Regra de rateio já existente (`ratearPelaRegra`,
   `dominio/rateio-custos.ts`) divide o valor de cada mês entre os serviços participantes, com os
   mesmos pesos em todos os meses (as bases não variam por mês). Cada serviço participante recebe
   uma linha de `Despesas` marcada com `lancamento_rateio_id`.
4. **Recálculo automático**, só enquanto o exercício do lançamento está em elaboração, nestes cinco
   pontos (lista fechada):
   - salvar o próprio lançamento (`aplicacao/previsao.ts`, função nova `salvarLancamentoRateio`);
   - salvar a Regra de rateio usada (`aplicacao/regras-rateio.ts: salvarRegra`);
   - salvar os valores de uma Base própria usada pela regra (`salvarValoresDaBase`);
   - alterar atendidos, m² ou vagas de um `CentrosCusto` participante (`aplicacao/analise-area.ts`);
   - alterar a lotação (profissionais) de um serviço participante (`aplicacao/folha.ts`).

   Cada um desses pontos chama uma função nova e única, `recalcularLancamentosAfetados`, que encontra
   os lançamentos atingidos, encerra (`ativo = FALSE`) as despesas geradas anteriores e grava as
   novas — nunca apaga nada, sempre auditado (colunas, nunca valores).
5. **Depois do exercício aprovado:** as despesas geradas ficam congeladas como estão; nenhum dos
   cinco pontos altera uma despesa de exercício aprovado (mesma regra de qualquer despesa aprovada —
   precisaria de remanejamento ou suplementação).

## Consequências

- `aplicacao/regras-rateio.ts`, `aplicacao/analise-area.ts` e `aplicacao/folha.ts` passam a chamar
  uma função do novo arquivo (`aplicacao/lancamentos-rateio.ts`) depois de salvar, para disparar o
  recálculo. O acoplamento fica concentrado numa função só, fácil de testar e de estender se
  aparecer um sexto ponto de gatilho.
- Fora dos cinco pontos listados (por exemplo, um serviço encerrado), o lançamento não recalcula
  sozinho; o Financeiro precisa abrir e salvar o lançamento de novo. Se isso se mostrar insuficiente,
  é uma entrega nova para ampliar a lista.
- O padrão "despesa gerada e travada pelo sistema" (`lancamento_rateio_id`) pode servir de referência
  para outras automações futuras de despesa (ex.: RH da folha, hoje só virtual), mas esta decisão não
  estende isso agora.
