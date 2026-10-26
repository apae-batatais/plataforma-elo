# ADR-006 · Motor de avaliação como capacidade compartilhada

- Situação: aceita
- Data: 2026-10-25

## Contexto
Seis serviços em três eixos (Assistência Social, Educação, Saúde/CER) usam
instrumentos com a mesma estrutura: domínios, itens, escala Likert 0 a 3 e
códigos CIF.

## Decisão
O motor (instrumentos, ciclos, aplicações, escores) fica em
`src/capacidades/motor-avaliacao/`. Cada eixo tem seu módulo com as regras
próprias (ex.: grau de dependência e enquadramento no SUAS).

## Consequências
- Educação e Saúde/CER reutilizam o motor sem reescrever nada.
- Mudanças no motor afetam todos os eixos e exigem testes de todos eles.
