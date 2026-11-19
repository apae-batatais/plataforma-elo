# Auditoria completa na leitura de anexos (issue #66, ADR-033) — plano e andamento

- [x] Núcleo: `src/nucleo/armazenamento/leitura-de-anexo.ts` (faixa, 416, auditoria com `faixa`) e teste em `tests/nucleo/leitura-de-anexo.test.ts`.
- [x] Requisições e Comunicação: `lerAnexo` e `lerAnexoComunicacao` usam a função do Núcleo; testes atualizados.
- [x] Rotas: 416 para faixa inválida; 502 com texto fixo e detalhe só no `console.error`.
- [x] `npm run verificar` e `npm run build` verdes.
