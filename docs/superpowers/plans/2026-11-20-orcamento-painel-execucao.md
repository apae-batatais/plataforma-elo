# Plano: Orçamento 1C.2, Painel de execução e Recursos livres (#185)

Especificação: `src/modulos/orcamento/especificacao-execucao-tesouraria.md`, seção "Entrega 1C.2". Uma entrega só.

1. Dados: coluna `fonte_termo_id` em `Realizado`; gravação e grade com "Termo adiantado".
2. Regras puras (`dominio/execucao.ts`): período, execução %, baixa de adiantamentos, dias, comparação.
3. Casos de uso (`aplicacao/execucao.ts`): `lerPainelExecucao` e `lerRecursosLivres`, com escopo antes de somar.
4. Telas: `/orcamento/execucao/painel` e `/orcamento/execucao/recursos-livres`; menu; links nas telas vizinhas.
5. Demonstração: `popularRealizadoFicticio`.
6. Testes, `npm run verificar`, `npm run build`, PR.
