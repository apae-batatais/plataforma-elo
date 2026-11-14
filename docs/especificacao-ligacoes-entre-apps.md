# Especificação — Ligações entre apps, onda 1

- Situação: aprovada. **L1 (Ficha do serviço) construída** em 14/11/2026; L2 a L6 ainda por construir (detalhamento na seção "Construção de L2 a L6", issue #144)
- Dono do produto: Diretoria
- Proposta de origem: issue #115 (onda 1 de 3; as ondas 2 e 3 são as issues #116 e #117)
- Arquitetura: ADR-013 (ligação entre módulos) e **ADR-022** (leituras com permissão e portas de entrada)
- Respostas da Diretoria (13/11/2026, comentário da issue): 1.1 (cancelado ou parado tira da previsão só o que
  ainda não foi gasto; nova versão do Termo troca as linhas) e 2.1 (na requisição, só o projeto é obrigatório;
  a atividade é opcional).

## Objetivo

Hoje cada app funciona sozinho e ninguém vê "tudo sobre um serviço" ou "tudo sobre um projeto". Esta onda cria
o fio comum, o **serviço (centro de custo)**, e as quatro ligações do núcleo:

- **A** · **Ficha do serviço**: uma tela por serviço com o que cada app tem sobre ele.
- **B** · **Projeto ↔ Orçamento**: o orçamento do projeto entra no orçamento do serviço; o realizado volta.
- **D** · **Requisição ↔ serviço ↔ projeto**: a requisição indica projeto e atividade; quem aprova vê o saldo
  e a fonte antes de aprovar.
- **E** · **Comunicação ↔ Projeto**: o pedido de publicação pode ser de um projeto; o plano de comunicação do
  projeto cria os pedidos; as publicações voltam para o histórico e o relatório final.

Para quem: coordenações, Financeiro, Compras e setores que atendem, Comunicação e Diretoria.

**Esta especificação pede mudanças no Núcleo, na plataforma e em cinco módulos** (Projetos, Orçamento,
Requisições, Comunicação e Avaliação), **só nos pontos listados em "Frentes"**. A aprovação desta
especificação pela Diretoria é o pedido explícito exigido pela regra 2 do `CLAUDE.md`.

## O que já existe e não se repete

- **O cadastro único de serviços já existe** (`Servicos` do Núcleo, com `codigo`). Requisições (`Centros`),
  Avaliação (serviço atual), Parcerias (`TermoServicos`), Orçamento (`Despesas`, `Realizado`) e Projetos
  (`Projetos.servico`) já guardam o **código** do serviço. Esta onda **não cria cadastro novo**: acrescenta o
  serviço onde falta (pedido de publicação) e obriga onde a regra pede (projeto completo).
- **Requisições já indicam o serviço** (centros de custo com percentual). O que é novo é o projeto, a
  atividade e a conferência do saldo.
- **A entrega P7 de Projetos** (ligações) fica **dividida**: Orçamento, Requisições e Comunicação passam a esta
  onda; Parcerias, Pessoas e Avaliação ficam com a onda 2 (issue #116). A regra 26 de Projetos é atualizada.
- **A issue #60** (requisição ligada à execução do orçamento) é coberta pela entrega L2 (saldo) e L6 (fonte);
  a #60 pode ser fechada quando a L6 for entregue.
- **A issue #57** (Capacidade de Indicadores) **não** é coberta: aqui só há números calculados em cada leitura.

## Dependências entre apps (o que precisa existir antes)

| Entrega | Precisa de |
| --- | --- |
| L1 Ficha do serviço | Nada novo (usa o que existe; o bloco de projetos mostra o que já há) |
| L2 Requisição ↔ serviço e projeto, com saldo | Orçamento 1C.1 (realizado), já construída; a lista de projetos só mostra projetos em implementação (Projetos P2 a P4) |
| L3 Pedido de publicação ligado a projeto | Projetos P1 (já construída) |
| L4 Projeto ↔ Orçamento | Projetos **P2** (Termo e tolerâncias), **P3** (orçamento do projeto) e **P4** (pedidos de mudança e versões do Termo) |
| L5 Plano de comunicação cria pedidos, e publicações no relatório final | Projetos **P3** e **P5**, e a L3 |
| L6 Conferência da fonte | Orçamento **R3** (fontes dos termos e plano de aplicação) e Parcerias R2 (já construída) |

## Usuários e permissões

| Quem | Pode | Permissões |
| --- | --- | --- |
| Diretoria, Financeiro, Leitura | Abrir a Ficha de qualquer serviço (cada bloco segue a permissão do próprio app) | `plataforma.servicos.ver` (global), mais as de cada app |
| Coordenação de serviço, Técnico avaliador | Abrir a Ficha dos serviços do seu escopo | `plataforma.servicos.ver` (escopo) |
| Quem pede publicação ou requisição | Ligar o pedido a um projeto que **ele já vê** em Projetos | permissões atuais de cada app |
| Quem aprova requisição | Ver a conferência do orçamento do serviço, se tiver `orcamento.execucao.ver` no escopo do serviço | `requisicoes.aprovar` + `orcamento.execucao.ver` |
| Responsável pelo projeto | Pedir a sincronização com o Orçamento, criar os pedidos de publicação do plano, ver compras e publicações do projeto | `projetos.gerenciar` |

`plataforma.servicos.ver` é permissão nova do Núcleo, ligada aos perfis por "Preparar estrutura".

**Quem vê o quê (regra geral):**
- A ligação respeita a permissão **do app de origem do dado**. Quem não tem vê só o **nome do serviço** (e o
  rótulo "Sem permissão para ver o orçamento"), nunca um valor.
- **Exceção, decidida aqui:** o **realizado das linhas do próprio projeto** (e o planejado, que já é do projeto)
  aparece para quem vê o projeto, mesmo sem `orcamento.execucao.ver`. É o dinheiro do projeto, não o orçamento
  do serviço; o saldo do serviço e as outras linhas continuam só para quem tem a permissão.
- Nenhum dado pessoal atravessa de app para app. Atendidos: **só contagens**. Pedidos de requisição e de
  publicação aparecem no projeto **sem nome de quem pediu**.

## Entidades (colunas novas; nenhuma aba nova com dado pessoal)

Todas as colunas novas são opcionais, têm `ativo` herdado da aba e são acrescentadas por "Preparar estrutura"
no fim do cabeçalho, sem mexer nos dados existentes. Nada é apagado.

| App · aba | Colunas novas | Observação |
| --- | --- | --- |
| Projetos · `Projetos` | (sem coluna nova: `servico` já guarda o código) | Passa a ser **obrigatório** no porte completo antes da Porta 2 (regra O1) |
| Projetos · `ProjetoOrcamento` | `atividade_id`, `grupo_id`, `grupo_nome`, `fonte_id`, `fonte_nome` | `fonte` em texto livre é trocada pela fonte do cadastro do Orçamento (id + nome copiado); `grupo` também vem do Orçamento. Sem a ligação do Orçamento, a linha fica com texto e **não** entra no orçamento |
| Projetos · `PlanoComunicacao` (aba nova, parte do documento de comunicação da fase 3) | projeto × momento (`lancamento`, `marco`, `encerramento`) × `atividade_id` opcional × tipo de peça × título × descrição × data desejada × `pedido_numero` e `pedido_id` (cópia, preenchidos ao criar) | Sem dado pessoal; `pedido_id` guarda o vínculo para não duplicar |
| Projetos · `ProjetoEstadoOrcamento` (aba nova) | projeto × `versao_termo` × situação da sincronização (`ok`, `pendente`, `recusada`) × motivo × quando × quem | Mostra à tela o que o Orçamento aceitou e o que ficou pendente |
| Orçamento · `Despesas` | `projeto_id`, `projeto_codigo`, `projeto_titulo`, `projeto_linha_id`, `versao_termo`, `encerrada_em`, `motivo_encerramento` | Linhas vindas de projeto (regra O4). `origem` implícita: tem `projeto_id` |
| Orçamento · `Realizado` (planilha `orcamento_execucao`) | `projeto_id` | O Financeiro marca de qual projeto é o gasto (regra O8) |
| Requisições · `Requisicoes` | `projeto_id`, `projeto_codigo`, `projeto_titulo`, `atividade_id`, `atividade_descricao`, `valor_estimado`, `valor_gasto` | `valor_estimado` e `grupo_id` (já existe) são preenchidos por **quem aprova** (regra R5); `valor_gasto`, por quem atende, ao concluir (regra R7) |
| Comunicação · `Pedidos` | `servico`, `projeto_id`, `projeto_codigo`, `projeto_titulo`, `plano_item_id` | `plano_item_id`: o item do plano de comunicação que gerou o pedido |
| Núcleo · permissões | `plataforma.servicos.ver` | Perfis na tabela acima |

Sigilo: nenhuma coluna nova liga pessoa a dado sensível. `projeto_*` e `servico` são `interno`; `valor_*` das
requisições são `interno`.

## Regras de negócio (com teste)

### Gerais (G)

G1. **Um módulo nunca importa outro.** Cada app declara a interface do que precisa; a plataforma
(`src/plataforma/ligacoes.ts`) a liga (ADR-022). `npm run fronteiras` continua verde. Cada app é testado com
catálogo falso, sem o outro.
G2. **App ausente = "indisponível", nunca erro.** Em bloco, aparece o rótulo; em formulário, o campo da ligação
simplesmente não aparece. Testar com o app desligado e com o catálogo vazio.
G3. **Permissão do app de origem.** Toda leitura de ligação passa pelo `Autorizador` do app dono e devolve
`ok`, `sem_permissao` ou `indisponivel`. Testar: perfil sem permissão não recebe nenhum valor, nem somado.
G4. **Nenhum dado pessoal atravessa.** As visões de ligação não trazem colunas de `sigilo` pessoal ou sensível.
Testar com um verificador que percorre o resultado de cada visão.
G5. **Cópia do nome.** Toda ligação guarda código e nome copiado (projeto, atividade, serviço, grupo, fonte).
O registro continua legível se o cadastro de origem mudar; a tela mostra o nome atual quando o app dono está
ativo e o nome copiado quando não.
G6. **Gravar em outro app só por porta de entrada** (idempotente, validada no destino, auditada no destino com
a origem). Repetir a chamada não duplica. Testar a repetição.
G7. **Auditoria:** toda gravação (nos dois apps) usa `inserir`/`atualizar` com a versão lida e chama
`registrarAuditoria` com as colunas, nunca os valores.

### A · Ficha do serviço (A)

A1. Cada serviço ativo tem uma Ficha em `/servicos/<codigo>`; a lista `/servicos` mostra os serviços que a
pessoa pode abrir (pelo escopo de `plataforma.servicos.ver`).
A2. Blocos da Ficha, cada um com a sua origem e permissão:
  1. **Resumo** (Núcleo): nome, código, área, unidade, vagas, vigência. Sempre visível a quem abre a Ficha.
  2. **Custo e fontes** (Orçamento, `orcamento.execucao.ver` no escopo): previsto no exercício, realizado até o
     último mês informado, saldo, e previsto × realizado por fonte.
  3. **Vagas e atendidos** (Núcleo): vagas e **quantidade** de pessoas com vínculo ativo, e ocupação. Só contagem.
  4. **Projetos** (Projetos): projetos do serviço por etapa, com situação e "fora da tolerância" (quando
     houver); cada linha leva ao projeto.
  5. **Requisições** (Requisições): abertas, esperando aprovação, atrasadas e atendidas no exercício; sem nome de
     quem pediu.
  6. **Publicações** (Comunicação): pedidos ligados ao serviço por situação, os publicados nos últimos 12 meses.
  7. **Avaliação** (Avaliação, `avaliacao.painel`): quantidade de avaliações no ano e os indicadores já
     calculados do painel do serviço, só agregados.
A3. Bloco de app sem permissão mostra "Você não tem acesso a esta informação" e **nenhum número**; bloco de app
desligado mostra "Este app não está ativo na sua instituição". Os dois nunca quebram a tela.
A4. Cada bloco tem o link "Abrir em <app>" que leva à tela de origem, **só quando a pessoa tem acesso a ela**.
A5. Serviço encerrado (com `fim` no passado) abre a Ficha, com o aviso "Serviço encerrado em <data>"; blocos
mostram o histórico.
A6. Os números da Ficha são **calculados na hora**, nunca guardados. Cada bloco informa a data do último dado.
A7. A Ficha só lê e mostra contagens: não grava nada e não abre dado individual de atendido, então não há
auditoria de leitura individual (regra 8 do `CLAUDE.md` não se aplica).

### B · Projeto ↔ Orçamento (O) — entrega L4

O1. **Serviço obrigatório no porte completo.** O projeto completo só abre a **Porta 2** com serviço ativo do
Núcleo escolhido; a tela de "o que falta" lista isso. No **enxuto** o serviço é opcional; sem serviço, o projeto
**não entra** no orçamento e a tela diz isso ("Escolha um serviço para o orçamento do projeto aparecer no
Orçamento"). O serviço não muda depois de a Porta 2 ser aprovada, salvo por pedido de mudança aprovado.
O2. **Linha do orçamento do projeto** (`ProjetoOrcamento`): categoria, descrição, valor planejado, **grupo de
gasto** e **fonte de recurso** do cadastro do Orçamento (escolhidos entre os ativos, vindos do catálogo
`CatalogoOrcamento`), e **atividade opcional**. "Atividade com custo" é a atividade que tem linha(s) ligada(s).
Para projeto com serviço, grupo e fonte são obrigatórios na linha antes da Porta 2. O catálogo ausente ou vazio
bloqueia o envio com a mensagem "Escolha grupo e fonte; o Orçamento não está disponível".
O3. **Entrada no Orçamento (porta de entrada).** Ao ser aprovada a Porta 2 (`seguir`, e a alçada quando houver), e
a cada nova versão do Termo aprovada, o caso de uso de Projetos pede à plataforma `sincronizarLinhasDeProjeto` do
Orçamento com o estado desejado: linhas vigentes da última versão aprovada, serviço, projeto (código e título) e
versão. A mesma função roda no botão **"Sincronizar com o Orçamento"** (responsável e Diretoria).
O4. **O que o Orçamento grava.** Cada linha vira um item de **Despesas** do serviço, com `projeto_id` (e cópias),
`categoria = projetos`, situação **aceita**, grupo e fonte da linha, **valor distribuído em partes iguais nos
meses do período** da atividade (ou do projeto, se não houver atividade), cortado por exercício (o valor de cada
ano vai para o exercício daquele ano). Não passa pela aprovação do exercício nem pelas propostas: a decisão foi a
Porta 2. Exercício **em elaboração**: o item entra normalmente. Exercício **aprovado**: o item entra e a Previsão
mostra "inclui R$ X de projetos aprovados depois da aprovação do exercício" em separado. Exercício **encerrado**
ou inexistente: a parte daquele ano **não entra**, fica `pendente` em `ProjetoEstadoOrcamento` com o motivo, e
entra sozinha na próxima sincronização depois de o exercício existir (a criação de exercício chama a
sincronização dos projetos pendentes).
O5. **Linha de projeto não é editada no Orçamento.** Na Previsão ela aparece só leitura, com o rótulo "Projeto
PRJ-0000" e o link; não entra em remanejamento nem em suplementação nesta onda. Mudar valores é pedido de mudança
do projeto (O6).
O6. **Nova versão do Termo (decisão 1.1).** Quando a Diretoria aprova a nova versão, as linhas da versão antiga
são **encerradas** (`ativo = FALSE`, `encerrada_em`, `motivo_encerramento = 'nova versão do Termo'`) e as da nova
entram no lugar, **sem digitar de novo** (a nova versão já traz as linhas do projeto). O realizado já lançado
**permanece** e continua ligado ao projeto.
O7. **Projeto cancelado ou parado (decisão 1.1).** As linhas ainda não gastas saem da previsão do serviço: as
linhas vigentes são **encerradas** (`ativo = FALSE`, `encerrada_em`, `motivo_encerramento = 'cancelado'` ou
`'parado'`), e, para os meses **anteriores ao mês do cancelamento** que tinham previsto, o Orçamento recria
**uma linha mantida** só com esses meses (para o previsto × realizado desses meses continuar comparável). Os
meses do cancelamento em diante saem da previsão. O realizado **permanece**. Projeto `parado` que a Diretoria
reativa (nova Porta 1 e nova Porta 2) volta a entrar pelo O3. Nada é apagado.
O8. **O realizado volta para o projeto.** `Realizado` ganha `projeto_id` opcional. Em **Execução › Informar
realizado**, as linhas de projeto aparecem como linhas próprias da grade (serviço × grupo × fonte × projeto,
com o previsto do mês) e **"Adicionar linha"** tem o campo opcional "Projeto" (entre os projetos que têm linha
no Orçamento). Projetos lê o realizado pela visão de ligação do Orçamento: por mês e por grupo × fonte, **só do
projeto**.
O9. **Planejado × realizado e tolerância (calculados na hora, sobre a última versão aprovada, regra 19 de
Projetos).**
  - **Custo do total:** variação = (realizado acumulado − valor aprovado) ÷ valor aprovado, contando só quando
    positiva; comparada com a tolerância do total do Termo.
  - **Custo por linha agregada** (grupo × fonte): variação = (realizado − planejado) ÷ planejado, só quando
    positiva; comparada com a tolerância por linha. Gasto lançado em grupo × fonte **sem linha prevista** conta
    no total e aparece como aviso "gasto sem linha prevista".
  - A tela diz em palavras: "o custo subiu 3% dos 5% permitidos"; acima do limite: "o custo passou do limite de
    5% permitidos: faça um pedido de mudança". O projeto é marcado "fora da tolerância" como na regra 19.
  - Mostra também o **ritmo** (planejado até o mês atual × realizado), só informativo; não gera alerta.
O10. **Sem o Orçamento (ligação indisponível):** o projeto funciona; o orçamento do projeto fica só em
`ProjetoOrcamento`; a aba mostra "O Orçamento não está ativo: o realizado não aparece e as linhas não entram no
orçamento do serviço". Nada é bloqueado, exceto a regra de grupo e fonte (O2), que exige o catálogo.
O11. **Quem pode:** `projetos.gerenciar` do projeto e `projetos.decidir` disparam a sincronização; o
Orçamento **não confere** `orcamento.previsao.editar` (a decisão foi do projeto), mas confere cadastros ativos e
exercício, e registra a auditoria no Orçamento com a pessoa e `origem: projetos` (ADR-022).
O12. **Visibilidade:** o planejado e o realizado do projeto aparecem a quem vê o projeto; o saldo do serviço e as
linhas de outros projetos, só a quem tem `orcamento.execucao.ver` no escopo do serviço.

### D · Requisições ↔ serviço, projeto e orçamento (R) — entregas L2 e L6

R1. **Serviço:** continua como hoje (centros de custo com percentual somando 100%). Esta onda não muda isso para
requisições sem projeto.
R2. **Projeto e atividade (decisão 2.1).** Na ficha da requisição aparece "Esta compra é de um projeto?"
(opcional). Ao escolher, **só o projeto é obrigatório**; a atividade é **opcional**, entre as do projeto que não
estão concluídas nem canceladas. A lista de projetos traz só os que a pessoa **vê em Projetos** e que estão **em
implementação** (Termo aprovado). Projeto fora dessa lista não é aceito no servidor (testar com id de projeto
que a pessoa não vê).
R3. **Serviço vem do projeto.** Se o projeto tem serviço, a requisição ligada a ele tem **um único centro de
custo: o serviço do projeto, 100%**, e o campo fica travado com "O serviço vem do projeto". Se o projeto não tem
serviço (enxuto), os centros são livres como hoje. Se o projeto trocar de serviço depois, as requisições já
enviadas mantêm o que gravaram.
R4. **Quem aprova vê a conferência do orçamento** antes de decidir: para cada centro de custo (serviço), o
saldo do exercício e, se a Orçamento estiver ativo, quais fontes pagam aquele tipo de gasto. A conferência é
**só aviso: nunca bloqueia**. Se a pessoa não tem `orcamento.execucao.ver` no escopo, o cartão mostra o nome do
serviço e "Você não tem acesso ao orçamento deste serviço; a aprovação segue sem a conferência".
R5. **Valor estimado e grupo de gasto, informados por quem aprova (nunca por quem pede).** O formulário de pedido
**não ganha** campo de valor nem de grupo (a decisão de 04/11/2026 continua). No cartão de conferência, quem
aprova pode informar, opcionalmente, **"Valor estimado"** e **"Grupo de gasto"** (lista do Orçamento) só para
conferir; ficam gravados na requisição (`valor_estimado`, `grupo_id` e `grupo_nome`). Com os dois informados o
cartão mostra: "saldo do grupo neste serviço: R$ X; depois desta compra: R$ Y" e, se Y < 0, o aviso "passa do
previsto". Com o grupo e sem o valor, mostra só o saldo do grupo. Sem grupo, mostra o saldo do serviço.
R6. **Saldo** = previsto do exercício aprovado, no serviço (e no grupo, se informado) **menos o realizado
informado** até o último mês lançado. O saldo **não desconta** requisições já aprovadas e ainda não gastas
(a requisição não traz valor); o cartão diz "saldo sem as compras aprovadas ainda não lançadas". Se o exercício
não existe ou não está aprovado, o cartão diz "Sem orçamento aprovado para este ano". Quando a requisição é de
projeto, o cartão mostra também o planejado × realizado **do projeto** (O12) e o da atividade, se informada.
R7. **Valor gasto ao concluir (opcional).** Quem atende, ao concluir, pode informar "Valor gasto (opcional)".
Ele aparece no projeto (por atividade, quando informada), como **"Compras ligadas"**, separado do realizado do
Orçamento e **sem somar com ele** (para não contar em dobro); o rótulo explica: "informado por quem atendeu; o
realizado oficial é o do Orçamento".
R8. **Conferência da fonte (L6, depende do R3 do Orçamento).** O cartão lista as fontes do serviço que pagam
aquele grupo, cada uma com o saldo e os avisos do plano de aplicação do termo (categoria que não existe no plano
da fonte; comprometido que passa do valor da categoria ou do total quando a fonte permite remanejar). Se o
plano não pode ser conferido ainda, o cartão diz "A conferência da fonte entra quando o Orçamento tiver o
rateio de fonte" e **não** mostra "fonte pode pagar" nem "não pode". É sempre aviso, nunca bloqueio.
R9. **Quem vê as requisições do projeto** (aba "Compras" do projeto): quem vê o projeto vê número, tipo,
situação, atividade, datas e valor gasto de cada requisição ligada, **sem o nome de quem pediu**. Quem não vê o
projeto não vê o vínculo.
R10. As regras de Requisições (caminho, SLA, aprovação, anexos) **não mudam**. Mudanças de situação continuam
sendo só do app Requisições.

### E · Comunicação ↔ Projeto (C) — entregas L3 e L5

C1. **Pedido ligado a projeto (L3).** No pedido de publicação aparece "É sobre um projeto?" (opcional), com os
projetos que a pessoa **vê em Projetos**, de qualquer etapa menos rascunho de outra pessoa, e "Serviço"
(opcional). Se o projeto tem serviço, o serviço vem do projeto e fica travado; sem projeto, a pessoa pode
escolher um serviço, e a **área** vem preselecionada pela área do serviço (a pessoa pode trocar, como hoje).
C2. Na **revisão**, a Comunicação pode trocar o projeto e o serviço do pedido, como já troca título e tema; vai
para o histórico com as colunas alteradas (regra 3 da Comunicação).
C3. **Plano de comunicação do projeto (L5).** No documento de comunicação da fase 3, o responsável cadastra os
itens do plano: momento (**lançamento**, **marco** ou **encerramento**), atividade (opcional, para o marco), tipo
de peça (os da Comunicação: post, reel, release, artigo, entrevista), título, descrição e **data desejada**.
C4. **Criar os pedidos.** O botão **"Criar pedidos de publicação"** (responsável, projeto em implementação) cria,
na Comunicação, um pedido para cada item **com data desejada futura** e ainda sem pedido, por uma porta de
entrada idempotente (`plano_item_id`). Cada pedido nasce **"Aguardando revisão"**, em nome do responsável como
solicitante, ligado ao projeto, ao serviço e ao item do plano, e passa pelas regras normais (urgência,
calendário "fora do calendário", revisão). A tela mostra, item a item, o número do pedido criado, ou o motivo de
não ter criado ("sem data", "data no passado", "a Comunicação não está ativa"). Repetir o botão **não duplica**.
C5. **Foto e vídeo.** Pedidos criados pelo plano **não têm foto nem vídeo**, então a confirmação de imagem
(regra 8 da Comunicação) não se aplica; a Comunicação pede o material na revisão (devolve ao responsável).
C6. **Publicações no projeto.** A aba "Comunicação" do projeto lista os pedidos ligados, **sem nome de quem
pediu**: número, título, tipo de peça, situação, data publicada e link da publicação. As publicações **entram no
Histórico do projeto** como linhas "Publicação: <título>" (calculadas na leitura, não guardadas).
C7. **No relatório final.** Ao **enviar o relatório final** (entrega P5), o Elo copia para o documento a **lista
de publicações** (pedidos publicados ou realizados do projeto, com título, tipo, data e link). A cópia é
congelada no documento aprovado; se a Comunicação for desligada depois, o relatório continua completo.
C8. **Projeto cancelado ou parado:** os pedidos já criados **não são cancelados automaticamente**; a aba
"Comunicação" mostra "Pedidos ainda em andamento" para o responsável decidir. Cancelar pedido continua sendo só
de quem pediu, como hoje.
C9. As regras da Comunicação (caminho, antecedência, anexos, calendário) **não mudam**; o pedido ligado a projeto
só ganha as colunas novas e a exibição.

## Telas

### 1. Ficha do serviço (nova; `/servicos/<codigo>`)

- **Quem usa e o que quer:** coordenação, Financeiro ou Diretoria que quer "tudo sobre este serviço" numa tela.
  Caminho mais curto: **1 clique** a partir de "Serviços" no menu (ou 2, pela lista); nada precisa ser digitado.
- **Primeira dobra:** `CabecalhoPagina` com a trilha (Serviços › nome do serviço), o nome, o código e a
  área/unidade; logo abaixo, os **quatro números** que pedem atenção (previsto no ano, realizado, saldo, ocupação
  de vagas), cada um em `NumeroQueConta`. **Ação principal:** "Abrir orçamento do serviço" (quando a pessoa tem
  acesso); as demais ações estão em cada bloco ("Abrir em Projetos", "Abrir em Requisições"…).
- **Componentes de `src/ui/`:** `CabecalhoPagina`, `Secao`, `NumeroQueConta`, `Etiqueta`, `TabelaDados`
  (projetos, requisições), `Aviso`, `EstadoVazio` e os gráficos abaixo. **Nenhum componente novo.**
- **Estados de cada bloco:**
  - *Com dados:* os números e o link "Abrir em <app>".
  - *Vazio:* "Nenhum projeto neste serviço ainda." com o link "Cadastrar uma ideia" (quando a pessoa pode).
  - *Sem permissão:* `Aviso` "Você não tem acesso ao orçamento deste serviço. Fale com o Financeiro." Sem número.
  - *App indisponível:* `Aviso` "Este app não está ativo na sua instituição."
  - *Carregando:* o bloco reserva o espaço e mostra "Carregando…"; um bloco com erro de leitura mostra
    "Não foi possível carregar agora. Tente de novo." e **não derruba os outros blocos**.
  - *Sem permissão para a Ficha:* a rota responde como "página não encontrada" para serviço fora do escopo.
- **Gráficos:**
  - *Custo por fonte:* "A pergunta: de onde vem o dinheiro e quanto já foi usado?" Forma: `BarrasHorizontais`
    com duas séries (previsto e realizado), maior previsto primeiro; formato `moeda`; título em forma de
    conclusão (por exemplo, "Duas fontes concentram 80% do gasto do serviço"); leitura ao lado: o número grande do
    saldo e o que fazer ("Saldo menor que 10% do previsto: converse com o Financeiro"). Mais de 7 fontes: `TabelaDados`.
    Sem dados: `EstadoVazio` "Sem orçamento aprovado para este ano". Ano parcial: o rótulo diz "até <mês>".
  - *Ocupação de vagas:* `Indicadores` com o percentual de vagas ocupadas e referência de 100% ("desde"/"ate"
    conforme o app de origem usa); sem vagas cadastradas, valor `null` ("—").
- **Celular e teclado:** blocos empilhados em uma coluna; os quatro números em duas linhas de dois; cada bloco
  tem um título como cabeçalho (navegável) e o link "Abrir em…" é o primeiro foco dentro dele; áreas de clique de
  44 px.
- **Ação sem volta:** nenhuma (a Ficha é leitura).

### 2. Lista de serviços (nova; `/servicos`)

`TabelaDados` com serviço, área, unidade, vagas e situação (ativo/encerrado), filtro e busca; clicar na linha
abre a Ficha. Vazio: "Nenhum serviço no seu escopo." Entrada no menu: **"Serviços"**, na plataforma (a posição
exata no menu segue a proposta #118, de menu e navegação).

### 3. Projeto › aba Orçamento (L4; amplia a aba já prevista em Projetos)

- **Quem usa e o que quer:** responsável pelo projeto, que quer ver o dinheiro do projeto contra o aprovado.
  **Primeira dobra:** a frase de situação ("O custo subiu 3% dos 5% permitidos" com `Etiqueta` "Dentro" ou "Fora
  da tolerância") e os números **planejado**, **realizado**, **restante**; ação principal: **"Sincronizar com o
  Orçamento"** (só aparece se há algo pendente).
- **Gráfico:** "A pergunta: o gasto do projeto está no ritmo do planejado?" `Linhas` com duas séries (planejado
  acumulado e realizado acumulado), por mês; título em conclusão ("Gasto está 3% acima do aprovado");
  `referencias` desenha o valor aprovado; leitura ao lado: o `Indicadores` do custo contra a tolerância e o que
  fazer ("Se passar de 5%, faça um pedido de mudança"). Sem realizado: o gráfico mostra só o planejado e diz
  "Nenhum gasto lançado ainda". Projeto no meio do ano: o eixo vai do início ao fim do projeto, com o mês atual
  marcado.
- **Tabela:** linhas do orçamento do projeto com grupo, fonte, atividade, planejado e realizado (`TabelaDados`);
  "gasto sem linha prevista" em `Aviso`.
- **Estados:** *sem serviço* (enxuto): `Aviso` "Escolha um serviço para o orçamento do projeto aparecer no
  Orçamento" com o botão "Escolher serviço". *Pendente de exercício:* `Aviso` "A parte de <ano> entra quando o
  exercício existir". *Orçamento indisponível:* `Aviso` descrito em O10. *Sincronizando:* `BotaoEnviar`
  "Sincronizando…". *Sincronizou:* notificação verde "Orçamento do projeto atualizado". *Recusada:* `Aviso`
  vermelho com o motivo do Orçamento (por exemplo, "A fonte escolhida foi desativada") e o que fazer.
- **Formulário da linha:** campos categoria, descrição, valor planejado, grupo, fonte e atividade (opcional); rótulo
  sempre visível; dica de formato ("Valor em reais, por exemplo 1.250,00"); obrigatórios marcados; em caso de erro,
  o que foi digitado fica na tela.
- **Ação sem volta:** cancelar ou parar o projeto (já prevista em Projetos) passa a explicar na confirmação:
  "As linhas ainda não gastas saem da previsão do serviço. O que já foi realizado continua." (`FormularioConfirmado`).
  Aprovar nova versão do Termo explica: "As linhas da versão anterior serão encerradas e as da nova entram no
  lugar."
- **Celular e teclado:** tabela rolável na horizontal com a primeira coluna fixa; o gráfico mostra "Ver os
  números"; ordem de foco: situação, números, ação, gráfico, tabela.

### 4. Orçamento › Informar realizado e Previsão (L4)

Na grade, as linhas de projeto aparecem agrupadas ("Projeto PRJ-0000") com o rótulo, e "Adicionar linha" ganha o
campo opcional "Projeto". Na Previsão, a linha de projeto é só leitura, com `Etiqueta` "Projeto PRJ-0000" e o link;
o total do exercício mostra "inclui R$ X de projetos aprovados depois da aprovação do exercício" (O4). Estados e
formulário seguem as telas atuais do Orçamento.

### 5. Requisição › Nova e Ajustar (L2)

- **Quem usa:** quem pede. Caminho: **nenhum clique a mais** para requisição sem projeto; com projeto, **+1
  escolha** ("Esta compra é de um projeto?"). Nenhum campo de valor ou grupo para quem pede.
- **Campos novos:** "Projeto" (lista só do que a pessoa vê, em implementação) e "Atividade" (opcional, aparece
  depois do projeto). Dica: "A atividade é opcional; informe se quiser ver o gasto por atividade no projeto".
  Com projeto que tem serviço, o centro de custo aparece travado ("O serviço vem do projeto"). Sem a lista
  (Projetos desligado ou sem projetos): o campo não aparece (G2).
- **Erro:** se o projeto deixou de estar em implementação antes de enviar, a mensagem diz "Este projeto não está
  mais em implementação. Escolha outro ou envie sem projeto." e **mantém tudo o que foi digitado**.
- **Celular:** os dois campos empilham; teclado na ordem: tipo, projeto, atividade, centros.

### 6. Requisição › Para aprovar (L2 e L6)

- **Quem usa e o que quer:** coordenação ou Diretoria, que quer decidir sabendo se há orçamento.
  **Primeira dobra:** os dados da requisição e, logo abaixo, o **cartão "Conferência do orçamento"** com o saldo
  do serviço (e do grupo, se informado) em `NumeroQueConta`; **ação principal:** **"Aprovar requisição"**;
  secundárias "Devolver" e "Recusar" (comentário obrigatório, como hoje).
- **Campos do cartão** (opcionais, só de quem aprova): "Valor estimado" e "Grupo de gasto"; dica: "Só para conferir
  o saldo. Fica registrado na requisição." Quem pediu vê o valor e o grupo informados, como parte da requisição.
- **Estados do cartão:** *com saldo*; *passa do previsto* (`Aviso` com ícone e texto, nunca só cor); *sem
  orçamento aprovado*; *sem permissão* ("Você não tem acesso ao orçamento deste serviço; a aprovação segue sem a
  conferência"); *Orçamento indisponível* ("O Orçamento não está ativo; a aprovação segue sem a conferência");
  *conferência da fonte ainda não disponível* (R8, até a L6).
- **Aviso de projeto:** quando a requisição é de projeto, o cartão mostra "Projeto PRJ-0000 · Atividade …:
  planejado R$ X, realizado R$ Y" para quem vê o projeto; para quem não vê, só o código e o título copiados.
- **Ação sem volta:** aprovar, devolver e recusar já existem; **nenhuma nova**. O aviso nunca impede o botão.
- **Gráfico:** nenhum nesta tela (são números de decisão, não tendência).

### 7. Requisição › Concluir (L2)

Campo novo opcional "Valor gasto (opcional)" ao concluir, com a dica "Aparece no projeto como compras ligadas;
não substitui o realizado do Orçamento". Mesmos botões de hoje.

### 8. Pedido de publicação › Novo e Ajustar (L3)

Campos novos opcionais "É sobre um projeto?" e "Serviço" (C1). Serviço travado quando vem do projeto. Área
preselecionada pela área do serviço. Sem Projetos ativo: o campo "Projeto" não aparece. Na revisão, a Comunicação
vê e pode trocar os dois (C2). Na lista e no detalhe do pedido, `Etiqueta` "Projeto PRJ-0000" quando houver.

### 9. Projeto › aba Comunicação (L3 e L5)

- **Quem usa:** responsável, que quer divulgar o projeto. **Primeira dobra:** o plano (lista de itens por
  momento) e a ação principal **"Criar pedidos de publicação"**; abaixo, as publicações já feitas.
- **Formulário de item:** momento, atividade (opcional), tipo de peça, título, descrição e data desejada; rótulo
  visível; dica "Escolha uma data de pelo menos X dias úteis à frente para não ser urgente" (X vem da antecedência
  da Comunicação, só se a Comunicação estiver ativa).
- **Estados:** *vazio* ("Nenhum item no plano. Adicione o lançamento do projeto." com o botão "Adicionar item");
  *criando* ("Criando pedidos…"); *criou* (notificação verde "N pedidos criados") e a coluna "Pedido" mostra o
  número; *parcial* (os itens sem pedido mostram o motivo, G2/C4); *Comunicação indisponível* (`Aviso`); *sem
  permissão* (a aba não aparece).
- **Ação sem volta:** "Criar pedidos de publicação" **cria registros em outro app** e explica na confirmação:
  "Serão criados N pedidos na Comunicação, em seu nome. Itens sem data não serão criados." (`FormularioConfirmado`).
  Desfazer é cancelar o pedido na Comunicação, como hoje.
- **Celular e teclado:** itens em cartões empilhados; ordem de foco: plano, ação, publicações.
- **Histórico:** as publicações aparecem na linha do tempo (C6) e, no relatório final, em seção "Publicações" (C7).

### 10. Melhorias de experiência de uso (sugestões, para a Diretoria decidir)

Não estão na proposta; **não entram** na construção sem a decisão da Diretoria.

1. **Início da Ficha com "o que pede ação"**: requisições esperando aprovação há mais de X dias, projetos fora da
   tolerância, pedidos urgentes de publicação do serviço, em uma faixa no topo.
2. **Atalho "Nova requisição deste serviço"** e "Nova ideia neste serviço" na Ficha, com o serviço já preenchido.
3. **Comparar com o ano anterior** no bloco de custo (já há o histórico no Orçamento).
4. **Imprimir a Ficha** (como a requisição já tem "Imprimir"), útil em reunião de coordenação.

## Fica de fora (vai para o `docs/roadmap.md`)

- Ligação de **Parcerias** a projetos, indicadores de beneficiários e Avaliação em projetos e evento de captação
  como projeto: onda 2 (issue #116). Agenda única e busca única: onda 3 (issue #117).
- **Valor na requisição pedido a quem pede** e **desconto automático das compras aprovadas no saldo** (precisa de
  cotação e preço na requisição).
- **Bloqueio** de aprovação por falta de saldo ou de fonte (a conferência é só aviso).
- **Remanejamento e suplementação** das linhas de projeto dentro do Orçamento (mudança só pelo pedido de mudança).
- **Cancelamento automático** dos pedidos de publicação quando o projeto é cancelado.
- Bloco de **Parcerias/termos** na Ficha do serviço (os termos do serviço), na onda 2.
- **Realizado por atividade** vindo do Orçamento (hoje só por projeto, e por atividade pelas compras ligadas).
- Avisos por e-mail, anexos e exportação em PDF (já no roadmap de cada app).
- Indicadores compartilhados e painel (issue #57).

## Frentes

- **Regras e dados**: `Ligacao<T>`, visões de ligação e portas de entrada em cada app; colunas novas; sincronização de
  linhas de projeto no Orçamento; cálculo de tolerância; plano de comunicação; testes de quem vê e quem altera.
- **Telas**: Ficha e lista de serviços; abas Orçamento e Comunicação de Projetos; cartão de conferência e campos novos
  em Requisições; campos novos em Comunicação; grade do realizado e Previsão do Orçamento. A frente telas inclui os
  gráficos (habilidade `graficos`).
- **Infraestrutura**: nenhuma chave nova. "Preparar estrutura" acrescenta as colunas e abas novas e liga
  `plataforma.servicos.ver`.
- **Núcleo, plataforma e módulos que mudam** (só nestes pontos): Núcleo (permissão `plataforma.servicos.ver`;
  contagem de vínculos ativos por serviço); `src/plataforma/ligacoes.ts` (novo) e `src/app/(elo)/servicos/` (novo);
  Projetos (abas, plano de comunicação, estado da sincronização); Orçamento (porta `sincronizarLinhasDeProjeto`,
  colunas `projeto_*`, `Realizado.projeto_id`, visões de ligação); Requisições (colunas, cartão, valor gasto);
  Comunicação (colunas, porta de criação de pedidos, visão de ligação); Avaliação (visão de ligação agregada do
  serviço). Nenhum módulo importa outro.

## Entregas

Proposta grande, dividida em 6 entregas, cada uma conferível na prévia. **Sugestão: uma issue por entrega**,
ligadas à #115, nesta ordem:

| # | Entrega | O que a Diretoria confere | Depende de |
| --- | --- | --- | --- |
| L1 | **Ficha do serviço** e lista de serviços, com os 7 blocos | Abrir um serviço e ver custo, vagas, projetos, requisições, publicações e avaliação; trocar de perfil e ver os blocos "sem permissão"; desligar um app e ver "indisponível" | — |
| L2 | **Requisição ↔ serviço e projeto**, com saldo (R1 a R7, R9) | Pedir compra ligada a projeto; aprovar vendo o saldo; concluir com valor gasto | Orçamento 1C.1 (pronta) |
| L3 | **Pedido de publicação ↔ projeto** (C1, C2, C6 parcial) | Ligar um pedido a um projeto; ver as publicações na aba do projeto | Projetos P1 (pronta) |
| L4 | **Projeto ↔ Orçamento** (O1 a O12) | Aprovar o Termo e ver as linhas no orçamento do serviço; cancelar e ver sair só o que não foi gasto; nova versão troca as linhas | Projetos P2, P3 e P4 |
| L5 | **Plano de comunicação cria pedidos** e publicações no relatório final (C3 a C8) | Criar pedidos do plano sem duplicar; relatório final com a lista de publicações | Projetos P3 e P5; L3 |
| L6 | **Conferência da fonte** na aprovação (R8) | Aviso de fonte e plano de aplicação antes de aprovar | Orçamento R3 |

L1 a L3 podem ser construídas **agora**; L4 a L6 esperam as entregas indicadas.

## Decisões tomadas sozinho (com o custo se estiverem erradas)

1. **Serviço obrigatório só a partir da Porta 2** (e não na ideia), no porte completo. A ideia ainda pode não saber
   o serviço. Custo se errado: baixo (mover a conferência para a Porta 1).
2. **Linha do orçamento do projeto leva grupo de gasto e fonte do cadastro do Orçamento**, em vez de texto livre,
   para a linha entrar no Orçamento sem reclassificar. Projeto sem serviço (enxuto) mantém só o texto. Custo se
   errado: médio (voltar ao texto e fazer o Financeiro classificar cada linha).
3. **Linhas de projeto entram como despesa aceita, sem passar pela aprovação do exercício**, porque a Porta 2 já foi a
   decisão da Diretoria; ficam só leitura no Orçamento e fora de remanejamento. Custo se errado: médio (acrescentar
   proposta e aprovação do Financeiro à entrada).
4. **Distribuição do valor em partes iguais nos meses do período** da atividade (ou do projeto). Custo se errado:
   baixo (o Financeiro vê o previsto por mês; trocar para distribuição digitada).
5. **Cancelado ou parado: o previsto dos meses anteriores ao cancelamento é mantido** (linha mantida) e o dos meses
   do cancelamento em diante sai. Custo se errado: baixo (mudar o mês de corte).
6. **O realizado do próprio projeto aparece a quem vê o projeto**, sem exigir `orcamento.execucao.ver`. Custo se
   errado: baixo (exigir a permissão na visão de ligação; o responsável perde o realizado na tela).
7. **Realizado do projeto marcado pelo Financeiro** na grade (`Realizado.projeto_id`), e **não** calculado a partir
   das requisições. Custo se errado: médio (ligar o realizado às compras exige preço na requisição).
8. **Tolerância de custo calculada sobre o valor aprovado, só para cima** (gasto acima do aprovado), com o ritmo só
   informativo. Custo se errado: baixo (mudar a fórmula; é cálculo em `dominio/` com teste).
9. **Quem aprova informa "Valor estimado" e "Grupo de gasto"** no cartão de conferência, porque a requisição não
   tem valor nem grupo (decisão de 04/11/2026 mantida para quem pede). Custo se errado: médio (sem esse
   preenchimento só há o saldo do serviço, sem "depois da compra").
10. **A conferência nunca bloqueia a aprovação** (é aviso), como o plano de aplicação no Orçamento. Custo se
    errado: baixo (acrescentar bloqueio configurável).
11. **Saldo não desconta as requisições aprovadas ainda não lançadas** (não há valor). O cartão diz isso. Custo se
    errado: médio (precisa do valor na requisição para comprometer saldo).
12. **Projeto com serviço trava o centro de custo da requisição em 100% naquele serviço.** Pedido que atenda mais de
    um serviço vira duas requisições. Custo se errado: baixo.
13. **Só projetos em implementação aparecem na requisição; qualquer projeto (menos rascunho de outra pessoa)
    aparece no pedido de publicação.** Divulgar começa antes de gastar. Custo se errado: baixo.
14. **O plano de comunicação cria pedidos por botão do responsável**, não sozinho na aprovação, e só para itens com
    data futura. Custo se errado: baixo (automatizar na aprovação do Termo).
15. **Pedido criado pelo plano nasce em nome do responsável e "Aguardando revisão"**, passando pelas regras normais.
    Custo se errado: baixo.
16. **Cópia congelada das publicações no relatório final** no envio, para o relatório sobreviver ao desligamento da
    Comunicação. Custo se errado: baixo.
17. **Pedidos de publicação não são cancelados quando o projeto é cancelado** (só um aviso ao responsável). Custo se
    errado: baixo.
18. **Valor gasto opcional informado por quem atende** e mostrado como "compras ligadas", separado do realizado
    oficial. Custo se errado: baixo (retirar o campo; é uma coluna).
19. **`plataforma.servicos.ver` como permissão nova**, dada a Diretoria, Financeiro e Leitura (global) e a
    Coordenação de serviço e Técnico avaliador (escopo). Custo se errado: baixo (trocar perfis).
20. **A Ficha não inclui termos de Parcerias** nesta onda; entra na onda 2 com as demais ligações de Parcerias.
    Custo se errado: baixo.
21. **Sem fila de eventos:** os efeitos em cadeia são chamados explicitamente pela plataforma (ADR-022). Custo se
    errado: médio (migrar para a ADR-005 quando houver vários efeitos por origem).

## Critérios de pronto (na prévia, com dados fictícios)

- **L1:** a Ficha de um serviço mostra os sete blocos com dados fictícios; com o perfil sem acesso ao Orçamento, o
  bloco de custo mostra "sem acesso" e nenhum número; com um app desligado, o bloco mostra "indisponível"; nenhum
  bloco traz nome de pessoa.
- **L2:** requisição ligada a projeto trava o serviço; só o projeto é obrigatório; quem aprova vê o saldo, e o aviso
  não impede aprovar; sem permissão do Orçamento, a aprovação segue sem a conferência.
- **L3:** pedido ligado a projeto aparece na aba do projeto, sem o nome de quem pediu.
- **L4:** aprovar o Termo coloca as linhas no orçamento do serviço sem redigitar; cancelar tira só o que não foi
  gasto; nova versão troca as linhas; repetir a sincronização não duplica; o projeto mostra "o custo subiu 3% dos 5%
  permitidos".
- **L5:** o botão cria um pedido por item com data futura, sem duplicar; o relatório final lista as publicações.
- **L6:** a aprovação mostra aviso de fonte e de plano de aplicação; sem R3, mostra a mensagem de "ainda não disponível".
- Nenhum texto de tela cita nome de instituição, unidade, marca ou cidade reais.
- Regras com testes, incluindo quem vê e quem altera e a repetição das portas de entrada; `npm run verificar` e
  `npm run build` verdes.

## Construção de L2 a L6 (issue #144)

- Situação: **detalhamento para construir; não muda nenhuma decisão aprovada** (seções acima, respostas 1.1 e 2.1 de
  13/11/2026). Sem dúvida pendente para a Diretoria. A #144 autoriza construir as entregas na ordem
  **L2, L3, L4, L5, L6**, cada uma em um PR de entrega, respeitando a coluna "Depende de" da tabela de Entregas.
  L4, L5 e L6 só começam quando o que elas esperam estiver no `main` (conferir no código antes de começar).
- **Estado em 14/11/2026, conferido no código:** L1 construída. Projetos tem só a P1 (etapas: rascunho, aguardando
  responsável, ideia, em porta, fase 1, parado, cancelado); a P2 está em PR aberto (#151). Não existe ainda projeto
  "em implementação". Orçamento tem o realizado (1C.1) e a leitura `custoDoServico`, mas **não tem** o rateio de
  fontes (R3). Requisições e Comunicação não têm nenhuma coluna de projeto.

### Como as ligações se constroem (vale para L2 a L6; ADR-022)

- **Nenhum módulo importa outro.** Requisições e Comunicação **não** leem Projetos nem Orçamento: a **plataforma**
  (`src/plataforma/ligacoes.ts`) lê o app dono do dado, com a permissão da pessoa, e entrega o resultado à tela do
  app que pede, como entrada da tela (lista de projetos para escolher, cartão de conferência). Cada app declara no
  `index.ts` só o formato do que recebe (por exemplo `ProjetoEscolhivel`: id, código, título, serviço e atividades).
- **O servidor sempre reconfere.** A lista mostrada na tela não vale como prova: ao gravar, a plataforma lê de novo
  e recusa projeto que a pessoa não vê ou que não aceita compra. Cada regra de recusa tem teste com id de projeto
  fora da lista.
- **Colunas novas** são declaradas nas abas que já existem (`definirTabela`) e entram em "Preparar estrutura";
  linhas antigas ficam com a coluna vazia e continuam válidas (teste com linha antiga).
- Toda gravação nova usa `inserir`/`atualizar` com a versão lida e `registrarAuditoria` com as colunas alteradas.

### L2 · Requisição ↔ serviço e projeto, com saldo (R1 a R7, R9)

| Peça | O que a construção entrega |
| --- | --- |
| Requisições (dados) | Colunas em `Requisicoes`: `projeto_id`, `projeto_codigo`, `atividade_id`, `valor_estimado`, `grupo_id`, `grupo_nome`, `valor_gasto`. Guarda o **código** do projeto também, para a lista não depender de ler Projetos |
| Projetos (leitura) | `projetosParaCompra(quem)` no `index.ts`: projetos que a pessoa vê, **em implementação**, com serviço e atividades não concluídas nem canceladas. Aceita projeto só se a etapa for a de implementação (função `aceitaCompra(etapa)` no domínio, para a regra morar num lugar só) |
| Orçamento (leitura) | `saldoParaConferencia(quem, servico, grupo?)`: previsto aprovado menos realizado até o último mês lançado, no serviço e no grupo; confere `orcamento.execucao.ver` no escopo do serviço e devolve "sem permissão" ou "sem exercício aprovado" como estados, nunca erro. Lista os grupos de gasto para o campo "Grupo de gasto" |
| Plataforma | Composição das duas leituras e dos três estados; a aba "Compras" do projeto (R9) usa uma leitura nova de Requisições, `comprasDoProjeto`, **sem o nome de quem pediu** |
| Telas | As da seção "Telas" 5, 6 e 7 desta especificação (Nova e Ajustar, Para aprovar, Concluir) |

**Regras de borda decididas na construção (sozinho):**

1. Enquanto nenhum projeto estiver em implementação (até P2 a P4 entrarem), a pergunta "Esta compra é de um
   projeto?" **não aparece** e a requisição funciona como hoje; o resto de L2 (saldo na aprovação, valor gasto ao
   concluir) já funciona e é conferido na prévia. Os testes do vínculo usam um projeto de teste em implementação.
2. O saldo do cartão é calculado na hora de abrir a tela, nunca guardado. O que fica gravado na requisição é só o
   que quem aprova informou (valor estimado e grupo), para conferir depois.
3. Quem aprova que muda o grupo ou o valor depois de aprovar não reabre nada: a requisição aprovada mantém o que
   foi gravado, e a mudança fica no histórico com as colunas alteradas.
4. Requisição ligada a projeto de **serviço diferente** do escolhido nos centros de custo é recusada no servidor
   (R3); o campo travado na tela é conforto, não proteção.
5. "Valor gasto" aceita só número maior ou igual a zero, com duas casas. Corrigi-lo depois é permitido a quem
   atendeu, até a requisição ser arquivada, com histórico.

### L3 · Pedido de publicação ↔ projeto (C1, C2, C6 parcial)

| Peça | O que a construção entrega |
| --- | --- |
| Comunicação (dados) | Colunas em `Pedidos`: `projeto_id`, `projeto_codigo`, `servico`, e (reservada para a L5) `plano_item_id`, vazia nesta entrega |
| Projetos (leitura) | `projetosParaPublicacao(quem)`: os que a pessoa vê, de qualquer etapa menos rascunho de outra pessoa e menos cancelado, com o serviço |
| Plataforma | Compõe a lista e reconfere ao gravar; a área vem preselecionada pela área do serviço (leitura do cadastro de serviços do Núcleo, que a Comunicação já recebe) |
| Comunicação (leitura) | `publicacoesDoProjeto(quem, projetoId)` para a aba "Comunicação" do projeto: número, título, tipo, situação, data publicada e link, **sem o nome de quem pediu** |
| Telas | Seção "Telas" 8 (Novo e Ajustar) e a lista da aba "Comunicação" do projeto (9, só a leitura; o plano e o botão ficam para a L5) |

**Regras de borda:** (1) a aba "Comunicação" do projeto só existe para quem vê o projeto e aparece vazia ("Nenhum
pedido de publicação ligado a este projeto") com o atalho "Pedir publicação sobre este projeto", que abre o
formulário já ligado; (2) as linhas "Publicação: <título>" no Histórico do projeto são calculadas na leitura
(C6), sem gravar nada; (3) projeto que a pessoa deixa de ver depois: o pedido mantém o vínculo, e quem pediu
continua vendo o próprio pedido, sem o nome do projeto, só com o código; (4) a troca de projeto e serviço na
revisão (C2) é auditada com as colunas alteradas.

### L4 · Projeto ↔ Orçamento (O1 a O12)

Começa quando Projetos P2, P3 e P4 estiverem no `main`. O Desenvolvedor, antes de começar, confere no código de
Projetos: a etapa de implementação, o Termo aprovado, `ProjetoOrcamento` (com grupo de gasto e fonte), as versões do
Termo e os pedidos de mudança. As regras O1 a O12 e as telas 3 e 4 são as da seção acima; esta entrega só precisa
fixar:

1. **Porta do Orçamento:** `sincronizarLinhasDeProjeto(projetoId, versaoDoTermo, linhas)`, idempotente pela chave
   (`projeto_id`, `linha_id`); chamar duas vezes com o mesmo Termo não duplica nem altera nada (teste).
2. **Quem chama:** a plataforma, no mesmo passo da aprovação da porta 2 e da aprovação de nova versão do Termo,
   e no cancelamento ou parada do projeto (1.1: sai só o que ainda não foi gasto). Se a porta falhar, o Termo
   **fica aprovado** e o projeto mostra "Orçamento ainda não atualizado" com o botão "Tentar de novo" ao
   responsável; nada se perde e repetir é seguro.
3. **Linhas do projeto no Orçamento são só leitura na Previsão:** a tela diz de quem são ("Vem do projeto PRJ-…") e
   leva ao projeto; mudar valor é pedido de mudança (ADR-022).
4. `Realizado.projeto_id` é opcional; lançamentos antigos ficam sem projeto.

### L5 · Plano de comunicação cria pedidos e publicações no relatório final (C3 a C8)

Começa com Projetos P3 e P5 e a L3 no `main`. Fixar na construção:

1. **Idempotência:** o par (`plano_item_id`) é a chave; o botão repetido devolve o número do pedido já criado.
   Dois responsáveis clicando ao mesmo tempo não duplicam: a segunda gravação encontra o pedido e devolve o número.
2. **Data "futura" (C4)** é comparada com a data de Brasília de hoje; hoje conta como futura.
3. A porta de criação da Comunicação confere as regras normais do pedido (antecedência, calendário, urgência) e
   **marca**, não bloqueia: pedido fora do calendário nasce "Aguardando revisão" com o aviso, como já acontece.
4. **Relatório final (C7):** a lista de publicações é copiada para o documento no momento do envio, junto com a data
   e hora da cópia; reenviar o relatório depois de ajustes **recopia** a lista. Publicações sem link aparecem só com
   o título e a data.
5. Comunicação desligada: o botão "Criar pedidos de publicação" fica desabilitado com o motivo, e o relatório final
   é enviado sem a lista, com a frase "Comunicação não ativa nesta instituição".

### L6 · Conferência da fonte na aprovação (R8)

Começa com o rateio de fontes R3 do Orçamento no `main`. Antes de construir, o Desenvolvedor lê a seção "Rateio de
fontes" de `src/modulos/orcamento/especificacao.md` e o que foi entregue; **não inventa** formato de plano de
aplicação. Fixar:

1. A leitura `fontesParaConferencia(quem, servico, grupo)` do Orçamento devolve, por fonte, saldo e **avisos
   prontos** (texto curto e o motivo), para a tela de Requisições só mostrar.
2. Sem R3 (ou sem plano de aplicação cadastrado para a fonte) o cartão mostra a frase da regra R8 e **nunca**
   "fonte pode pagar" nem "não pode". Teste para os dois casos.
3. Quem não tem `orcamento.execucao.ver` no serviço não vê a lista de fontes (mesmo texto de R4).
4. Ao entregar a L6, a Diretoria pode fechar a issue #60 (regra de "Antes de entregar": avisar no PR).

### Telas e usabilidade (L2, L3, L5 e L6)

A seção "Telas" (5 a 9) já descreve cada tela. O que a construção deve cuidar além dela:

- **Cartão de conferência (L2 e L6):** o aviso "passa do previsto" e os avisos de fonte aparecem **acima** do botão
  "Aprovar requisição", com texto e ícone (nunca só cor), e o botão **não** muda de nome nem fica desabilitado:
  é aviso, não bloqueio. O foco do teclado passa pelo cartão antes do botão.
- **Campos "Valor estimado" e "Grupo de gasto"** ficam recolhidos em "Conferir o saldo (opcional)", para quem aprova
  rápido não ter que rolar; o cartão mostra o saldo do serviço já ao abrir, sem digitar nada.
- **Celular:** o cartão vira uma pilha (serviço, saldo, fontes), sem tabela larga; os valores usam o componente de
  moeda existente em `src/ui/`. Se faltar alguma peça em `src/ui/`, é mudança no Núcleo e vai à Diretoria antes.
- **Estados:** sem permissão ("Você não tem acesso ao orçamento deste serviço; a aprovação segue sem a
  conferência"), sem exercício aprovado, sem fonte configurada e erro de leitura ("Não foi possível conferir o
  saldo agora; a aprovação segue sem a conferência") **nunca impedem** a aprovação.
- **Textos sem nome próprio:** exemplos, dicas e dados fictícios usam "instituição", "Sede", "serviço", conforme o
  `CLAUDE.md`.
- **Gráficos:** nenhum gráfico novo nesta onda além do planejado × realizado do projeto (tela 3), que segue a
  habilidade `graficos` como já descrito; L2, L3, L5 e L6 usam números e listas.

### Decisões tomadas sozinho na construção (com o custo se estiverem erradas)

1. **L2 entra antes de existir projeto em implementação**, com o campo de projeto escondido até lá. Custo se errado:
   baixo (esperar P2 a P4 para entregar a L2; o saldo e o valor gasto ficariam parados).
2. **Guardar o código do projeto junto do id** em Requisições e Comunicação, para listas e a aba do projeto não
   dependerem de ler Projetos. Custo se errado: baixo (coluna a mais; se o código mudar, mostra o antigo).
3. **Falha da porta do Orçamento não desfaz o Termo** (L4), com "Tentar de novo". Custo se errado: médio (se a
   Diretoria preferir tudo ou nada, a aprovação passaria a falhar junto, o que trava o projeto por problema do
   Orçamento).
4. **Relatório final recopia as publicações a cada envio** (L5). Custo se errado: baixo.
5. **Cada entrega é um PR separado**, sem esperar uma issue por entrega. Custo se errado: nenhum no código; só a
   rastreabilidade no quadro.

### Fica de fora (continua no `docs/roadmap.md`, seção "Ligações entre apps")

Nada novo além do que já está lá.

### Frentes

Iguais às da onda 1 (seção "Frentes"): regras e dados, telas e, sem chave nova, infraestrutura só com "Preparar
estrutura". Cada PR de entrega altera **só** os pontos da tabela da sua entrega acima; Núcleo, capacidades e outros
módulos só nos pontos já aprovados na seção "Frentes".

### Critérios de pronto (na prévia, com dados fictícios)

- **L2:** abrir uma requisição para aprovar e ver o saldo do serviço e o aviso "saldo sem as compras aprovadas ainda
  não lançadas"; informar grupo e valor e ver "depois desta compra"; entrar como quem não tem permissão do orçamento
  e ver a aprovação seguir sem a conferência; concluir com valor gasto.
- **L3:** pedir publicação ligada a um projeto, ver o serviço travado, ver o pedido na aba "Comunicação" do projeto
  sem o nome de quem pediu.
- **L4:** aprovar o Termo de um projeto fictício e ver as linhas no orçamento do serviço; cancelar e ver sair só o
  que não foi gasto; simular falha e ver "Tentar de novo".
- **L5:** criar os pedidos do plano duas vezes sem duplicar; enviar o relatório final com a lista de publicações.
- **L6:** ver o aviso da fonte antes de aprovar; sem rateio de fonte, ver a frase de espera.
- Em todas: `npm run verificar` e `npm run build` verdes e testes de quem vê e quem altera.
