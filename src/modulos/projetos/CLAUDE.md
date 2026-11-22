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
- Situação: entregas **P1 (base)**, **P2 (fases 1 e 2)** **P3 (fase 3: atividades e orçamento do projeto, porta 3 e início da implementação)** e
  **P4 (problemas, pedidos de mudança e relatórios)** prontas. Faltam P5 a P7 (encerramento, carteira, ligações). `projetos.carteira` entra com a P6.
- Fase 3 (`aplicacao/planejamento.ts`, `dominio/planejamento.ts`): `Atividades` (atrasada é calculada, nunca gravada) e `ProjetoOrcamento`
  (só o plano do projeto; nada vai ao Orçamento da instituição). Atividades mudam na fase 3 e na implementação; o orçamento só na fase 3.
  A equipe vê as atividades, não o orçamento. Porta 3 (`plano`) só no porte completo; o enxuto usa `iniciarImplementacao`. A etapa
  `implementacao` existe.
- Documentos das fases: conteúdo em JSON na aba `ProjetoDocumentos`, campos definidos em `dominio/fases.ts`. Conteúdo nunca vai
  para auditoria nem histórico. Documento aprovado fica travado. `exigirTermoAprovado` (aplicacao/fases.ts) é a trava da regra 13:
  as entregas de implementação (P4) devem chamá-la.
- Equipe (`ProjetoEquipe`) vê o projeto, não altera nem vê pareceres; passe `equipesAtivas` ao `podeVerProjeto`.
- Indicadores do marco lógico (ligações onda 2, **L4 pronta**): `aplicacao/indicadores.ts` e `dominio/indicadores.ts`. O número vem do Núcleo
  (`vinculosAtivosProtegido`) ou da Avaliação, esta entregue pela plataforma (`NumerosDePessoas`, como em Parcerias): Projetos não importa a
  Avaliação. Só `valor`, `base` e `motivo` atravessam; o mínimo de 5 pessoas é da origem. `fotografarIndicadores` (L12) é o ponto de chamada para
  o relatório de monitoramento (origem `relatorio`, P4) e o encerramento (origem `encerramento`, P5): ao construí-los, chame-a.
- Ligação com o termo (L2): `aplicacao/termo.ts`. Parcerias chega pela interface `CatalogoTermos` (`catalogo-parcerias.ts`),
  entregue por `src/plataforma/ligacoes.ts`; nunca importe Parcerias. A decisão da porta 2 nunca falha por causa do rascunho.
  `financiador` e `objeto` só existem no Termo de Abertura de projeto `financiado` (`camposDe`).
- Ligações com outros apps (**P7 pronta**): `aplicacao/ligacoes.ts`, aba `LigacoesProjeto` (identificador e cópia do nome; encerrada com `ativo = FALSE`).
  O Projetos define `CatalogoLeitura` (`catalogo-leitura.ts`); a plataforma entrega (`catalogoDeLeitura`). Hoje só `compras` (Requisições) está ligado;
  as entregas L2 a L5 de cada onda acrescentam um leitor em `leitores` e chamam `registrarLigacao`. Leitor ausente = "Ligação indisponível".
- Fase 4 (`aplicacao/acompanhamento.ts`, `dominio/acompanhamento.ts`): `Problemas`, `PedidosMudanca`, `Relatorios`. Tudo só com o projeto em `implementacao`
  e Termo aprovado (`exigirTermoAprovado`). Pedido dentro da tolerância é aplicado na hora (`aplicada`); fora dela fica `pendente`, passa por
  `aguardando_alcada` se o novo total passa do limite e, aprovado, gera nova versão do Termo (`novaVersaoDoTermo`). A base da variação é a última
  versão aprovada: o primeiro pedido já aplicado sobre o mesmo alvo desde essa versão guarda o valor de partida em `atual` (regra 19). Quem pediu não decide.
  Atividade e fim do projeto mudam por pedido de prazo (tolerância de fim ou de marco = atividade); o orçamento, por pedido de custo. O relatório calcula
  a situação (`situacaoCalculada`) e só pode piorar; chama `fotografarIndicadores` com origem `relatorio` sem perder o relatório se falhar. Equipe vê
  problemas e riscos, não pedidos nem relatórios. `foraDaTolerancia` é o ponto de chamada da carteira (P6). Riscos também mudam na implementação.
