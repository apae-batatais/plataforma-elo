# ADR-037 — Despesas geradas por rateio (Orçamento)

**Situação:** proposta · **Data:** 21/11/2026 · Proposta #225 · Complementa ADR-020

## Contexto
A Entrega R1 (ADR-020) calcula o rateio dos custos comuns só para mostrar na Análise por área. A
Diretoria quer **gravar** uma despesa por serviço, atualizada sozinha durante a elaboração e travada
depois da aprovação.

## Decisão
1. A despesa da sede fica numa aba própria, `DespesasRateio`; as linhas por serviço ficam em `Despesas`
   com `rateio_origem_id`. Assim o total nunca conta duas vezes e todos os painéis já enxergam as linhas.
2. As linhas geradas têm `regra_rateio_id` vazia, para o cálculo de R1 não ratear de novo.
3. O recálculo é uma função única e idempotente (`sincronizarDespesasRateio`), chamada depois de cada
   gravação que muda uma entrada do cálculo e, como rede de segurança, ao abrir a lista de Despesas e a
   Análise por área. Não há gatilho na planilha: a regra fica na camada de aplicação (ADR-011).
4. Só recalcula com o exercício em elaboração; aprovado ou encerrado, nada muda.
5. Linhas geradas são protegidas na camada de aplicação (editar, excluir, importar); nada é apagado, só encerrado.

## Consequências
- Mudar uma base (ex.: atendidos) grava várias linhas; o custo de leitura e gravação cresce com o número
  de origens e serviços. Aceitável para o porte das OSCs; se pesar, sincronizar só as origens afetadas.
- O recálculo ao abrir uma tela é uma gravação feita numa leitura; fica auditada como `sistema` e só
  acontece quando há diferença.
- Ajuste depois da aprovação passa pelos remanejamentos/suplementações já existentes.
