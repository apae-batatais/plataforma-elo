# Andamento — Ligações L2 (requisição ↔ serviço e projeto, com saldo)

Issue #144; especificação em `docs/especificacao-ligacoes-entre-apps.md` ("Construção de L2 a L6").

- [x] Orçamento: leitura `saldoParaConferencia` (serviço, grupo, estados sem permissão e sem exercício aprovado)
- [x] Projetos: `aceitaCompra` e `projetosParaCompra` (lista vazia até a etapa de implementação existir)
- [x] Requisições: colunas novas, ligação com projeto conferida no servidor, valor estimado e grupo (quem aprova), valor gasto (quem atende), `comprasDoProjeto`
- [x] Plataforma: `projetosParaRequisicao`, `conferenciaDosCentros`, `grupoDeGastoConferido`
- [x] Telas: campos de projeto e atividade, cartão "Conferência do orçamento", valor gasto
- [x] Testes e verificação
- [ ] L3 a L6: PRs próprios (L3 independente; L4 a L6 esperam Projetos P2 a P5 e Orçamento R3 na `main`)
