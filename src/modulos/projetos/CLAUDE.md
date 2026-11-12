# Módulo Projetos — regras para o agente

Leia antes `especificacao.md` desta pasta, a ADR-021 e o `CLAUDE.md` da raiz.

- Escopo: altere apenas `src/modulos/projetos/` e as rotas `src/app/(elo)/projetos/`.
- Armazenamento: abas declaradas com `definirTabela` em `dados/tabelas.ts`, na planilha `projetos`.
- Pastas: `dominio/` regras puras (etapas, portas, alçada); `aplicacao/` casos de uso (sempre com `Autorizador`
  e `registrarAuditoria`); `dados/` tabelas e demonstração; `telas/`; `testes/`.
- Dados sensíveis: nenhum dado pessoal de atendido. E-mails (proponente, responsável, pareceristas) são de uso interno.
- O texto de um parecer nunca vai para o histórico nem para a auditoria; só quem pode ver pareceres o lê.
- Pareceristas e decisores de alçada são **designados por e-mail** em `ConfigProjetos` (ADR-021); a permissão abre a
  ação e o caso de uso confere a designação.
- Permissões: `projetos.<ação>`, no manifesto.
- Situação: entrega **P1 (base)** pronta. Faltam P2 a P7 (fases, mudanças, encerramento, carteira, ligações).
  `projetos.carteira` e `ProjetoEquipe` entram com as entregas que os usam.
