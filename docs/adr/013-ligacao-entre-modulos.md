# ADR-013 — Ligação entre módulos pela plataforma

- Situação: aceita (31/10/2026)

## Contexto
A requisição precisa indicar um grupo de despesa do Orçamento. A regra 3 do projeto diz que um
módulo nunca importa outro (`npm run fronteiras` verifica), para que cada app possa mudar,
ser desligado ou trocado sem quebrar os demais.

## Decisão
- O módulo que precisa de algo declara uma interface pequena do que precisa (ex.:
  `CatalogoOrcamento { gruposDeGasto() }` em Requisições).
- O módulo que oferece expõe, no seu `index.ts`, uma função de leitura simples e sem permissão
  própria, só com nomes de cadastro (ex.: `gruposDeGastoAtivos` no Orçamento). Nada de valores
  ou dados pessoais.
- A plataforma (`src/plataforma/catalogos.ts`) liga os dois e entrega a interface aos casos de uso.
- Os casos de uso guardam uma cópia do que usaram (ex.: id e nome do grupo), para o registro
  continuar legível se o cadastro de origem mudar.

## Consequências
- Requisições funciona e é testado com um catálogo falso, sem o Orçamento.
- Se o Orçamento for desligado, basta a plataforma entregar um catálogo vazio: a ficha avisa que não há grupos cadastrados.
- Novas ligações seguem o mesmo caminho; eventos (ADR-005) ficam para quando houver efeitos em cadeia.
