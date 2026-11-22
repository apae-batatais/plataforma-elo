# Plano — Requisições: agendamento de veículos, entrega 2 de 3 (#229)

Especificação: `src/modulos/requisicoes/especificacao.md`, seção "Agendamento de veículos institucionais".

Entrega 2: pedido e aprovação (perfil Transporte, ficha, conflito, aviso de manutenção, aprovar/devolver/recusar/cancelar reserva, agenda).

1. Regras puras em `dominio/veiculo.ts` (detalhes do pedido, cruzamento de períodos, conflito) e tipo `veiculo` em `FORMULARIOS`.
2. Perfil `transporte`, permissão `requisicoes.veiculos.operar`, menu.
3. Casos de uso em `aplicacao/requisicoes.ts`: pedir/reenviar, quem decide, conflito, manutenção, cancelar reserva aprovada, listas, detalhe, agenda.
4. Testes (quem vê, quem altera, conflito, manutenção).
5. Telas: `FichaVeiculo`, página do pedido, "Pedidos de veículo", agenda, ações, Ajuda, dados fictícios.
6. Verificar, build e PR "(2 de 3)".

Entrega 3 (fechamento, `VeiculoUsos`) fica fora deste plano.
