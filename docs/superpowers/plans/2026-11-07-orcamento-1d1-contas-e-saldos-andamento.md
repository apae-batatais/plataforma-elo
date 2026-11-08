# Andamento — Orçamento 1D.1 (Contas e saldos)

Registro de execução do plano `docs/superpowers/plans/2026-11-07-orcamento-1d1-contas-e-saldos.md`.
Atualizado em 08/11/2026, ao fim da entrega. Plano aprovado pela Diretoria em 07/11/2026.

## Como retomar (para o agente)

1. Leia o `CLAUDE.md` da raiz, o `CLAUDE.md` do módulo, a especificação, o plano e este arquivo.
2. **Tarefas concluídas** (não refazer): 1 a 5, no ramo `feat/orcamento-tesouraria-contas`.
3. **Próximo:** conferência da Diretoria na prévia do PR; depois, plano da Entrega 1E (Histórico).
4. Método: um agente por tarefa, com revisão independente depois de cada uma e revisão final do ramo.

## Situação das tarefas

| Tarefa | Situação | Commits |
| --- | --- | --- |
| 1 · Regras puras | concluída, revisão limpa | 9525ac5 |
| 2 · Planilha, abas, permissões e fictícios | concluída, revisão limpa | 536d3a5 |
| 3 · Cadastro de contas | concluída, revisão limpa | ae633ee |
| 4 · Saldos do mês e ajustes | concluída após 1 rodada de correção (gravação em bloco, conta repetida) | bd86b60, 4182b13 |
| 5 · Telas | concluída após 2 rodadas de correção (digitação preservada entre recargas, sem sobrescrever valor de outra pessoa) | 65e1899, 0f04e84, bdb144c |
| Revisão final do ramo | pronto depois de 1 correção (escolha do mês em lista) | 6f720d8 |
| Conferência no navegador (build de produção, demonstração) | Financeiro cadastra conta vinculada, informa saldo, inclui e tira ajuste, pendência cai, totais mudam; Diretoria só vê; Coordenação e Leitura não veem a Tesouraria; 390 px sem rolagem lateral | — |

## Decisões tomadas durante a execução

As decisões de regra estão na especificação, em "Decisões da construção da 1D.1". Decisões técnicas:

1. As listas de planilhas em memória dos testes do Orçamento ganharam `orcamento_execucao`.
2. Componentes novos dentro do módulo: `telas/campos-conta.tsx` (o campo Fonte só aparece para Vinculada) e `telas/seletor-mes.tsx`.
3. Gravação dos saldos com `atualizarVarios` e `inserirRegistros`, depois de reconferir a planilha. A janela de milissegundos entre conferir e gravar é a aceita pela ADR-011.
4. O rascunho da tela de saldos fica no `sessionStorage` (chave `elo:orcamento:saldos:<mes>`), só com os campos editados e o valor gravado em que cada um se baseou.

## Pendências pequenas (podem esperar)

- Conta excluída com ajuste ativo e sem saldo no mês não aparece nas linhas, mas entra no total do servidor: o total da tela pode diferir do total do mês seguinte (coluna "mês anterior").
- A mensagem de conflito ao salvar diz "Recarregue a página e refaça a alteração", mas a tela já recarregou e guardou o digitado.
- O aviso "alterado por outra pessoa" fica na aba até a pessoa editar ou salvar.
- A lógica do rascunho não tem teste automatizado (só conferência no navegador): extrair funções puras e testar.
- As pendências do topo listam os nomes das contas, sem atalho para o campo.
- Pequenos: comentário errado em `dados/ficticios.ts` ("Aplicação Fictícia B"); "R$" aceito em qualquer posição; testes que travariam "1234.56" como inválido; excluir conta já excluída diz "Conta não encontrada."; a unidade da conta não é conferida com o Núcleo; o layout confere só a aba Contas.
