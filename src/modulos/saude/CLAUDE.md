# Módulo Saúde — regras para o agente

Leia antes `especificacao.md` desta pasta, a ADR-030 e o `CLAUDE.md` da raiz.

- Escopo: altere apenas `src/modulos/saude/` e as rotas `src/app/(elo)/saude/`.
- Nunca importe outro módulo (Avaliação, Educação…). O motor vem de `@/capacidades/motor-avaliacao`.
- Armazenamento: abas `Instrumentos`, `Aplicacoes` e `Respostas` em `dados/tabelas.ts`, na planilha
  própria `avaliacao_saude` (dados sensíveis separados — ADR-011).
- O instrumento do CER é **dado** (`dominio/cer.ts`, versão 1). Depois de usado não muda: alterar cria nova versão.
- Total, subtotais, faixa e principal barreira são calculados na leitura pelo motor; nunca guardados.
- Pastas: `dominio/` regras puras; `aplicacao/` casos de uso (sempre com `Autorizador` e
  `registrarAuditoria`); `dados/`; `telas/`; `testes/`.
- Aplicação fechada não se edita: a correção cria nova aplicação (`corrige`). Nada é apagado.
- Auditoria: colunas alteradas, nunca valores; `leitura` ao abrir uma aplicação.
- Permissões: `saude.<acao>`, declaradas no manifesto (`saude.ciente` só Diretoria e coordenação).
- Sem nome próprio de instituição, unidade ou cidade em tela, dado fictício ou comentário.
- Comparativo (`aplicacao/comparativo.ts`): só fechadas não corrigidas; registra `leitura`. A ficha registra `exportacao`.
- Reavaliação: 12 meses após a última assinatura; "vence em breve" 30 dias antes (`situacaoDaReavaliacao`).
- Painel (`aplicacao/painel.ts`): só agregados, todo número por `numeroAgregado` (mínimo de 5); cada pessoa uma vez, pela fechada não corrigida mais recente do período; acesso por `saude.painel` no serviço.

## Tela Instrumentos (proposta #223)

`/saude/instrumentos` mostra uma linha, o CER na versão em uso (`instrumentosDoCer().atual`). Exige `saude.avaliar`; sem ela vai para "Sobre o instrumento".
