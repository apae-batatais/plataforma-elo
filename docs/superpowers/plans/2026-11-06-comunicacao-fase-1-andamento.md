# Andamento — Comunicação (fase 1)

Registro de execução do plano `docs/superpowers/plans/2026-11-06-comunicacao-fase-1.md`.
Atualizado em 06/11/2026, 21h, ao fim da Entrega 2.
Especificação (aprovada em 06/11/2026): `src/modulos/comunicacao/especificacao.md`.

## Como retomar (para o agente)

1. Leia, nesta ordem: o `CLAUDE.md` da raiz, a especificação, o plano e este arquivo.
2. **Tarefas concluídas** (não refazer): 1 a 4 (Entrega 1, PR #40, ramo `feat/comunicacao-base`) e 5 a 7 (Entrega 2, ramo `feat/comunicacao-pedidos`, criado a partir de `feat/comunicacao-base`).
3. **Próxima:** Tarefa 8 (Entrega 3, ramo `feat/comunicacao-anexos`), só depois de a Diretoria conferir a Entrega 2.
   - Crie o ramo a partir da `main` se os PRs das Entregas 1 e 2 já tiverem ido para ela; senão, a partir de `feat/comunicacao-pedidos`.
4. **Método escolhido pela Diretoria:** um agente por tarefa, com revisão independente depois de cada uma (skill superpowers:subagent-driven-development).
   - Há uma revisão final de todo o ramo antes de cada PR, uma entrega por vez.
   - Ao fim de cada entrega, pare para a Diretoria conferir a prévia.
   - Recrie o registro de trabalho da skill (`.superpowers/sdd/2026-11-06-comunicacao-fase-1/progress.md`, ignorado pelo Git) a partir deste arquivo, e atualize este arquivo ao fim de cada entrega.
5. **No plano, os títulos são "Tarefa N".** O script `task-brief` da skill procura "Task N"; extraia o trecho da tarefa à mão, junto com a seção "Restrições globais".

## Situação das tarefas

| Tarefa | Situação | Commits |
| --- | --- | --- |
| 1 · Regras do pedido | concluída, revisão limpa | bc71bff |
| 2 · Dias úteis, urgência e calendário | concluída, revisão limpa | b427a2a |
| 3 · Abas, manifesto e registro | concluída, revisão limpa | 91ec5f8 |
| 4 · Calendário, antecedência e cor | concluída após 1 rodada de correção | 361e4a5, 29ddcf3, 23b9342, 8d18098 |
| Revisão final da Entrega 1 | concluída após 1 rodada de correção | bd3b604 |
| PR #40 | aberto, aguardando a Diretoria | prévia: https://pr-40--plataforma-elo.netlify.app |
| 5 · Enviar, ajustar e cancelar | concluída após 1 rodada de correção | a21bb92, d480d03 |
| 6 · Revisão, juntar e aprovação | concluída após 1 rodada de correção | 2c659a5, b1b1700 |
| 7 · Avisos no início e no menu | concluída, revisão limpa | 0d02b27 |
| Revisão final da Entrega 2 | concluída após 1 rodada de correção e 1 ajuste pontual | 1dbd3de, 1fe2a99 |
| Conferência no navegador (build de produção, demonstração) | enviar (urgente) → começar revisão → enviar para aprovação → aprovar; todas as telas abrem com os três perfis | — |
| 8 a 11 | a fazer | — |

## Decisões tomadas durante a execução

1. **Revisão final por entrega,** antes de cada PR, e não só no fim do plano. *Custo se errado:* uma revisão a mais por entrega.
2. **Abrir o PR de cada entrega** está autorizado pelo plano aprovado. Merge e publicação só depois do "aprovado" da Diretoria.
3. **`tests/nucleo/conferir-estrutura.test.ts`:** a lista de planilhas em memória ganhou `comunicacao`. A mudança é necessária para a verificação passar e não altera nenhuma regra.
4. **Arquivos comuns alterados na Tarefa 4:**
   - os nomes da planilha "Comunicação" em `src/app/(rede)/rede/planilhas.ts` e `src/app/(elo)/admin/estrutura/page.tsx`;
   - dois usuários fictícios em `src/nucleo/estrutura/dados-ficticios.ts` (`comunicacao@exemplo.local` e `coord.comunicacao@exemplo.local`), como foi feito para o Almoxarifado;
   - o ícone do cartão em `src/app/(elo)/page.tsx`;
   - a contagem de usuários da demonstração (89 para 91) em `tests/nucleo/estrutura-demonstracao.test.ts`.
5. **Menu da Entrega 1:** Novo pedido, Pedidos, Indicadores e Contatos saíram do manifesto até as suas telas existirem. **Cada tarefa que cria uma dessas telas precisa recolocar o item no menu**:
   - Novo pedido: Tarefa 5;
   - Pedidos: Tarefa 6;
   - Contatos da imprensa: Tarefa 9;
   - Indicadores: Tarefa 11.
6. **Formulário do calendário:** "Fim do período" só aparece quando o tema é um período. Período sem fim recebe a mensagem "Informe o fim do período."
7. **Aviso sem planilha:** quem não administra vê só "A Comunicação ainda não está disponível. Fale com a administração da sua instituição." As instruções técnicas aparecem apenas para quem tem `core.organizacao.gerenciar`.
8. **Antecedência mínima:** é gravada com a versão que a pessoa viu, e duas gravações ao mesmo tempo dão aviso de conflito. Na leitura, valores fora de 0 a 30 são ignorados e vale o padrão 5.
9. **Publicar a Entrega 1 para a equipe** é decisão da Diretoria no PR #40. O roteiro de implantação está no PR.

10. **Entrega 2 (06/11/2026):**
    - O rodapé dos commits usa a sessão atual do Claude Code, não a do plano.
    - A versão lida é conferida antes das regras de situação: versão diferente dá `ErroConflito`.
    - No Ajustar, a confirmação de imagem começa desmarcada e é pedida de novo a cada envio com link de vídeo; o Elo guarda a confirmação mais recente.
    - Regra 5: na revisão, a Comunicação também cria um tema novo no calendário (só data exata) e liga o pedido a ele.
    - Anexos editáveis na revisão (regra 3) ficam para a Tarefa 8.
    - Revisar e decidir só aceitam as próprias ações, conferidas no servidor ("Ação inválida." para o resto).
    - `agendado_para` é gravado em ISO UTC e lido no dia de Brasília. **A Tarefa 10 precisa gravar nesse formato.**
    - O número do menu não inclui "para publicar hoje". Rever na Tarefa 10.
    - No `next dev` local, o detalhe de pedido da demonstração pode dar 404, porque cada rota monta a própria memória. No build de produção (prévia) funciona.

## Pendências pequenas (para as próximas tarefas)

**Da Entrega 2 (podem esperar):**
- reenviar e cancelar não conferem `comunicacao.solicitar`, só o dono;
- o número COM e o destino do juntar podem ter corrida em envios simultâneos (comentado no código);
- faltam testes de cancelar devolvido e de reenviar com versão antiga;
- `EstadoPedido` está declarado duas vezes; o detalhe chama `opcoesDoPedido` só para o nome da área;
- a auditoria no destino do juntar é "alteração" sem colunas;
- os avisos usam ícone e cor de aviso, não os do app; o aviso de urgentes abre a fila sem filtro de urgentes;
- um `agendado_para` malformado esconde todos os avisos da pessoa (guarda na Tarefa 10);
- o histórico não mostra quem fez cada ação.


**Na Tarefa 5:**
- validar o formato de `data_desejada` antes das funções de data, porque datas malformadas fazem `prazos.ts` lançar `RangeError`.

**Na Tarefa 6:**
- completar a matriz de transições inválidas;
- fazer o teste "situações finais não têm saída" conferir de fato que nenhuma ação sai delas.

**Quando alguém mexer no arquivo:**
- o `aria-live` do título do mês não tem efeito;
- o layout não confere a aba Parametros;
- `ficticios.ts` importa de `aplicacao/configuracoes`. Fica dentro do módulo, mas inverte as camadas.

**Comportamento conhecido, deixado como está:**
- depois de um erro ao salvar, a janela de edição reabre vazia, como no Requisições;
- a data de fim digitada se perde ao alternar entre Período e Data exata;
- se outra pessoa criar a antecedência entre a leitura e a gravação, a mensagem é "Abra a página de novo para salvar."
