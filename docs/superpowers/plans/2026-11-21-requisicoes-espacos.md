# Plano: Requisições, agendamento de espaços (#230)

Base: ramo da entrega #228 (ficha própria por tipo, PR #252), porque a especificação manda construir depois dela.

1. Domínio (`dominio/espaco.ts`) e testes: campos, horário, conflito, indisponibilidade, fechamento.
2. Dados: abas `Espacos` e `EspacoIndisponibilidades`; ficha `espaco` em `FORMULARIOS`; perfil Espaços e permissão `requisicoes.espacos.decidir`; dados fictícios.
3. Aplicação: pedir/reenviar com conferência, quem decide, conflito, fechar reserva, cadastro de espaços e períodos; testes de quem vê e quem decide.
4. Telas: `FichaEspaco`, ficha da requisição (conflitos, fechar), fila do Espaços, cadastro, Ajuda.
5. Verificar, revisão de usabilidade, PR.
