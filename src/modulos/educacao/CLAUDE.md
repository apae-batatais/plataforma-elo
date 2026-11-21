# App Educação — regras para o agente

Leia antes `especificacao.md` desta pasta, a ADR-029 e o `CLAUDE.md` da raiz.

- Escopo: altere apenas `src/modulos/educacao/` e as rotas `src/app/(elo)/educacao/`.
- Armazenamento: abas `Instrumentos`, `Aplicacoes` e `Respostas` em `dados/tabelas.ts`, na planilha própria
  `avaliacao_educacao` (dados sensíveis separados — ADR-011). Do Núcleo, só lê serviços, pessoas e vínculos.
- O cálculo (total, faixa, principal barreira) vem do motor `src/capacidades/motor-avaliacao`; **não** o altere
  aqui. Total, subtotais e faixa nunca são guardados: calculam-se na leitura.
- Os três instrumentos são dados (`dados/instrumentos.ts`). Depois de usado, um instrumento não muda: alterar
  texto cria nova versão (ADR-007).
- "Turma" é o serviço do Núcleo. Só serviços da área Educação entram.
- Aplicação fechada não se edita; correção cria nova aplicação (`corrige`). Nada é apagado.
- Identificação da pessoa por `pessoa_id` do Cadastro Único; nunca mostre nome em painel agregado.
- Permissões: `educacao.<acao>`, declaradas no manifesto.
- Comparativo e ficha (em `aplicacao/avaliacoes.ts`): só concluídas não corrigidas, do mesmo instrumento; o comparativo
  registra `leitura` e a ficha, `exportacao`. Reavaliação: 12 meses após a última assinatura, aviso 30 dias antes.
- Painel (`aplicacao/painel.ts`): só agregados, todo número por `numeroAgregado` (mínimo de 5); cada pessoa uma vez, pela fechada não corrigida mais recente do período; acesso por `educacao.painel` no serviço.
