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
  **P4 (problemas, pedidos de mudança e relatórios)** e **P5 (encerramento e lições)** prontas. **P6 (carteira)** e **P7 (ligações)** prontas.
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
  **L3 pronta** (regra L13): `lerLigacaoTermo` devolve `prazos` e `linhaDoTempo` (`dominio/ligacoes.ts`) só quando Parcerias entregou o termo
  (permissão dela); sem permissão, só o vínculo. Prazos de prestação de contas: texto fixo até existirem em Parcerias.
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
- Fase 5 (`aplicacao/encerramento.ts`, `dominio/encerramento.ts`): `Licoes` e `Encerramento` (uma linha por item: check-list contratual, financeiro e administrativo;
  textos `relatorio_final`, `transicao`, `sustentabilidade`). Etapas `encerramento` e `encerrado` (esta só leitura, em `ETAPAS_ENCERRADAS`). A porta de encerramento
  (`tipo: 'encerramento'`) abre só com atividades concluídas ou canceladas, problemas resolvidos (ainda se resolvem na fase 5), check-list, relatório final e uma lição;
  não pede parecer; seguir encerra, ajustar mantém a fase 5, parar volta à implementação. Ao abrir a porta, chama `fotografarIndicadores` com origem `encerramento`.
  Lição também em projeto parado ou cancelado, com relatório resumido (item `relatorio_final`). `consultarLicoes` mostra a lição a quem tem `projetos.acessar`, sem
  identificar o projeto a quem não o vê. `encerramentoAtrasado` (padrão 30 dias, `DIAS_ENCERRAMENTO_PADRAO`) é o ponto de chamada da carteira (P6). Textos nunca na auditoria.
- Carteira (**P6 pronta**, `aplicacao/carteira.ts`, rota `/projetos/carteira`): não cria aba. Cinco números (portas pendentes, fora da tolerância, problemas altos, encerramentos atrasados, em andamento), cada um com a lista filtrada (`?ver=`). `projetos.carteira` (Diretoria e Leitura) vê todos os projetos fora do rascunho; sem ela a leitura é recusada. Nunca devolve texto de parecer. Usa `motivosForaDaTolerancia` (P4) e `encerramentoAtrasado` (P5).
- Evento de captação (L5, entrega 1 de 3, #281): `projetosParaRealizado` (aplicacao/ligacao.ts) oferece ao Orçamento os projetos em implementação, encerramento ou encerrados que a pessoa vê, para marcar linhas do Realizado. Resultado e comparação: entrega 3.
- Evento de captação (L5, **entrega 2 de 3**): tipo `captacao` (`dominio/projeto.ts`), colunas `serie_evento`, `data_evento`, `meta_receita`, `fonte_receita_id/nome` em `Projetos` (vazias fora do tipo; `cadastrarIdeia`/`editarIdeia` limpam ao trocar o tipo). Regras puras em `dominio/evento.ts` (`conferirEvento`, `mesmaSerie`, `sugestoesDeSerie`). O Termo de Abertura do evento só tem `objetivo` e `valor_total` (`foraDaCaptacao` em `dominio/fases.ts`); as tolerâncias são gravadas a partir da configuração em `salvarDocumento`. O Orçamento chega pela interface `CatalogoReceitas` (`aplicacao/catalogo-orcamento.ts`), entregue por `catalogoDeReceitas` em `src/plataforma/ligacoes.ts`; nunca importe o Orçamento. `aplicacao/evento.ts`: `pedirReceitaNaDecisao` (porta 2 com `seguir`, nunca lança), `lancarReceitaDoEvento` (botão da aba Ligações, aceita escolher a fonte depois), `encerrarReceitaDoEvento` (parar ou cancelar; encerra também a ligação `fonte_receita`), `lerLigacaoEvento`. A decisão da porta nunca falha por causa da receita. Nova versão do Termo não troca a meta (a meta é do projeto, não do Termo).
- Evento de captação (L5, **entrega 3 de 3**): `aplicacao/resultado-evento.ts`. `lerResultadoDoEvento` monta o cartão "Resultado do evento" (aba Resumo, `telas/resultado-evento.tsx`) com o leitor `LeitorResultado` (`aplicacao/catalogo-orcamento.ts`, entregue por `leitorDeResultado` em `src/plataforma/ligacoes.ts`): a permissão é do Orçamento, e só com a resposta "ok" aparece valor (inclusive o fotografado). `fotografarResultadoDoEvento` grava, na aba `Encerramento`, o item `resultado_evento` (texto JSON com receita, custo e lançamentos; sem dado pessoal), ao abrir a porta de encerramento (se a pessoa vê o Orçamento) e de novo na decisão que encerra; depois de encerrado não é mais refeita. Comparação (L19): edições da mesma série (`mesmaSerie`), encerradas, com fotografia e lançamentos e que a pessoa vê, de data anterior. Regras puras em `dominio/evento.ts` (`resultadoDoEvento`, `leituraDoResultado`, `compararEdicoes`, `rotularEdicoes`). `CatalogoLeitura.divulgacao` traz os pedidos de divulgação ligados (Comunicação) e `compras` agora diz o que está pendente; a aba Ligações mostra a contagem.
