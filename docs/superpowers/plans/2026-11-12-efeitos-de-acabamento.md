# Plano — Efeitos de acabamento (#109)

Especificação: `docs/especificacao-plataforma.md`, seção "Efeitos de acabamento (proposta #109)".

1. Peças (`src/ui/contagem.ts`, `numero-que-conta.tsx`, `pisca-regras.ts`, `pisca-onde-mudou.tsx`) e CSS (`anel-pulsante`, `cartao-brilho`, pisca) com testes em `tests/ui/efeitos.test.ts`.
2. Tela inicial: anel e brilho; leitura da pendência vencida em `src/plataforma/pendencias-vencidas.ts` (teste em `tests/nucleo/pendencias-vencidas.test.ts`).
3. Números que contam nos painéis e cartões de topo de todos os apps.
4. Brilho nos cartões clicáveis.
5. Pisca onde mudou: `TabelaDados`, linhas de registro e cartões com `chave`.
6. Documentação (habilidade `telas`), `verificar`, `build` e PR.
