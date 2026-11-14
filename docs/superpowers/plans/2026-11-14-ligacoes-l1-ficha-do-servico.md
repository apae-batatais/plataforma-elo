# Plano — Ligações entre apps, entrega L1 (Ficha do serviço)

Proposta #115, especificação `docs/especificacao-ligacoes-entre-apps.md` (PR #122). Esta entrega faz só a **L1**;
L2 a L6 seguem a ordem da especificação em entregas próprias.

## Tarefas

1. Tipo `Ligacao<T>` no Núcleo (`src/nucleo/ligacoes/ligacao.ts`) e permissão `plataforma.servicos.ver` nos perfis.
2. Visão de ligação em cada app (só leitura, com a permissão do app dono): Orçamento (`custoDoServico`),
   Projetos (`projetosDoServico`), Requisições (`requisicoesDoServico`), Comunicação (`publicacoesDoServico`, com a
   coluna opcional `servico` em `Pedidos`) e Avaliação (`avaliacaoDoServico`).
3. Composição em `src/plataforma/ligacoes.ts` (`lerLigacao`, `fichaDoServico`, `servicosVisiveis`).
4. Telas `/servicos` e `/servicos/<codigo>` e item "Fichas de serviço" no menu.
5. Testes (quem abre, permissão de cada app, app desligado, erro, nenhum dado pessoal), `npm run verificar` e `npm run build`.
6. Revisão de usabilidade e PR "Entrega #115".
