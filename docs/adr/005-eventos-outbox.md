# ADR-005 · Eventos de domínio via outbox no Postgres

- Situação: aceita
- Data: 2026-10-25

## Contexto
Módulos não se chamam diretamente. Precisam reagir a fatos de outros módulos
(ex.: uma pessoa vinculada a um serviço) sem perder eventos.

## Decisão
O evento é gravado em `core.evento_dominio` (via `core.publicar_evento`) na
mesma transação da operação. Uma rotina agendada (`entregarPendentes`) entrega
cada evento a cada consumidor, em ordem, registrando a entrega em
`core.evento_entrega` na mesma transação do tratamento.

## Alternativa descartada
Serviço de mensageria externo: mais infraestrutura sem ganho neste porte.

## Consequências
- Nenhum evento se perde; uma falha para só aquele consumidor e é retentada.
- Consumidores devem ser idempotentes.
- Um evento é um fato no passado: mudar o formato exige nova versão.
