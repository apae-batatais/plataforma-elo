# Andamento — Comunicação (fase 1)

Registro de execução do plano `docs/superpowers/plans/2026-11-06-comunicacao-fase-1.md`.
Atualizado em 06/11/2026, 20h, na migração para o Claude Code na web.
Especificação (aprovada em 06/11/2026): `src/modulos/comunicacao/especificacao.md`.

## Como retomar (para o agente)

1. Leia, nesta ordem: o `CLAUDE.md` da raiz, a especificação, o plano e este arquivo.
2. **Tarefas concluídas** (não refazer): 1, 2, 3 e 4, ou seja, toda a Entrega 1, que está no PR #40 (ramo `feat/comunicacao-base`).
3. **Próxima:** Tarefa 5 (Entrega 2, ramo `feat/comunicacao-pedidos`).
   - Se o PR #40 já tiver ido para a `main`, crie o ramo a partir da `main`.
   - Se ainda não tiver ido, crie a partir de `feat/comunicacao-base`.
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
| 5 a 11 | a fazer | — |

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

## Pendências pequenas (para as próximas tarefas)

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
