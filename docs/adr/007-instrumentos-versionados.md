# ADR-007 · Instrumentos de avaliação versionados e imutáveis após uso

- Situação: aceita
- Data: 2026-10-25

## Contexto
A evolução de cada atendido é medida comparando ciclos. Se um item mudar,
as aplicações antigas deixam de ser comparáveis.

## Decisão
Depois da primeira aplicação, um instrumento não muda. Qualquer alteração
gera uma nova versão. Aplicações concluídas também não são editadas:
correções geram uma nova aplicação ligada à anterior.

## Consequências
- Comparações entre ciclos continuam válidas.
- Relatórios precisam indicar a versão do instrumento usada.
