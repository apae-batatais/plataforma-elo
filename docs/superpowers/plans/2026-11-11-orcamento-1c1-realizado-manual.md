# Plano — Orçamento 1C.1: realizado informado à mão (issue #59)

Especificação: `src/modulos/orcamento/especificacao-execucao-tesouraria.md`, seção "Revisão de 10/11/2026".

1. Aba `Realizado` (planilha `orcamento_execucao`) e permissões `orcamento.execucao.ver` e `orcamento.realizado.editar`.
2. Domínio puro `dominio/realizado.ts` (R1 a R7, R11 a R13) + testes.
3. Casos de uso `aplicacao/realizado.ts`: grade do mês, salvar o mês (tudo ou nada), realizado do ano, pendência.
4. R13: a importação do Histórico recusa ano que já tem realizado.
5. Telas: Execução › Informar realizado, Execução › Realizado do ano, aviso na tela inicial.
6. `npm run verificar` e `npm run build`.
