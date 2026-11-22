# Ajuda em dia e manual em PDF: entrega 1 (estrutura) — proposta #232

Especificação: `docs/especificacao-plataforma.md` ("Ajuda em dia e manual em PDF"), ADR-040.

1. Extrair os assuntos da Ajuda para `src/app/(elo)/ajuda/assuntos.tsx` (`montarAssuntos`, `calcularPode`, `permissoes`, "Para:").
2. Página `/ajuda/manual` (capa, índice, todos os assuntos, "Onde fica" em texto) e botão de impressão.
3. Botão da Ajuda aponta para o manual; `public/manual/manual-elo.pdf` removido.
4. Teste `tests/plataforma/ajuda-manual.test.ts` (regras 1 a 4 e 6); vitest passa a entender `.tsx`.
5. Documentos (README do manual, ADR-040), verificar e build, PR.
