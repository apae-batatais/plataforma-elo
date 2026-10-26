# ADR-002 · App Next.js único, módulos em pastas

- Situação: aceita
- Data: 2026-10-25

## Contexto
Um monorepo com vários pacotes (pnpm workspaces, Turborepo) dá fronteiras
físicas, mas adiciona configuração que a Diretoria teria de manter.

## Decisão
Um único projeto Next.js. Cada módulo é uma pasta em `src/modulos/<id>/`.
As fronteiras são garantidas pelo dependency-cruiser (`.dependency-cruiser.cjs`).

## Consequências
- Menos configuração e um só `package.json`.
- A regra "módulo não importa módulo" depende do lint rodar no GitHub a cada
  mudança; o workflow de CI bloqueia o Pull Request se ela for violada.
