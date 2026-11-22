# Plano — Requisições: agendamento de veículos, entrega 3 de 3 (#229)

Especificação: `src/modulos/requisicoes/especificacao.md`, seção "Agendamento de veículos institucionais" (regra 10 e tela 3).

Entrega 3: fechamento ("Confirmar uso"), quilometragem e aba `VeiculoUsos`.

1. Aba `VeiculoUsos` e regras puras do fechamento (`dominio/veiculo.ts`).
2. Caso de uso `fecharVeiculo`, ação `fechar` no pedido aprovado, lista "para confirmar uso", contador e detalhe com o uso.
3. Testes (quem fecha, quando, validações, auditoria, aba).
4. Telas: formulário "Confirmar uso" na ficha, seção em "Pedidos de veículo", aviso na tela inicial, Ajuda.
5. Dados fictícios, especificação e CLAUDE.md do módulo.
6. Verificar, build e PR "(3 de 3)".
