# ADR-001 · Monólito modular

- Situação: aceita
- Data: 2026-10-25

## Contexto
A plataforma é desenvolvida e mantida apenas pela Diretoria, com o Claude Code
como agente desenvolvedor. Vai abrigar vários apps (um por departamento).

## Decisão
Um único app e um único banco, divididos em módulos com fronteiras rígidas:
cada módulo tem schema próprio, não importa outro módulo e se comunica por
eventos de domínio ou pela interface do Núcleo.

## Alternativa descartada
Microsserviços: exigiriam infraestrutura, observabilidade e integração que uma
equipe de uma pessoa não sustenta.

## Consequências
- Um deploy, um banco, custo baixo.
- As fronteiras são verificadas por `npm run fronteiras` e pelos testes.
- Se um módulo crescer muito, as fronteiras permitem extraí-lo depois.
