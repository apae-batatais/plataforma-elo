# Plano — Orçamento R1: regras de rateio dos custos comuns (issue #91)

Especificação: `src/modulos/orcamento/especificacao.md` (revisão 5), ADR-020. Esta entrega é só a **R1**;
R2 (Parcerias), R3 e R4 dependem uma da outra e ficam para entregas seguintes.

1. Domínio puro `dominio/rateio-custos.ts` (bases, dois níveis, ordem comuns → apoio → administrativo) + testes.
2. Abas `RegrasRateio`, `RegrasRateioParticipantes`, `BasesRateio`, `BasesRateioValores`; colunas `regra_rateio_id` (GruposGasto, Despesas, CentrosCusto) e `vagas` (CentrosCusto).
3. Casos de uso `aplicacao/regras-rateio.ts` (regras, bases, valores, prévia) + testes de acesso.
4. Ligação com a Análise por área (`painelPorArea`): coluna R "por regra" e avisos.
5. Telas: Regras de rateio, Bases próprias; campo de regra em Grupo, Item e Centro de custo.
6. `npm run verificar` e `npm run build`.
