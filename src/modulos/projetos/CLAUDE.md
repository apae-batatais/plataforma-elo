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
- Situação: entregas **P1 (base)** e **P2 (fases 1 e 2: documentos, marco lógico, riscos, equipe, Termo de Abertura e porta 2)**
  prontas. Faltam P3 a P7 (atividades e orçamento, mudanças, encerramento, carteira, ligações). `projetos.carteira` entra com a P6.
- Documentos das fases: conteúdo em JSON na aba `ProjetoDocumentos`, campos definidos em `dominio/fases.ts`. Conteúdo nunca vai
  para auditoria nem histórico. Documento aprovado fica travado. `exigirTermoAprovado` (aplicacao/fases.ts) é a trava da regra 13:
  as entregas de implementação (P4) devem chamá-la.
- Equipe (`ProjetoEquipe`) vê o projeto, não altera nem vê pareceres; passe `equipesAtivas` ao `podeVerProjeto`.
- Indicadores do marco lógico (ligações onda 2, **L4 pronta**): `aplicacao/indicadores.ts` e `dominio/indicadores.ts`. O número vem do Núcleo
  (`vinculosAtivosProtegido`) ou da Avaliação, esta entregue pela plataforma (`NumerosDePessoas`, como em Parcerias): Projetos não importa a
  Avaliação. Só `valor`, `base` e `motivo` atravessam; o mínimo de 5 pessoas é da origem. `fotografarIndicadores` (L12) é o ponto de chamada para
  o relatório de monitoramento (origem `relatorio`, P4) e o encerramento (origem `encerramento`, P5): ao construí-los, chame-a.
