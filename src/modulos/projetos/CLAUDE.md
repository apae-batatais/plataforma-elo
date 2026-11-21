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
- Situação: entregas **P1 (base)**, **P2 (fases 1 e 2)** e **P3 (fase 3: atividades e orçamento do projeto, porta 3 e início da implementação)**
  prontas. Faltam P4 a P7 (mudanças e relatórios, encerramento, carteira, ligações). `projetos.carteira` entra com a P6.
- Fase 3 (`aplicacao/planejamento.ts`, `dominio/planejamento.ts`): `Atividades` (atrasada é calculada, nunca gravada) e `ProjetoOrcamento`
  (só o plano do projeto; nada vai ao Orçamento da instituição). Atividades mudam na fase 3 e na implementação; o orçamento só na fase 3.
  A equipe vê as atividades, não o orçamento. Porta 3 (`plano`) só no porte completo; o enxuto usa `iniciarImplementacao`. A etapa
  `implementacao` existe; P4 constrói sobre ela e deve chamar `exigirTermoAprovado`.
- Documentos das fases: conteúdo em JSON na aba `ProjetoDocumentos`, campos definidos em `dominio/fases.ts`. Conteúdo nunca vai
  para auditoria nem histórico. Documento aprovado fica travado. `exigirTermoAprovado` (aplicacao/fases.ts) é a trava da regra 13:
  as entregas de implementação (P4) devem chamá-la.
- Equipe (`ProjetoEquipe`) vê o projeto, não altera nem vê pareceres; passe `equipesAtivas` ao `podeVerProjeto`.
