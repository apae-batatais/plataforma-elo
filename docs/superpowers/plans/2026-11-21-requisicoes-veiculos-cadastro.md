# Plano — Requisições: agendamento de veículos, entrega 1 de 3 (#229)

Especificação: `src/modulos/requisicoes/especificacao.md`, seção "Agendamento de veículos institucionais".

Entrega 1: cadastro de veículos e manutenção preventiva.

1. Abas `Veiculos` e `VeiculoManutencoes` (`definirTabela`), registradas para "Preparar estrutura".
2. Permissão `requisicoes.veiculos.cadastrar` (Administração da plataforma) e item de menu "Veículos".
3. Regras puras em `dominio/veiculo.ts` (placa, capacidade, disponibilidade por manutenção) com teste.
4. Casos de uso em `aplicacao/veiculos.ts`: listar, salvar, desativar/reativar, definir manutenção prevista, marcar feita.
5. Tela `/requisicoes/veiculos`, ações, Ajuda, dados fictícios.
6. Verificar, build, PR "(1 de 3)".

Entregas seguintes (2: pedido e aprovação; 3: fechamento) não fazem parte deste plano.
