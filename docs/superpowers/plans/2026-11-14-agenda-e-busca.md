# Plano — Agenda única e busca única (#117, entregas H1 e I1)

Especificação: `docs/especificacao-agenda-e-busca.md` · ADR-024.

1. Formato comum no Núcleo (`src/nucleo/modulos/agenda-busca.ts`) e busca de pessoas com auditoria (`src/nucleo/pessoas/busca.ts`).
2. Funções `itensDaAgenda` e `buscar` nos apps: Parcerias, Projetos, Comunicação, Requisições; Avaliação só na agenda. Prazo de requisição vira dia limite (`diaLimite`).
3. Composição da plataforma (`src/plataforma/agenda.ts`, `busca.ts`, `fontes-agenda-busca.ts`).
4. Telas: `/agenda` (lista e mês), `/busca`, campo na barra do topo, item "Agenda" no menu, `GradeDoMes`, ícones.
5. Testes (`tests/plataforma/agenda-e-busca.test.ts`).
6. Verificar, build, revisão de usabilidade e PR.
