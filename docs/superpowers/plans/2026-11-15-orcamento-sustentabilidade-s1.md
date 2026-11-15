# Plano — Painel de sustentabilidade financeira, S1 (#131)

Fonte: `src/modulos/orcamento/especificacao-sustentabilidade.md` (entrega S1: cobertura dos serviços e peso do aporte).

1. Dados: coluna `origem` em `CentrosCusto`, aba `LimitesSustentabilidade`, permissão `orcamento.sustentabilidade.ver`.
2. Parcerias: `termosParaOrcamento` passa a trazer vagas por serviço e se a unidade é pessoa.
3. Regras puras (`dominio/sustentabilidade.ts`) e casos de uso (`aplicacao/sustentabilidade.ts`), com testes de quem vê e quem altera.
4. Plataforma: `catalogoDeParcerias` entrega os termos ao Orçamento.
5. Telas: painel `/orcamento/sustentabilidade`, Cadastros › Limites do painel, janela "Alterar origem".
6. Verificar (`npm run verificar`, `npm run build`), PR de entrega.

Fora desta entrega: visão "com cedidos" (depende da C2, PR #154 ainda aberto), blocos 2 a 5 (S2 a S4).
