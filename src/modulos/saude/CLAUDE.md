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
