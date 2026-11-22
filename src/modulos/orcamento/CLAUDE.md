# Módulo Orçamento — regras para o agente

Leia antes `especificacao.md` desta pasta e o `CLAUDE.md` da raiz.

- Escopo: altere apenas `src/modulos/orcamento/` e as rotas `src/app/orcamento/`.
- Armazenamento: as abas do módulo são declaradas com `definirTabela` em
  `dados/tabelas.ts`, nas planilhas `orcamento`, `orcamento_folha` e `orcamento_execucao` do catálogo `PLANILHAS`. Não leia
  nem grave abas de outros módulos; use os casos de uso do Núcleo.
- Pastas: `dominio/` regras puras; `aplicacao/` casos de uso (sempre com
  `Autorizador` e `registrarAuditoria`); `dados/` tabelas; `telas/`; `testes/`.
- Dados sensíveis deste módulo: `Postos.colaborador` e todos os valores de
  `Componentes` (pessoal). Só aparecem com `orcamento.folha.ver_individual`;
  abrir a ficha de um posto registra auditoria de leitura. Os demais veem totais.
- Rateio: nunca salvar fora de 100% (`validarRateio`). Abas com vigência só
  recebem inclusões; a linha mais recente vale a partir da vigência.
- Previsão (1B): planilha `orcamento`, sem dados pessoais. O RH da folha entra automático
  (`resumoFolha`, custo × lotação) e fecha em centavos com o Resumo da folha.
- Tesouraria (1D.1): planilha `orcamento_execucao` (abas `Contas`, `Saldos`, `AjustesConciliacao`, `MudancasClasse`), sem dados
  pessoais. Saldos só para quem tem `orcamento.tesouraria.ver` (Diretoria e Financeiro); editar é do Financeiro.
  Totais por classe são sempre somas calculadas pelo Elo; o mês atual é o de Brasília.
- Permissões: `orcamento.<recurso>.<acao>`, declaradas no manifesto.
- Histórico (1E): abas `Historico` e `HistoricoAnos` na planilha `orcamento_execucao`, sem dados pessoais.
  Importar ano fechado só confere e grava se o total bater em centavos com o da planilha; reimportar ou
  desfazer cancela (`ativo = FALSE`). Ver: `orcamento.historico.ver`; importar: `orcamento.historico.editar`.
- Rateio dos custos comuns (R1, ADR-020): regras e bases próprias na planilha `orcamento`; só `orcamento.parametros.editar`
  altera, quem vê o painel vê o resultado. Cálculo puro em `dominio/rateio-custos.ts` (comuns → apoio → administrativo;
  precedência item > grupo > serviço > base do painel). O total do orçamento nunca muda pelo rateio.
- Realizado (1C.1): aba `Realizado` na planilha `orcamento_execucao`, totais mensais informados à mão (sem coluna pessoal).
  Informar/corrigir/remover: `orcamento.realizado.editar` (Financeiro); ver: `orcamento.execucao.ver` (Coordenação só o seu escopo,
  sem receitas). Salvar o mês é tudo ou nada (versão lida); remover encerra (`ativo = FALSE`). Regras puras em `dominio/realizado.ts`.
- Painel de execução e Recursos livres (1C.2, #185): só leitura, `dominio/execucao.ts` (puro) e `aplicacao/execucao.ts`. Sem aba nova; coluna opcional `fonte_termo_id` em `Realizado` (a Fonte restrita do termo adiantado, só em despesa "adiantamento a termo"). Tudo é soma de `Realizado` e da Previsão aprovada; o filtro de escopo vem ANTES de somar (Coordenação só despesa do escopo; Leitura só totais e não abre Recursos livres). Adiantamento: baixa do mais antigo para o mais novo, acumulado de todos os anos, "Atenção" acima de 60 dias. Período padrão = janeiro até o último mês informado; mês sem dado fica fora dos dois lados. Despesa sem serviço = "Comum". Dados de demonstração: `popularRealizadoFicticio`.
- Folha em caixa (P1 da #126): `dominio/caixa.ts` (puro). O custo do mês não muda; o Resumo soma o deslocamento de 13º, 1/3 de férias e abono (com encargos) ao custo. Calendário na aba `CalendarioPagamento` (só inclusões, só `orcamento.parametros.editar`); `contrato` e `mes_ferias` em `Funcionarios`.
- Código da conta contábil (#127): coluna opcional `codigo_conta` em `GruposGasto` e `Fontes` (texto até 30 caracteres, único entre
  os ativos de cada cadastro; regras em `dominio/codigo-conta.ts`). Aparece nas listas, no lote, na importação de itens
  (casa por nome ou código) e em "Baixar planilha" (CSV, `aplicacao/baixar-planilha.ts`, rota `previsao/baixar/[arquivo]`).
  O código não é dado pessoal. O plano de contas estruturado (#221, abaixo) substituiu a decisão "sem plano de contas" da #127; `Fontes.codigo_conta` continua.
- Passivo trabalhista (P2 da #126, #142): `dominio/passivo.ts` (puro) e `aplicacao/passivo.ts`. Abas `FeriasTiradas` e `SaldoFGTS` (só inclusões; remover férias encerra) na planilha `orcamento_folha`; parâmetros do grupo `passivo` (aviso prévio e multa do FGTS). Só postos com código entram (vaga e cedido não). Valor por pessoa só com `orcamento.folha.ver_individual`; quem tem só `folha.ver` vê totais do seu escopo. Pessoa sem dados vai para pendências, nunca com valor zero. Fonte pelo cadastro `FontesFolha`; quando o rateio de fonte por pessoa (R4) existir, trocar só o mapa `fonteDe`.
- Cedidos (C1 da #125): `dominio/cedidos.ts` (puro) e `aplicacao/cedidos.ts`. Abas `Cedidos`, `ValoresCedidos`, `LotacaoCedidos` (planilha da folha, nome e valor pessoais) e `Cedentes` (planilha `orcamento`). Nada altera folha, caixa ou passivo. Ver e abrir ficha: `folha.ver_individual` (com auditoria de leitura); alterar: `folha.editar`. Aviso de fim de cessão (parâmetro `cessao_aviso_dias`): DP, Financeiro e Diretoria com nome; coordenação só no seu escopo e sem nome.
- Sustentabilidade financeira (S1 da #131, `especificacao-sustentabilidade.md`): regras puras em `dominio/sustentabilidade.ts`, casos de uso em `aplicacao/sustentabilidade.ts`. Nada é guardado: custo = "Total" da Análise por área (`painelPorArea`, nunca recalculado), repasse vem dos termos pela plataforma (`CatalogoParcerias`, `catalogoDeParcerias` em `src/plataforma/ligacoes.ts`). Coluna `origem` em `CentrosCusto` e aba `LimitesSustentabilidade`. Ver: `orcamento.sustentabilidade.ver` (Diretoria, Financeiro, Leitura); alterar origem e limites: `orcamento.parametros.editar`, auditado (colunas). Só serviço `contratado` entra no peso do aporte; sem limite não há alerta. Visão "com cedidos" e blocos 2 a 5 (S2 a S4) ainda não existem.
- Cedidos (C2 da #125): `dominio/cedidos-custo.ts` (puro) e `aplicacao/cedidos-custo.ts`. Despesa por serviço e receita por cedente saem da mesma conta em centavos (sempre iguais). `lerPrevisao(..., { incluirCedidos })` (padrão `true`) soma cedidos nos totais, indicadores, Painel geral e Análise por área; Aprovação e "Baixar planilha" chamam com `false` (cedido não tem dinheiro nem entra no orçamento aprovado). Cedido nunca é recurso livre; só poder público conta como receita pública. Seletor "Incluir cedidos" vale na tela (`?cedidos=0`), nunca é gravado. Participação: `aplicacao/participacao.ts`; `cedidosPorServicoECedente` (sem dado pessoal, no escopo do serviço) é a leitura para a #131.
- Fontes dos termos (R3a da #140): `dominio/fontes-termo.ts` (puro) e `aplicacao/fontes-termo.ts`. Abas `FontesTermo` (fonte do termo → Fonte do
  cadastro e conta vinculada) e `CategoriasPlanoOrigens` (categoria do plano → "folha" ou "grupo:<id>"; tirar uma origem encerra a linha), planilha `orcamento`.
  Os termos vêm do `CatalogoParcerias` (`aplicacao/catalogo-parcerias.ts`), entregue por `src/plataforma/catalogos.ts`; o Orçamento nunca importa Parcerias,
  e sem Parcerias o catálogo é vazio. Ver: `orcamento.painel.ver`; ligar: só `orcamento.parametros.editar`. "Conta e fonte não combinam" e a mesma conta em
  duas fontes são avisos, nunca bloqueio. Próximas entregas: R3b (rateio na despesa), R4a (folha e horas), R4b (painel de comprometimento).
- Fim do ano e reserva (1D.2 da #186): regras puras em `dominio/conferencia.ts`, `dominio/fim-do-ano.ts` e `dominio/reserva.ts`; casos de uso em
  `aplicacao/{base-execucao,conferencia,fim-do-ano,reserva,visao-geral}.ts`. Abas `PoliticaReserva` (faixas dos seis sinais, só inclusões; a decisão
  atualiza `situacao`) e `UsosReserva` (pedido de uso, não move saldo), planilha `orcamento_execucao`. Ver tudo: `orcamento.tesouraria.ver`; propor,
  pedir, cancelar e marcar recomposição: `tesouraria.editar` (Financeiro); aprovar ou recusar: `orcamento.reserva.aprovar` (Diretoria), e quem fez o
  pedido nunca decide o próprio. Dado que falta é "sem dado" com o que falta, nunca zero. Leitura (`painel.ver`) vê na Visão geral só os sinais
  que não dependem de saldo. Mês atual nos casos de uso aceita `agora` (testes usam data fixa). `/orcamento` redireciona para a Visão geral; o Resumo
  da folha está em `/orcamento/resumo`. Gráfico do Fim do ano só desenha meses com saldo (o `Linhas` do Núcleo não tem buraco).
- Lançamento de despesas por rateio (#225, ADR-038): aba `LancamentosRateio` (planilha `orcamento`) e coluna opcional `lancamento_rateio_id` em `Despesas`. Casos de uso em `aplicacao/lancamentos-rateio.ts`, divisão mês a mês em `dominio/lancamento-rateio.ts` (usa `ratearPelaRegra` do R1, sem mudá-lo). Cada serviço participante recebe uma despesa (`distribuicao = manual`, sem regra própria), travada no cadastro comum (`salvarDespesa` e `cancelarItem` recusam). Recálculo só em exercício `elaboracao`, pela função única `recalcularLancamentosAfetados`, chamada nos cinco pontos: salvar o lançamento, `salvarRegra`, `salvarValoresDaBase`, `salvarCentro` (atendidos, m², vagas) e a lotação da folha (`salvarPosto`, `salvarRateios`); o cálculo e o recálculo ficam em `aplicacao/recalculo-rateio.ts` (sem importar folha, previsão nem regras, para não formar ciclo: o nº de profissionais chega por parâmetro) e `aplicacao/regras-calculo.ts` (`regrasParaCalculo`). Base "custo direto" só soma despesas lançadas à mão. Regra em uso por lançamento não pode ser excluída. Ver e lançar: `orcamento.painel.ver` / `orcamento.previsao.editar`. Tela: `/orcamento/previsao/rateio`.

- Plano de contas (#221, ADR-036, entrega 1 de 3): regras puras em `dominio/plano-contas.ts`, casos de uso em `aplicacao/plano-contas.ts`. Grupo de Contas = `GruposGasto` (mesmos ids). Abas novas na planilha `orcamento`: `AreasPlano`, `ItensContabeis`, `PlanoContas` (só inclusões, em lotes completos por exercício; vale o lote mais recente com vigência ≤ a data; `salvarPlano` confere o lote lido). Ver: `painel.ver`; alterar: `previsao.editar`. Áreas e Itens são cadastros únicos, encerrados com `ativo = FALSE`; plano antigo nunca é alterado. O plano só orienta (nunca bloqueia). Telas: `previsao/plano`, `previsao/areas-plano`, `previsao/grupos/[id]` (itens). Entregas 2 (lançamentos com `item_id`/`area_plano_id`) e 3 (comparar exercícios e divergências) ainda não existem.
