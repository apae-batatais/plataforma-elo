# Requisições: resumo diário por e-mail (#61, entrega 7)

Especificação: `src/modulos/requisicoes/especificacao.md` (entrega 7, regras 19-21). Base: ADR-027.

1. Aba `ResumosEnviados` (`dados/tabelas.ts`), registrada em `TABELAS_REQUISICOES`.
2. `contagensDoResumo` e `diaSemExpediente` em `aplicacao/requisicoes.ts` (mesmos critérios das telas).
3. `dominio/resumo.ts` (texto fixo) e `aplicacao/resumo.ts` (`rodarResumoDiario`).
4. Tarefa `requisicoes.resumo_diario` na rotina (`src/plataforma/resumo-requisicoes.ts`).
5. Testes (`testes/resumo.test.ts`), Ajuda, verificação e PR.
