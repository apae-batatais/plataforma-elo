# Módulo <nome> — regras para o agente

Leia antes `especificacao.md` desta pasta e o `CLAUDE.md` da raiz.

- Escopo: altere apenas `src/modulos/<id>/` e as rotas `src/app/<rota>/`.
- Armazenamento: as abas do módulo são declaradas com `definirTabela` em
  `dados/tabelas.ts`, na planilha `<chave>` do catálogo `PLANILHAS`. Não leia
  nem grave abas de outros módulos; use os casos de uso do Núcleo.
- Pastas: `dominio/` regras puras; `aplicacao/` casos de uso (sempre com
  `Autorizador` e `registrarAuditoria`); `dados/` tabelas; `telas/`; `testes/`.
- Dados sensíveis deste módulo: <listar colunas e o nível de sigilo>.
- Permissões: `<id>.<recurso>.<acao>`, declaradas no manifesto.
