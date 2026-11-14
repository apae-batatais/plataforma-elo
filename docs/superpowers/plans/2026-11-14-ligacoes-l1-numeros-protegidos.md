# Plano — Ligações onda 2, entrega L1 (números de pessoas protegidos)

Issue #116; especificação em `src/modulos/projetos/especificacao.md` ("Ligações, onda 2"), ADR-023.
Só a L1 pode ser construída agora: L2 a L5 dependem das entregas P2 a P5 do app Projetos.

1. Núcleo: `numeroAgregado` (mínimo de 5) e `vinculosAtivosProtegido`.
2. Avaliação: `indicadoresDoServico` (índice médio e % de reavaliação em dia).
3. Parcerias: coluna `fonte_numero` em `Metas`, `definirFonteDaMeta`, "hoje" da meta e interface `NumerosDePessoas`.
4. Plataforma: `numerosDePessoas` liga a Avaliação a Parcerias.
5. Tela da ficha do termo: "Hoje", etiqueta "Calculado do cadastro" e escolha da fonte.
6. Testes, `npm run verificar`, `npm run build` e PR.
