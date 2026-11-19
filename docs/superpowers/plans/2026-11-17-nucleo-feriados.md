# Plano: feriados no Núcleo (#67)

Especificação: `docs/especificacao-feriados.md` · ADR-034 · Ramo: `feat/plataforma-feriados`

1. Núcleo: aba `Feriados`, permissão `core.feriados.gerenciar`, regras puras (`src/nucleo/feriados/calendario.ts`, movidas da Requisições) e casos de uso (`feriados.ts`).
2. Migração em "Preparar estrutura": `feriadosAntigos` em `EstruturaDosModulos`, passado pela composição (`lerFeriadosAntigos` da Requisições).
3. Requisições: SLA lê `Feriados` do Núcleo; sai o cadastro; seção de Tipos vira aviso com link.
4. Comunicação: `somarDiasUteis`, `diasUteisEntre`, `ehUrgente` recebem os feriados; envio, formulário e indicadores usam a lista do Núcleo.
5. Tela Administração › Feriados e item de menu.
6. Testes, `npm run verificar` e `npm run build`.
