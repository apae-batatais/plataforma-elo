# Especificação — Orçamento: Execução, Tesouraria e Histórico (Entregas 1C, 1D e 1E)

- Situação: **aprovada em 07/11/2026 pela Diretoria** (1D.2 detalhada em 17/11/2026, issue #186; construída em 20/11/2026)
- Dono do produto: Diretoria
- Complementa `especificacao.md` deste módulo. Detalha a Entrega 1C (Execução), que lá está só em
  resumo, e propõe duas entregas novas: 1D (Tesouraria) e 1E (Histórico). Depois de aprovada, entra
  no `especificacao.md` e este arquivo sai.
- Base: estudo das planilhas financeiras de 2016 a 2026 (projeto "Financeiro" no claude.ai), o painel
  provisório "Análise financeira da Apae Batatais" e a proposta de acompanhamento, revisão 3.
- Arquitetura: ADR-011. Planilha é só armazenamento; contas, regras, permissões e auditoria ficam no app.

## Revisão de 10/11/2026 — realizado informado à mão (issue #59)

Decisão da Diretoria (comentário de 09/11/2026): **a primeira versão da Execução não importa o WK Radar.
O realizado é informado manualmente.** A importação por modelo (ou por uma ferramenta que mapeia as colunas
com base na estrutura do Elo) fica no roadmap. Esta seção **substitui** a 1C.1 e ajusta a 1C.2 e a 1D.2;
onde houver conflito com o texto mais abaixo, vale esta seção. A pendência 1 (amostra do WK Radar) deixa de
bloquear a entrega.

### Entregas (substituem as linhas 1C.1, 1C.2 e 1D.2 da tabela "Entregas")

| Entrega | Conteúdo | Depende de |
| --- | --- | --- |
| **1C.1 — Informar o realizado** | Digitação do realizado por mês, em grade montada pela Previsão; tabela do ano | Previsão aprovada e Fontes (já existem) |
| **1C.2 — Painel de execução e recursos livres** | Orçado × realizado; recurso livre por serviço; adiantamentos e ressarcimentos; comparação com o ano anterior | 1C.1 |
| **1D.2 — Fim do ano e reserva** | Como na especificação; a conferência dos termos e do recurso livre (regras 16 e 17) entra aqui | 1D.1 e 1C.1 |

Sugestão: uma issue por entrega (1C.1, 1C.2, 1D.2), ligadas à #59, nesta ordem.

### Como o realizado é informado

O realizado é guardado **por mês, serviço, grupo de gasto, fonte e natureza** (totais mensais), não por
lançamento. O WK Radar tem milhares de lançamentos por ano e digitá-los um a um seria inviável; o Orçamento
já trabalha com totais por serviço, grupo e fonte (a Previsão e o Resumo da folha são assim).

A tela **Execução › Informar realizado** abre no mês anterior ao atual (como a tela Saldos do mês; lista dos
últimos 24 meses; mês futuro não é aceito) e mostra duas grades:

- **Despesas:** uma linha para cada combinação serviço × grupo × fonte da Previsão aprovada do ano, com o
  previsto do mês ao lado e um campo para o realizado.
- **Receitas:** uma linha para cada fonte com receita prevista no ano, com o previsto do mês e um campo para o
  realizado.
- **Adicionar linha:** para o que foi gasto ou recebido e não estava previsto (serviço, grupo, fonte, natureza).
  Gasto sem rateio vai para o serviço "Comum" (regra 12).
- **Observação** opcional por linha. Os totais (despesa, receita, resultado do mês) aparecem calculados
  enquanto a pessoa digita.

### Estudo da exportação do WK Radar (revisão da Diretoria de 10/11/2026)

Fonte: arquivo `REALIZADO DE 01-01 À 30-09-26.xlsx` (abas OFICIAL e POR ÁREA), lido fora do repositório; aqui
ficam só a estrutura, nomes de contas e de centros de custo e contagens, sem lançamentos. Nada disso muda o que
a 1C.1 constrói (digitação à mão); serve de base para a importação futura e para a grade falar a língua do
Financeiro.

**Aba OFICIAL (a exportação)**
- Sem linha de nomes de colunas. As linhas 1 a 6 trazem o período (texto) e os totais "Resultado" e "Entrada de
  Recursos". Colunas: A código reduzido, B classificação (`3.6.02.01`), C descrição, D valor (pode ser negativo).
- Duas seções: "Entrada de Recursos" e "Saída de Recursos" (marcadores sem A e B). Os mesmos códigos aparecem nas
  duas; **quem diz se é entrada ou saída é a seção**.
- Plano de contas em até 8 níveis (1 Ativo, 2 Passivo, 3 Despesas, 4 Receitas, 5 Produção da unidade agrícola).
  **Valores acumulados**: a conta-pai soma as filhas (somar tudo duplicaria).
- **Centro de custo é uma linha logo abaixo da conta de último nível**, classificação `8.xx.yy`, descrição com
  espaços à esquerda e código reduzido próprio. Há 179 contas detalhadas por centro; em 178 a soma bate com a
  conta e em 1 há R$ 0,01 de arredondamento. Toda conta de último nível de despesa (3) e receita (4) tem centro
  de custo; ativo, passivo e produção não têm.
- **Folha não aparece como despesa (3)**: está nas obrigações pagas, conta `2.1.03` (salários, previdência, FGTS,
  consignado), e a **área vem no código e no nome da conta** (ex.: `2.1.03.01.00018` Assistência Social, `.00019`
  Educação Especial, `.00020` Saúde, `.00021` Unidade de Vivências Ambientais, `.00022` Atividade Meio
  Sustentável, `.00023` Atividades Operacionais Administrativas, `.00024` Centro de Formação Profissional).
- Também saem como "saída de recursos": créditos e adiantamentos (`1.1.02`), imobilizado (`1.2.01`), impostos
  retidos (`2.1.02`) e projetos (`2.1.05` e `2.1.08`, com PRONAS), às vezes com valor negativo.

**Grupos de despesa (conta 3.6)**
- `3.6.01` Despesas Operacionais Administrativas: `.01` Recursos Humanos, `.02` Ordinárias, `.03` Financeiras,
  `.05` Eventos beneficentes, campanhas e ações.
- `3.6.02` Custos Operacionais de Programas e Atividades, por área: `.01` Assistência Social, `.02` Educação
  Especial, `.03` Saúde, `.04` Unidade de Vivências Ambientais, `.05` Projeto Centro de Formação Profissional.
- Abaixo disso há contas de natureza do gasto (ex.: "Alimentação") que **se repetem dentro de cada área**.
- `5.1.03` Produtos agrícolas: milho, soja e mudas.

**Centros de custo (58, em 8 grupos)**: `8.01` Assistência Social (4), `8.02` Educação (8), `8.03` Saúde (7),
`8.04` Unidade de Vivências/Apae Rural (produtivas `01.xx`, administrativo e manutenção `02.xx`, apoio à
Assistência Social `03.04`), `8.05` Associados e captação (associados, campanhas `04.xx`, comunicação), `8.06`
Administrativo (12), `8.10.01` Despesas a Classificar, `8.11` Formação Profissional (2). Os nomes têm erros de
digitação e espaços no começo: **o que identifica cada centro é a classificação `8.xx.yy` ou o código reduzido,
nunca o nome**.

**Aba POR ÁREA (feita à mão)**: reorganiza as saídas por área, separando **folha** e **custeio**, com subtotais,
um ajuste manual (reembolso de plano de saúde), despesas gerais com uma conta única para várias áreas (inclui
imobilizado) e projeções (provisão de dezembro, aumento de 15%, 2027 sem PRONAS). Seu total de saídas é **cerca de
R$ 166 mil maior** que o da OFICIAL; a origem **não foi esclarecida** e precisa ser explicada pela Diretoria antes
de a aba servir de referência. **Não serve de modelo de importação** (não segue estrutura fixa), mas mostra como a
Diretoria lê o realizado: por área, folha separada de custeio.

**O que o estudo muda na 1C.1**
1. A grade já traz serviço, grupo e fonte, que é o nível em que a Previsão e o Resumo da folha trabalham; o
   estudo confirma que o realizado do WK Radar só chega a esse nível passando por duas **tabelas de
   correspondência** (centro `8.xx.yy` → Serviço; conta de despesa → Grupo de gasto). Nenhuma das duas existe
   hoje e nenhuma é construída na 1C.1; ficam para a importação (roadmap).
2. Na digitação, a pessoa informa o realizado **por Serviço** (o centro de custo do Elo). Para a folha, o realizado
   do WK Radar vem **por área** (conta `2.1.03`), não por serviço: ver pendência abaixo.
3. Período: a exportação é acumulada (01/01 a 30/09), sem mês. A grade da 1C.1 é mensal; quem digitar a partir do
   WK Radar precisa de um relatório por mês ou da diferença entre dois acumulados.

**Pontos que dependem de decisão da Diretoria** (perguntados um por vez no PR e registrados aqui conforme
respondidos; ainda não decididos):
- P1. Correspondência centro de custo do WK Radar ↔ Serviço do Núcleo (os nomes não batem um a um; ex.: `8.01.07`
  "Assistência Social" é genérico da área).
- P2. Nível da conta `3.6` que vira Grupo de gasto (natureza, como "Alimentação", ou o nível 4).
- P3. Realizado da folha: informado por serviço (como a folha prevista) ou por área (como o WK Radar)?
- P4. "Despesas a Classificar" (`8.10.01`) ↔ serviço "Comum" ou fila "a classificar" da 1C.2.
- P5. O que conta como realizado: só despesas (3) e produção (5), ou também folha (`2.1.03`), imobilizado
  (`1.2.01`) e projetos (`2.1.05`, `2.1.08`), como faz a aba POR ÁREA.
- P6. Origem da diferença de cerca de R$ 166 mil entre as abas OFICIAL e POR ÁREA.

### Regras de negócio da 1C.1 (substituem as regras 1 a 4 e 7 originais; a 5 e a 6 continuam)

- R1. **Uma linha de realizado por mês, tipo (despesa ou receita), serviço, grupo, fonte e natureza.** Salvar de
  novo o mesmo mês **atualiza** a linha (com a versão lida); não cria linha duplicada. Valor zerado é aceito.
- R2. **Salvar o mês é tudo ou nada**, como nos saldos (decisões 7 e 8 da 1D.1): se outra pessoa alterou alguma
  linha desde que a tela abriu, nada é gravado e a pessoa é avisada. O que foi digitado e não salvo volta depois
  de um erro.
- R3. **Valor não pode ser negativo.** Estorno ou devolução é informado como valor menor, com observação.
- R4. **Natureza** de despesa: RH, encargos, custeio, investimento/obras, tarifas, adiantamento a termo. De
  receita: receita comum ou ressarcimento. O Elo sugere a natureza pelo grupo (campo `rh` do cadastro de
  Grupos); a pessoa pode trocar.
- R5. **Recurso livre** é todo realizado cuja fonte tem uso **livre** no cadastro de Fontes (1B).
- R6. **Não recorrente** (reforma da quadra, PIS recuperado etc.): marcação por linha, com motivo obrigatório.
  Continua nos totais, mas é separado nas comparações entre anos e nos cenários.
- R7. **Nenhum total é digitado:** resultado, execução e recurso livre são somas das linhas.
- R8. **Correção depois de salvar:** a pessoa altera o valor; a alteração é auditada (colunas alteradas, nunca
  valores). Nada é apagado: "Remover linha" encerra o registro (`ativo = FALSE`).
- R9. **Realizado de RH** é informado agregado por serviço (naturezas RH e encargos). Valor por pessoa nunca
  entra aqui; continua só na planilha `orcamento_folha`.
- R10. **O mês só pode ser informado se o exercício existe.** Sem Previsão aprovada, a tela avisa e só aceita
  linhas adicionadas à mão.
- R11. **Pendência na tela inicial do Orçamento:** mês fechado sem nenhum realizado informado ("Falta informar o
  realizado de outubro").
- R12. **Comparação com o ano anterior** só usa meses informados nos dois anos; mês não informado aparece como
  "sem dado", nunca como zero.
- R13. **Histórico vindo do realizado** (regra 25 original): o ano que passa a ter realizado no app usa o
  realizado, e não a importação do Histórico (1E).

As regras 8 a 12 (1C.2), 13 a 15 (1D.1) e 18 a 22 (1D.2) continuam, lendo as linhas de realizado em vez de
lançamentos. A conferência dos termos e do recurso livre (16 e 17) compara os saldos com o **realizado
informado** por fonte e só é confiável com todos os meses informados: a tela mostra "faltam meses" em vez de
uma diferença falsa.

### Permissões (1C.1)

| Perfil | Pode | Permissão |
| --- | --- | --- |
| Financeiro | Informar e corrigir o realizado | `orcamento.realizado.editar` (já existe) |
| Diretoria | Ver tudo | `orcamento.execucao.ver` |
| Coordenação de área | Ver só o realizado dos serviços do seu escopo (área ou serviço) | `orcamento.execucao.ver` (com escopo) |
| Leitura | Não vê a grade; vê só totais agregados | `orcamento.painel.ver` |

### Dados (1C.1)

Planilha `orcamento_execucao` (já existe). Aba nova **`Realizado`**, declarada com `definirTabela` e registrada
em "Preparar estrutura": `ano`, `mes` (AAAA-MM), `tipo`, `servico`, `grupo_id` (só despesa), `fonte_id`,
`natureza`, `valor`, `nao_recorrente`, `motivo_nao_recorrente`, `observacao`. Sem coluna pessoal (não há
fornecedor nem histórico de lançamento), portanto sem `sigilo`. As abas `Importacoes`, `Lancamentos` e
`RegrasClassificacao` **não são criadas nesta versão**; `Adiantamentos` fica para a 1C.2.

### Telas (1C.1)

1. **Execução › Informar realizado:** descrita acima, com o botão **Salvar mês** e aviso claro se o mês já
   tinha valores.
2. **Execução › Realizado do ano:** tabela mês a mês (despesa, receita, resultado) com "Ver os números" e
   marcação dos meses sem informação.
3. A Visão geral (1D.2) e o Painel geral (1B) só passam a mostrar números da Execução a partir da 1C.2.

Melhorias de experiência: a grade já vem montada pela Previsão, então a pessoa só digita valores; **Copiar
previsto** preenche o campo com o previsto do mês, para corrigir só o que diferiu; cada campo mostra a
diferença para o previsto em %.

### Fica de fora (desta revisão)

- Qualquer importação do WK Radar ou de planilha de realizado. **Vai para o roadmap**: importar o realizado a
  partir de um modelo, ou criar uma ferramenta que mapeia as colunas com base na estrutura do Elo. Quando
  existir, as linhas entram na mesma aba `Realizado`.
- Lançamento por lançamento (fornecedor, documento, histórico), fila "A classificar", regras de classificação
  e auditoria de leitura de fornecedor pessoa física (regras 3 e 29 originais).

### Frentes

`telas` (grade de digitação, tabela do ano) e `regras e dados` (aba `Realizado`, casos de uso, permissões,
auditoria, testes). Sem `infraestrutura` na 1C.1: a planilha `orcamento_execucao` e a chave em `PLANILHAS`
já existem.

### Critérios de pronto (1C.1)

- [ ] Testes das regras R1 a R13, incluindo quem vê e quem altera (Coordenação só o seu escopo; Leitura não vê a grade)
- [ ] Salvar o mesmo mês duas vezes não duplica linhas; alteração concorrente não grava nada
- [ ] "Preparar estrutura" cria a aba `Realizado`
- [ ] Na prévia, com a demonstração: o Financeiro informa um mês, vê os totais calculados e altera um valor
- [ ] `npm run verificar` e `npm run build` verdes

### Decisões tomadas sozinho nesta revisão

1. **Realizado por totais mensais, não por lançamento.** Se a Diretoria quiser o detalhe (fornecedor,
   documento), é preciso a aba `Lancamentos` e a importação: custa uma entrega nova, sem perder o digitado.
2. **Valor negativo não é aceito.** Se errada, basta trocar a validação.
3. **Natureza obrigatória em cada linha**, sugerida pelo grupo. Se não for útil, vira coluna opcional.
4. **Sem aba `Adiantamentos` na 1C.1**; ela chega na 1C.2, quando o painel precisar.

## Revisão de 17/11/2026 — Entrega 1D.2 detalhada (issue #186)

A 1D.2 foi aprovada em 07/11/2026 e ajustada em 10/11/2026. Com a 1C.1 (realizado informado à mão) e a 1D.1
(contas e saldos) já construídas, esta seção diz **como a 1D.2 é construída em cima do que existe**. Onde houver
conflito com as regras 16 a 22 mais abaixo, vale esta seção. A Diretoria já respondeu "Ok" na issue; nenhuma
decisão nova foi pedida (as faixas e o "N meses" continuam como **propostos**, e só valem depois de aprovados na
própria tela Reserva).

**A 1D.2 não espera a 1C.2.** Tudo o que ela precisa vem de `Realizado`, `Saldos`, `Contas` e da Previsão.
Adiantamentos (aba da 1C.2) não entram; quando a 1C.2 existir, o cartão "adiantamentos em aberto" é
acrescentado à Visão geral por ela.

### Conteúdo da entrega

| Parte | O que a pessoa ganha | Tela |
| --- | --- | --- |
| Conferências (regras 16 e 17) | Saber, mês a mês, se o saldo do extrato bate com o realizado informado | Tesouraria › Conferência |
| Fim do ano (regras 18 e 19) | Quanto sobra ou falta em 31/12, em três cenários | Tesouraria › Fim do ano |
| Reserva (regras 20 e 21) | Aprovar o mínimo da reserva e os pedidos de uso | Tesouraria › Reserva |
| Visão geral (regra 22) | Seis sinais (ok, atenção, crítico) numa tela só | Visão geral |

Como a entrega tem quatro telas, o Desenvolvedor faz uma tarefa e um commit por parte, nesta ordem:
Conferência → Fim do ano → Reserva → Visão geral (a Visão geral usa os resultados das outras).

### Regras de negócio da 1D.2 (com teste)

Os números são sempre em centavos exatos (como `totaisPorClasse`). Nenhum total é digitado.

**Conferência dos termos (regra 16)**

- C1. Para cada conta **vinculada** ativa e cada mês: **saldo do mês** (extrato + ajustes de conciliação, como na 1D.1)
  − (**saldo do mês anterior** + receita da fonte da conta no mês − despesa da fonte da conta no mês). A fonte é a da
  conta (`fonte_id`); vale a classe e a fonte que a conta tinha **naquele mês** (`MudancasClasse`).
- C2. **Diferença diferente de zero** é alerta; zero é "confere". A tela mostra o saldo do mês, o saldo anterior,
  as entradas, as saídas e a diferença, para a pessoa ver de onde veio.
- C3. **Sem dado, sem diferença falsa:** se faltar o saldo do mês, o saldo do mês anterior ou o realizado do mês
  (nenhuma linha informada), a linha diz "faltam dados: saldo de agosto" (diz o que falta) e não calcula. Nunca
  mostra zero no lugar de "sem dado".
- C4. Duas contas vinculadas com a mesma fonte são conferidas **somadas** (a fonte é uma só no realizado); a
  linha mostra as contas juntas.
- C5. Pendência da Visão geral: quantidade de meses (do ano em andamento) com diferença; cada pendência leva à
  conferência do mês.

**Conferência do recurso livre (regra 17)**

- C6. **Variação do saldo livre no mês** = (livre disponível + reserva do mês, com ajustes) − (o mesmo no mês
  anterior). **Resultado do recurso livre no mês** = receita − despesa das linhas de `Realizado` cuja fonte tem uso
  `livre` (regra R5 da 1C.1). **Diferença** = variação − resultado.
- C7. Mesma regra de "sem dado" (C3). Diferença diferente de zero fica à vista para ser explicada: o Elo **não
  corrige nada** e **não aceita justificativa digitada** (transferência para conta vinculada, rendimento e tarifa
  aparecem como diferença e a pessoa registra o motivo em "Ajuste de conciliação" na tela Saldos do mês, que já existe).
- C8. Ver as conferências: `orcamento.tesouraria.ver` (Diretoria e Financeiro). Coordenação e Leitura não veem
  (a conferência mostra saldos).

**Fim do ano (regras 18 e 19)**

- F1. **Ponto de partida:** o **último mês do ano em andamento com saldo** das contas livres (disponível + reserva,
  com ajustes). O "saldo livre" desta tela **inclui a reserva** (a folga da regra 19 desconta a reserva).
  Sem nenhum saldo no ano: a tela diz "informe os saldos do mês" e não mostra cenário.
- F2. **Cenário "repetir o ano anterior"** e **"repetir dois anos antes"**: saldo do ponto de partida + **resultado do
  recurso livre dos meses depois do ponto de partida até dezembro** no ano de referência (receita − despesa das linhas
  de `Realizado` com fonte livre). Cada um sai **com** e **sem** não recorrentes (a marcação `nao_recorrente` da 1C.1);
  "sem" tira as linhas marcadas. São quatro números ao todo.
- F3. **Cenário "pela Previsão":** receita livre prevista − despesa livre prevista dos meses depois do ponto de
  partida até dezembro, somada ao saldo do ponto de partida. Usa a Previsão aprovada do ano (sem cedidos: cedido não
  tem dinheiro, ver C2 de cedidos).
- F4. **Ano de referência sem os meses informados:** o cenário mostra "sem dado" (os meses faltantes são listados),
  nunca zero. Dado parcial **não** é completado com estimativa. No primeiro ano de uso da Execução, só o cenário da
  Previsão aparece; é esperado.
- F5. **Folga** = saldo livre previsto em dezembro − **reserva atual**, onde reserva atual = saldo da classe reserva
  no ponto de partida. Folga negativa mostra "seria preciso usar a reserva em R$ X".
- F6. A decisão de qual cenário alimenta o sinal "Fim do ano" é fixa: **"repetir o ano anterior" com não recorrentes**
  (regra 22). Os outros são informativos.
- F7. Ver: `orcamento.tesouraria.ver`.

**Reserva (regras 20 e 21)**

- R1. **Mínimo da reserva** = N × **folha média mensal do ano**. A folha média é o **custo de RH e encargos da
  Previsão aprovada do ano ÷ 12** (sem cedidos). N começa em 2 (parâmetro com vigência).
- R2. **Política** é uma linha da aba nova `PoliticaReserva` com vigência (mês de início): N meses e as faixas dos
  seis sinais (regra 22). Só inclusões; a mais recente com situação `aprovada` e vigência até o mês vale. **Proposta**
  é registrada pelo Financeiro (`orcamento.tesouraria.editar`); só vira `aprovada` quando a Diretoria aprova
  (`orcamento.reserva.aprovar`). Sem política aprovada, a Visão geral usa as faixas de fábrica (as da tabela da
  regra 22) para os sinais que não dependem da reserva, avisando "faixas ainda não aprovadas", e o sinal Reserva
  fica "sem política aprovada".
- R3. **Quem propõe não aprova** o próprio pedido: o Autorizador recusa se a mesma pessoa tem as duas permissões
  (hoje só a Diretoria tem a de aprovar, mas a regra protege perfis futuros).
- R4. **Uso da reserva** é um pedido na aba nova `UsosReserva`: valor, motivo, mês do pedido e **prazo de
  recomposição** (mês). Valor maior que zero e maior que o saldo da reserva do último mês com saldo é recusado.
  Situações: `pedido` → `aprovado` ou `recusado` (decisão da Diretoria, com motivo obrigatório na recusa) → `recomposto`
  (o Financeiro marca quando devolveu, com o mês). O pedido não move saldo: o saldo continua vindo do extrato
  digitado na Tesouraria; o uso aprovado serve de autorização e de lembrete.
- R5. **Prazo de recomposição vencido** (aprovado, não recomposto, mês atual depois do prazo) é pendência da
  Visão geral e vira alerta na tela Reserva.
- R6. **Nada é apagado.** Pedido errado é "cancelado" pelo próprio Financeiro enquanto está em `pedido`
  (encerra: `ativo = FALSE`). Depois de decidido, não muda; correção é um pedido novo.
- R7. Toda gravação é auditada com as colunas alteradas (nunca os valores). **Aprovar ou recusar** registra a
  decisão (quem e quando ficam em `atualizado_por` e `atualizado_em`). Abrir a tela Reserva não precisa de
  auditoria de leitura (sem dado pessoal).
- R8. Ver a política e os pedidos: `orcamento.tesouraria.ver`. Diretoria aprova e recusa; Financeiro propõe, pede,
  cancela e marca recomposição; Coordenação e Leitura não veem.

**Sinais da Visão geral (regra 22)**

- S1. Seis sinais, na ordem do mais grave para o mais tranquilo (crítico, atenção, ok, sem dado). Cada um mostra
  valor, situação **escrita** (não só cor), a regra em uma linha com as faixas em vigor e "Ver detalhes".
- S2. **Livre disponível** = saldo da classe livre disponível do último mês com saldo ÷ **gasto médio mensal com
  recurso livre** (despesa de fonte livre do Realizado ÷ meses informados do ano). Sem saldo ou sem realizado:
  "sem dado".
- S3. **Fim do ano** = folga do cenário de F6.
- S4. **Execução** = (receita − despesa realizadas até o último mês informado) − (receita − despesa previstas até o
  mesmo mês). A faixa "atenção" vai até −5% da receita prevista no mesmo período.
- S5. **Folha sobre a receita** = custo de RH e encargos ÷ receita, **realizados** no ano até o último mês informado;
  sem realizado, **previsto** do ano com a marca "previsto". (Regra de 27/10/2026: ok ≤ 60%, atenção até 65%.)
- S6. **Gasto com recurso livre** = (variação % da despesa de fonte livre) − (variação % da receita livre recorrente)
  contra o mesmo período do ano anterior, em pontos percentuais; só meses informados **nos dois anos** e sem não
  recorrentes (R12 da 1C.1); sem ano anterior, "sem dado".
- S7. **Reserva** = saldo da classe reserva ÷ mínimo aprovado (R1 e R2).
- S8. **Quem vê quais:** Diretoria e Financeiro veem os seis. Quem só tem `orcamento.painel.ver` (Leitura) vê
  **apenas** os sinais de execução, folha sobre a receita e gasto com recurso livre (não dependem de saldo); os de
  saldo (livre disponível, fim do ano, reserva) **nem aparecem**, para não sugerir que o valor é zero. Coordenação
  não vê a Visão geral (ela vê o realizado do seu escopo em Execução).
- S9. As faixas de cada sinal vêm de `PoliticaReserva` (R2); a classificação é uma função pura que recebe o valor e
  as faixas. Valor exatamente na fronteira conta como a situação **melhor** (ex.: 3,0 meses é ok).
- S10. Cada sinal mostra de que dado veio e até quando ("saldos até setembro", "realizado até outubro"). Dado mais
  velho que o mês anterior ao atual aparece com aviso "desatualizado".

### Dados (1D.2)

Planilha `orcamento_execucao` (já existe), sem coluna pessoal (não há `sigilo`). Duas abas novas, declaradas com
`definirTabela` e registradas em "Preparar estrutura":

- **`PoliticaReserva`**: `vigencia` (AAAA-MM), `meses_minimo`, `situacao` (`proposta`, `aprovada`, `recusada`),
  `motivo` (obrigatório na recusa) e as faixas: `livre_ok`, `livre_atencao` (meses), `fim_ok` (R$), `exec_atencao`
  (% da receita prevista), `folha_ok`, `folha_atencao` (%), `gasto_ok`, `gasto_atencao` (pontos), `reserva_ok`,
  `reserva_atencao` (%). Só inclusões; a decisão atualiza `situacao` e `motivo` da própria linha, auditada.
- **`UsosReserva`**: `mes_pedido`, `valor`, `motivo`, `prazo_recomposicao` (AAAA-MM), `situacao` (`pedido`,
  `aprovado`, `recusado`, `recomposto`), `motivo_decisao`, `mes_recomposicao`.

Nada de `Saldos`, `Contas`, `Realizado` ou `Historico` muda.

### Permissões (1D.2)

| Perfil | Pode | Permissões |
| --- | --- | --- |
| Diretoria | Ver tudo; aprovar a política e os usos da reserva | `orcamento.reserva.aprovar` (**nova**) mais as que já tem |
| Financeiro | Ver; propor política; pedir, cancelar e marcar recomposição | já tem `tesouraria.ver` e `tesouraria.editar` |
| Leitura | Só 3 sinais da Visão geral | já tem `painel.ver` |
| Coordenação | Nada novo | — |

Mudança no Núcleo: **nenhuma**. A permissão nova é declarada no manifesto do módulo e ligada ao perfil Diretoria
por "Preparar estrutura", como as da 1D.1.

### Telas (1D.2)

Menu do Orçamento: grupo **Tesouraria** ganha "Conferência", "Fim do ano" e "Reserva"; a **Visão geral** entra no topo
do grupo **Painéis**, e vira a primeira tela do módulo para quem tem `tesouraria.ver` ou `painel.ver` (hoje abre o
Resumo da folha; a mudança é só do ponto de entrada do módulo, e quem não vê a Visão geral continua como está).
Componentes de `src/ui/` (nenhum novo, nenhuma mudança no Núcleo): `Pagina`, `NumeroQueConta`, `Indicadores`,
`Linhas`, `BarrasAgrupadas`, `TabelaDados`, `Aviso`, `Botao`, `BotaoEnviar`, `Campo`, `Confirmar`, `SeletorMes`
(já usado em Saldos), `EstadoVazio`.

**1. Visão geral** — *Quem:* Diretoria e Financeiro querem saber "estamos bem?". *Caminho:* abrir o app, 0 cliques
até a resposta; 1 clique em "Ver detalhes" para a causa.
- Primeira dobra: faixa de pendências (se houver) com atalhos ("2 contas sem saldo em outubro · Informar saldos";
  "1 termo com diferença · Conferir"; "Falta informar o realizado de outubro"; "Recomposição da reserva vencida"),
  depois os sinais do mais grave ao mais tranquilo. Ação principal: a primeira pendência.
- Cada sinal é um cartão: nome, `NumeroQueConta` com o valor e o período, situação escrita, a regra e as faixas em
  uma linha. Sinal baseado em meta ainda não aprovada leva "faixa proposta, ainda não aprovada".
- Estados: **vazio** (sem saldos e sem realizado) "A Visão geral aparece depois que você informar os saldos do mês e
  o realizado" com botões para as duas telas; **erro** de leitura: o `Aviso` padrão e "Tentar de novo"; **sem
  permissão**: o menu nem mostra; a rota direta mostra a tela padrão de sem permissão.
- Celular: cartões empilham em uma coluna; ordem de teclado é a ordem na tela.
- Sem formulário e sem ação sem volta.

**2. Tesouraria › Conferência** — *Quem:* Financeiro, para fechar o mês; Diretoria, para ver se confere.
*Caminho:* Visão geral → pendência → conferência já no mês (1 clique).
- Seletor de mês (como em Saldos; abre no mês anterior ao atual; 24 meses). Dois blocos: "Termos (contas
  vinculadas)" e "Recurso livre". Cada linha tem a conta ou a fonte, os valores da conta e a diferença, com
  "confere" (ícone e texto), "diferença de R$ X" ou "faltam dados: <o quê> · Informar".
- Estado vazio: sem conta vinculada, "Nenhuma conta vinculada. Cadastre em Contas" (só o bloco de recurso livre
  aparece). Sem ação de gravar nesta tela; o atalho "Ajuste de conciliação" leva à tela Saldos do mês.
- Mobile: tabela com rolagem horizontal e a coluna da diferença fixa à direita.

**3. Tesouraria › Fim do ano** — *Quem:* Diretoria, "vai sobrar ou faltar?". *Caminho:* menu, 1 clique.
- Primeira dobra: `NumeroQueConta` "Folga prevista em dezembro" (cenário do sinal) com a frase "Se 2026 se repetir
  como 2025 (com não recorrentes), sobram R$ X acima da reserva" (ou "faltam", com o aviso de uso da reserva); abaixo,
  `Linhas` do saldo livre mês a mês do ano atual e dos dois anteriores, com a reserva como linha de referência
  (até 3 séries de ano, `ano-1` a `ano-3`); título em forma de conclusão ("O saldo livre fecha o ano acima da
  reserva"/"abaixo da reserva"). Mês sem saldo é buraco na linha, não zero. Ano em andamento marcado "parcial".
- Tabela de cenários (`TabelaDados`): cenário, saldo previsto em dezembro, folga; as quatro de F2 e a de F3; "sem dado"
  com o motivo. "Ver os números" já vem do gráfico.
- Estado vazio e erro como na Visão geral; sem formulário.

**4. Tesouraria › Reserva** — *Quem:* Diretoria aprova; Financeiro propõe e pede. *Caminho:* 2 cliques
(abrir, "Aprovar").
- Primeira dobra: política em vigor (N meses, mínimo em R$, reserva atual e % do mínimo no `Indicadores`, meta 100%),
  proposta pendente de aprovação (se houver) com **Aprovar política** e **Recusar** (Diretoria), e **Pedir uso da
  reserva** (Financeiro).
- Formulário "Pedir uso da reserva": **Valor (R$)**, **Motivo**, **Recompor até (mês)**, todos obrigatórios, com a
  dica de formato ("1.500,00", "mês/ano"); rótulo sempre visível; erro por campo, e **o que a pessoa digitou fica**.
  Formulário "Propor política": **Meses de folha** e as faixas, já preenchidos com os valores em vigor.
- **Ação sem volta:** aprovar a política e aprovar o uso (a decisão não se desfaz; corrigir é um novo pedido).
  `Confirmar` explica: "Aprovar o uso de R$ X da reserva até a recomposição em <mês>. Isso não pode ser desfeito;
  se mudar de ideia, será preciso um novo pedido." Recusar pede motivo.
- Lista de usos com situação escrita, recomposição vencida em destaque (ícone e texto), e "Marcar como recomposto"
  (Financeiro).
- Estados: vazio "Nenhum pedido de uso da reserva"; gravando: botão desabilitado com "Gravando…"; gravou: `Aviso`
  de sucesso "Pedido enviado para a Diretoria"; erro e sem permissão como nas outras telas. Quem não aprova nem vê
  os botões de decisão.
- Celular: formulários em uma coluna; ordem de teclado: valor, motivo, mês, enviar.

**Gráficos:**
- *Fim do ano:* pergunta "o saldo livre vai cobrir a reserva em dezembro?"; forma `Linhas` (evolução no tempo, poucas
  séries); valores `moeda`; séries: ano atual, ano anterior e dois anos antes (3); leitura ao lado: a folga e o que
  fazer ("se for negativa, peça o uso da reserva ou reduza gasto livre"); sem dados: `EstadoVazio` e, com ano
  parcial, o rótulo "parcial".
- *Reserva:* `Indicadores` (percentual contra o mínimo, `referencia.sentido: 'desde'`, 100%).

**Melhorias de experiência sugeridas (não pedidas; a Diretoria decide):**
1. Na Visão geral, "Copiar o resumo" para colar em e-mail ou ata do Conselho.
2. Avisar por e-mail à Diretoria quando um pedido de uso da reserva é feito (hoje ela só vê ao abrir a tela).
3. Em Conferência, "Marcar como explicada" com um texto curto, para a diferença que se repete todo mês (rendimento,
   por exemplo) não aparecer vermelha para sempre. **Fica fora desta entrega** porque exige uma aba nova e uma
   regra de "explicação" que a Diretoria ainda não definiu.

### Fica de fora (1D.2)

- Adiantamentos e ressarcimentos (1C.2); a Visão geral ganha o cartão quando existirem.
- Projeção por caixa semanal, simulação de "e se" e metas por serviço.
- Mover saldo automaticamente ao aprovar o uso da reserva; o saldo continua digitado do extrato.
- Explicação digitada da diferença (melhoria 3) e e-mail de aviso (melhoria 2).
- Painel geral da 1B usando os sinais (continua no roadmap).

### Frentes

`telas` (Visão geral, Conferência, Fim do ano, Reserva; gráficos da Fim do ano e da Reserva) e `regras e dados`
(regras puras em `dominio/` para conferências, cenários, mínimo e sinais; casos de uso em `aplicacao/`; abas
`PoliticaReserva` e `UsosReserva`; permissão nova; auditoria; testes). Sem `infraestrutura`: a planilha e a chave
`orcamento_execucao` já existem.

### Critérios de pronto (1D.2)

- [ ] Testes de cada regra C1 a C8, F1 a F7, R1 a R8 e S1 a S10, incluindo quem vê e quem altera
- [ ] Teste de acesso: Coordenação não vê Conferência, Fim do ano nem Reserva; Leitura vê só os 3 sinais sem saldo
- [ ] Quem propõe não aprova (R3); pedido decidido não muda (R6)
- [ ] Fronteira dos sinais (valor exatamente na faixa) e dado ausente nunca vira zero
- [ ] "Preparar estrutura" cria as duas abas e liga `orcamento.reserva.aprovar` à Diretoria
- [ ] Na prévia, com a demonstração: a Diretoria abre a Visão geral, aprova uma política proposta e um uso da
      reserva; o Financeiro vê a diferença de um termo e os cenários do fim do ano
- [ ] `npm run verificar` e `npm run build` verdes

### Decisões tomadas sozinho nesta revisão

1. **Cenários de fim do ano vêm do realizado** (resultado do recurso livre dos meses que faltam nos dois anos
   anteriores), não da variação dos saldos. Motivo: só o realizado tem a marca "não recorrente" e só ele existe mês a
   mês nos anos que o Elo já tem. *Custo se errada:* se a Diretoria preferir variação dos saldos, troca-se a função de
   resultado por uma de saldos; muda um arquivo de regras e os testes, e os anos sem saldos mensais ficam "sem dado".
2. **"Saldo livre" do fim do ano inclui a reserva**, e a folga desconta a reserva atual (como a regra 19 já diz).
   *Custo:* se a Diretoria quiser a folga só do disponível, é um parâmetro.
3. **Folha média do mínimo da reserva = RH e encargos da Previsão aprovada ÷ 12**, não o realizado. Motivo: a
   referência de 2 meses (R$ 930 mil) foi calculada assim e não oscila com meses faltando. *Custo:* trocar a base é
   trocar uma função.
4. **A Visão geral é o ponto de entrada** para quem vê saldos ou painel, no lugar do Resumo da folha. *Custo:* se não
   agradar, volta a rota inicial; nenhum dado é afetado.
5. **Leitura não vê os sinais de saldo** (nem como "sem dado"). *Custo:* se a Diretoria quiser o Conselho vendo tudo,
   é dar `tesouraria.ver` ao perfil, o que também abre as telas de saldos (decisão 4 das "Decisões pedidas").
6. **Pedido de uso da reserva não move saldo** e fica fora do cálculo da folga. *Custo:* se errada, passa a ser
   abatido no cenário, uma linha de código.
7. **Conferência por mês**, sempre contra o mês anterior, e contas vinculadas da mesma fonte somadas (C4). *Custo:*
   se a Diretoria quiser por conta isolada, é separar a soma.
8. **Faixas dentro da própria linha da política** (colunas), e não numa aba de parâmetros solta, para a Diretoria
   aprovar tudo junto. *Custo:* nova faixa vira coluna nova.

## Objetivo

Hoje o acompanhamento financeiro depende de quatro planilhas redigitadas a partir do WK Radar:
Realizado por Área, Pagamentos com Recurso Livre, Saldos e Previsão. O objetivo é levar esse
acompanhamento para dentro do Orçamento, para que a Diretoria responda num só lugar, sem redigitação:

1. **Execução:** quanto foi gasto e recebido, por serviço, grupo e fonte, contra o previsto.
2. **Recursos livres:** quanto de recurso livre cada serviço consome e quanto falta ressarcir dos termos.
3. **Tesouraria:** quanto há em cada conta, quanto está livre, quanto é reserva e quanto é vinculado.
4. **Fim do ano:** se o saldo livre chega a dezembro sem usar a reserva.
5. **Histórico:** como receitas, despesas, folha, fontes e saldo livre evoluíram desde 2017.

## Por que (o que o estudo mostrou)

| Achado | Número |
| --- | --- |
| Saldo livre em queda desde o pico | R$ 2,29 mi (jan/2024) → R$ 1,48 mi (set/2026), −35% |
| Livre disponível, sem a reserva | R$ 268,7 mil em set/2026, cerca de 1,3 mês do gasto médio com recurso livre |
| Fim de 2026, se repetir o fim de 2025 | Seria preciso usar cerca de R$ 193 mil da reserva |
| Gasto com recurso livre, jan–ago 2026 × 2025 | +22,8%, contra +5,7% da receita livre recorrente |
| Folha × receita, 2022 → 2025 | Folha +62%, receita +53%; folha em 64% da receita (referência: 65%) |
| Peso dos recursos próprios na receita | 33,7% (2022) → 23,8% (2025) |
| Nota Fiscal Paulista | R$ 303 mil (2024) → R$ 65 mil (2025), −79% |
| Qualidade dos dados | Totais digitados à mão, fórmulas que deixam linhas de fora (em 2025 e 2026), versões duplicadas, adiantamentos aos termos em linhas soltas |

A causa comum dos problemas de dados é a redigitação. O app deve **importar** o que vem do WK Radar
e **calcular** todos os totais.

## Entregas

| Entrega | Conteúdo | Depende de |
| --- | --- | --- |
| **1C.1 — Importar o realizado** | Importação dos lançamentos do WK Radar com DE-PARA; fila "a classificar"; regras de classificação reaproveitadas | Amostra da exportação do WK Radar |
| **1C.2 — Painel de execução e recursos livres** | Orçado × realizado; recurso livre por serviço; adiantamentos e ressarcimentos; comparação com o ano anterior | 1C.1 |
| **1D.1 — Contas e saldos** | Cadastro das contas (livre disponível, reserva, vinculada); saldo do extrato por mês; ajustes de conciliação. A conferência dos termos (regras 16 e 17) ficou para depois da 1C.1 (decisão de 07/11/2026) | — (pode começar antes da 1C) |
| **1D.2 — Fim do ano e reserva** | Cenários para 31/12; política de reserva com aprovação; sinais da visão geral | 1D.1 e 1C.1 |
| **1E — Histórico** | Importação dos anos fechados (2017–2025) das planilhas de Previsão; indicadores históricos; fontes de receita ano a ano | Cadastro de fontes (1B, já existe) |

Ordem sugerida: **1D.1 → 1E → 1C.1 → 1C.2 → 1D.2**. A 1D.1 e a 1E não dependem do WK Radar e já
substituem boa parte do painel provisório.

## Usuários e permissões

| Perfil | Pode | Permissões |
| --- | --- | --- |
| Diretoria | Ver tudo; aprovar a política de reserva e o uso da reserva | `orcamento.painel.ver`, `orcamento.execucao.ver`, `orcamento.tesouraria.ver`, `orcamento.reserva.aprovar` |
| Financeiro | Importar e classificar o realizado; cadastrar contas e saldos; registrar adiantamentos; importar o histórico | as anteriores, menos `reserva.aprovar`, e mais `orcamento.realizado.editar` (já existe), `orcamento.tesouraria.editar`, `orcamento.historico.editar` |
| Coordenação de área | Ver a execução e o recurso livre dos serviços do seu escopo | `orcamento.execucao.ver` (escopo de área ou serviço) |
| Leitura | Ver os painéis agregados | `orcamento.painel.ver` |

Ninguém além de Diretoria e Financeiro vê saldos de contas: `orcamento.tesouraria.ver` não vai para
Coordenação nem para Leitura.

## Onde os dados ficam

Uma planilha nova, **`orcamento_execucao`**. Os lançamentos chegam a milhares de linhas por ano, e
separá-los da planilha `orcamento` mantém a Previsão rápida (uma leitura por planilha, ADR-011).

| Aba | O que guarda | Sigilo |
| --- | --- | --- |
| `Importacoes` | Cada importação: arquivo, período, quem, quando, quantas linhas entraram, foram ignoradas ou foram para "a classificar" | — |
| `Lancamentos` | Data, competência, conta contábil (código e nome, como vêm do WK Radar), histórico, documento, fornecedor, valor, entrada ou saída, conta bancária, **serviço, grupo, fonte e natureza** classificados, situação (classificado ou a classificar), `nao_recorrente` (sim/não e motivo), id da importação, chave de duplicidade | fornecedor: **pessoal quando for pessoa física** |
| `RegrasClassificacao` | DE-PARA aprendido: conta contábil (e, opcionalmente, um trecho do histórico) → serviço, grupo, fonte e natureza | — |
| `Adiantamentos` | Recurso livre usado para cobrir um termo atrasado: termo (fonte restrita), serviço, valor, data, lançamentos ligados, ressarcimentos recebidos, saldo em aberto | — |
| `Contas` | Banco, agência e conta, tipo (movimento, aplicação, caixa), classe (**livre disponível, reserva, vinculada**), fonte (se vinculada), unidade, ativa | — |
| `Saldos` | Conta, mês, saldo do extrato no último dia, quem informou | — |
| `AjustesConciliacao` | Conta, mês, valor, motivo (ex.: cheques a compensar) | — |
| `PoliticaReserva` | Mínimo da reserva (em meses de folha), gatilho do disponível (em meses de gasto livre), faixas dos sinais, com vigência e aprovação | — |
| `Historico` | Anos fechados: ano, fonte (cadastro de Fontes), receita realizada, despesa total, folha, saldo livre em 1º de janeiro, linha de origem na planilha | — |

A folha individual **não** entra em `Lancamentos`. O realizado de RH é importado agregado por serviço
(ou vem do Resumo da folha), para não espalhar salários fora da planilha `orcamento_folha`.

## Regras de negócio

### 1C.1 — Importar o realizado

1. A importação segue o padrão do importador da folha: envio do .xlsx ou .csv, escolha da aba e da linha
   do cabeçalho, DE-PARA de colunas sugerido pelos títulos e conferido pela pessoa, relatório antes de gravar.
2. **Sem duplicar:** cada lançamento tem uma chave formada por data, conta contábil, documento, valor e
   conta bancária. Reimportar o mesmo período não duplica; o relatório mostra quantos já existiam.
3. Lançamento cuja conta contábil não tem regra vai para **"A classificar"**. Ao classificá-lo, a pessoa
   pode marcar "usar sempre para esta conta", e a regra é gravada em `RegrasClassificacao`.
4. Todo lançamento classificado tem serviço, grupo, fonte e natureza. A natureza é uma de: **RH,
   encargos, custeio, investimento/obras, tarifas, adiantamento a termo, ressarcimento**.
5. **Recurso livre** é todo lançamento cuja fonte tem uso **livre** no cadastro de Fontes (1B).
6. Lançamento marcado como **não recorrente** (ex.: reforma da quadra, PIS recuperado) continua nos
   totais, mas é separado nas comparações entre anos e nos cenários.
7. Nenhum total é digitado: tudo é soma de lançamentos.

### 1C.2 — Execução e recursos livres

8. **Execução** = realizado ÷ previsto, por mês, área, serviço, grupo e fonte. O previsto é o da Previsão
   aprovada, com os ajustes aprovados (1B.2).
9. **Recurso livre por serviço** = saídas com fonte livre classificadas no serviço, por natureza.
10. **Comparação com o ano anterior:** mesmos meses (de janeiro até o último mês importado), sem os
    lançamentos não recorrentes.
11. **Adiantamentos:** lançamento com natureza "adiantamento a termo" abre um adiantamento; entrada com
    natureza "ressarcimento" baixa o adiantamento escolhido. O painel mostra o saldo em aberto e há
    quantos dias.
12. Despesas sem rateio ficam no serviço "Comum" (decisão de 05/11/2026). O rateio por base da Análise
    por área (1B) pode ser usado depois, quando a Diretoria definir o critério.

### 1D.1 — Contas e saldos

13. Toda conta tem uma classe. Conta **vinculada** tem fonte (restrita) obrigatória.
14. Um saldo por conta por mês. Conta ativa sem saldo no mês aparece como pendência no topo da tela.
15. **Saldo da classe** = soma dos saldos das contas da classe + ajustes de conciliação. Nada é digitado
    como total.
16. **Conferência do termo:** para cada conta vinculada, saldo do extrato − (saldo inicial + entradas −
    saídas da fonte no realizado). Diferença diferente de zero vira alerta, com a lista dos lançamentos do mês.
17. **Conferência do recurso livre:** variação do saldo das contas livres (disponível + reserva) no mês −
    resultado do recurso livre no mês (1C). A diferença aparece todo mês para ser explicada.

### 1D.2 — Fim do ano e reserva

18. **Cenários para 31/12:** saldo livre do último mês com saldo + variação do mesmo período (do mês até
    dezembro) em cada um dos dois anos anteriores, com e sem não recorrentes. Mais um cenário pela
    **Previsão**: receita livre prevista − despesa livre prevista dos meses que faltam.
19. **Folga** = saldo livre previsto em dezembro − reserva atual. Folga negativa = seria preciso usar a reserva.
20. **Mínimo da reserva** = N meses × folha média mensal do ano. N é parâmetro com vigência; proposta
    inicial 2 meses (cerca de R$ 930 mil em 2026). Só vale depois de aprovado pela Diretoria.
21. **Uso da reserva:** transferência de conta de reserva para conta livre é registrada com motivo, valor e
    prazo de recomposição, e aprovada pela Diretoria (`orcamento.reserva.aprovar`).
22. **Sinais da visão geral** (ok, atenção, crítico), com faixas em `PoliticaReserva`:

| Sinal | Cálculo | Faixas propostas |
| --- | --- | --- |
| Livre disponível | Saldo livre disponível ÷ gasto médio mensal com recurso livre | ok ≥ 3 meses; atenção 1–3; crítico < 1 |
| Fim do ano | Folga do cenário "repetir ano anterior" | ok ≥ R$ 100 mil; atenção 0–100 mil; crítico < 0 |
| Execução | Resultado realizado − resultado previsto até o mês | ok ≥ 0; atenção até −5% da receita prevista; crítico abaixo |
| Folha sobre a receita | Folha ÷ receita no ano | ok ≤ 60%; atenção 60–65%; crítico > 65% (decisão de 27/10/2026) |
| Gasto com recurso livre | Variação do aplicado − variação da receita livre recorrente, sobre o ano anterior | ok ≤ 0; atenção até 10 pontos; crítico > 10 pontos |
| Reserva | Reserva ÷ mínimo aprovado | ok ≥ 120%; atenção 100–120%; crítico < 100% |

### 1E — Histórico

23. Os anos fechados são importados das planilhas de Previsão (aba de orçado × realizado), uma vez por ano.
    Cada linha de receita é associada a uma **Fonte** do cadastro (DE-PARA, como na importação de despesas
    e receitas da 1B). Linhas que misturam origens (ex.: "Emenda Parl. / Venda de bens / Promoções")
    ficam numa fonte escolhida pela pessoa, com observação.
24. O total importado de cada ano tem de bater, em centavos, com o "Total das receitas" da planilha de
    origem; senão, a importação não grava e mostra a diferença.
25. A partir do primeiro ano com a Execução no app, o histórico desse ano vem do próprio realizado, e não
    de importação.
26. Ano em andamento aparece como **parcial** em todos os gráficos e tabelas. Crescimento sobre o ano
    anterior só é calculado entre anos completos.

### Gerais

27. Toda leitura passa pelo `Autorizador`; toda gravação é auditada com as colunas alteradas, nunca os valores.
28. Nada é apagado: importações são desfeitas cancelando os lançamentos (`ativo = FALSE`), que ficam no histórico.
29. Abrir a lista de lançamentos com fornecedor pessoa física registra auditoria de leitura.

## Telas

Menu do Orçamento ganha dois grupos: **Execução** e **Tesouraria**. A primeira tela para a Diretoria
passa a ser a **Visão geral**.

1. **Visão geral:** seis sinais (regra 22), ordenados do mais grave para o mais tranquilo. Cada um com
   valor, situação, a regra em uma linha e "Ver detalhes". No topo, as datas dos dados ("saldos até…",
   "realizado até…") e as pendências: contas sem saldo, lançamentos a classificar, termos com diferença.
2. **Execução › Importar realizado:** envio, DE-PARA e relatório (regras 1 a 3).
3. **Execução › A classificar:** lista agrupada por conta contábil, com classificação em lote e
   "usar sempre para esta conta".
4. **Execução › Lançamentos:** busca e filtros por período, serviço, grupo, fonte, natureza e conta.
5. **Execução › Orçado × realizado:** cartões do ano até o mês; resultado mês a mês previsto × realizado;
   tabela por área, serviço, grupo e fonte, com execução em %.
6. **Execução › Recursos livres:** receita livre × aplicado por mês; aplicado por serviço e natureza;
   comparação com o mesmo período do ano anterior; adiantamentos em aberto; conferência com os saldos (regra 17).
7. **Tesouraria › Contas:** cadastro (Adicionar, Alterar, Excluir, no padrão dos cadastros da 1B).
8. **Tesouraria › Saldos do mês:** uma linha por conta, com o saldo do mês anterior ao lado, campo do
   saldo atual e ajustes de conciliação. Mostra os totais por classe enquanto a pessoa digita.
9. **Tesouraria › Conferência dos termos:** extrato × apurado por conta vinculada (regra 16).
10. **Tesouraria › Fim do ano:** saldo livre mês a mês do ano atual e dos dois anteriores contra a linha
    da reserva; tabela de cenários com a folga (regras 18 e 19).
11. **Tesouraria › Reserva:** política em vigor, pedidos de uso e recomposição, aprovação da Diretoria.
12. **Histórico › Indicadores:** um gráfico pequeno por indicador, de 2017 até o ano atual (receitas,
    despesas, resultado, margem, folha sobre a receita, crescimento da receita e da folha, saldo livre no
    fim do ano, variação e cobertura em meses) e a tabela comparativa.
13. **Histórico › Fontes de receita:** receita pública × própria por ano e tabela por fonte, com o peso no
    último ano completo e a variação.
14. **Histórico › Importar ano fechado:** regra 23, com conferência do total (regra 24).

O **Painel geral** da 1B (até 4 exercícios) passa a usar o Histórico, para mostrar todos os anos.

### Cuidados de experiência (valem para todas as telas)

- Cada número diz o período ("jan–ago 2026", "saldos até setembro").
- Ano em andamento sempre marcado como parcial; nunca comparado com ano completo sem aviso.
- Cada gráfico tem "Ver os números" em tabela (padrão do Painel geral).
- Cada sinal mostra a regra que o classificou; nenhum vermelho sem explicação.
- Valores grandes abreviados nos cartões (R$ 1,48 mi) e completos nas tabelas.
- Telas legíveis no celular: cartões empilham e tabelas rolam na horizontal.
- Glossário acessível em todas as telas (recurso livre, vinculado, reserva, folga, cobertura).
- Pendências no topo, com atalho para resolver; a pessoa não precisa procurar.

## Indicadores (acrescentam aos da especificação do módulo)

| Código | Cálculo | Referência |
| --- | --- | --- |
| `saldo_livre_disponivel` | Soma das contas de classe livre disponível | Sinal "Livre disponível" |
| `cobertura_disponivel` | Livre disponível ÷ gasto médio mensal com recurso livre | ok ≥ 3; crítico < 1 |
| `folga_fim_do_ano` | Regra 19 | Crítico se negativa |
| `reserva_sobre_minimo` | Reserva ÷ mínimo aprovado | Crítico abaixo de 100% |
| `recurso_livre_por_servico` | Regra 9 | Informativo |
| `variacao_gasto_livre` | Regra 22, sinal 5 | Crítico acima de 10 pontos |
| `adiantamentos_em_aberto` | Soma dos adiantamentos não ressarcidos | Alerta acima de 60 dias |
| `diferenca_conferencia_livre` | Regra 17 | Alerta se diferente de zero |
| `diferenca_termos` | Regra 16 | Alerta se diferente de zero |
| `peso_recursos_proprios` | Receita de fontes de natureza própria ÷ receita total | Informativo (histórico) |
| `cobertura_saldo_livre` | Saldo livre no fim do ano ÷ despesa média mensal do ano | Informativo (histórico) |

## Eventos

Nenhum por enquanto. Execução, Tesouraria e Histórico ficam dentro do Orçamento, porque dependem de
Serviços, Grupos, Fontes e Exercício. Assim nenhum módulo precisa importar outro (regra 3) nem há
ligação entre módulos (ADR-013).

## O que muda fora do módulo (precisa de aprovação)

- **Núcleo:** ligação das permissões novas aos perfis Diretoria, Financeiro, Coordenação e Leitura, por
  "Preparar estrutura". Nenhum perfil novo.
- **Netlify:** a variável `PLANILHAS` ganha a chave `orcamento_execucao`.
- **Drive:** uma planilha nova e em branco na pasta da plataforma.
- **Serviços (Núcleo):** cadastrar o serviço "Comum", na área Administração e Gestão.

## Pendências

1. **Exportação do WK Radar:** a Diretoria vai conferir se exporta lançamentos (razão) e saldos por conta
   para Excel. Uma amostra com dados fictícios ou anonimizados define o DE-PARA. **Bloqueia a 1C.1.**
2. **Política de reserva:** aprovar N meses de folha (proposta: 2) e as faixas dos sinais.
3. **Lista de contas:** conferir a classe de cada conta (hoje: Santander e CEF como reserva; caixas, Banco
   do Brasil, Bradesco, Sicredi e Cresol como livre disponível; as demais vinculadas).
4. **Fontes do histórico:** conferir a associação proposta das linhas antigas às fontes (o estudo usa 12
   grupos: SUS/CER III, Educação, Assistência, emendas e projetos, PRONAS, rendimentos das contas
   vinculadas, captação, Apae Rural, rendimentos das aplicações livres, Centro de Formação, Nota Fiscal
   Paulista e outras).
5. **Fim do painel provisório:** o painel "Análise financeira da Apae Batatais" no claude.ai continua até a
   1D.1 e a 1E estarem no ar.

## Decisões da construção da 1D.1 (07/11/2026)

1. A conferência dos termos e do recurso livre (regras 16 e 17, tela 9) sai da 1D.1: as duas comparam o saldo
   com o realizado, que só existe depois da 1C.1. A 1C.1 foi para o roadmap, à espera da amostra do WK Radar.
2. Saldo negativo é aceito (conta movimento pode ficar negativa).
3. A tela "Saldos do mês" abre no mês anterior ao atual (o extrato fecha no último dia do mês). A escolha do
   mês é uma lista com os últimos 24 meses; mês futuro não é aceito.
4. Quem informou o saldo e quando ficam nas colunas de controle de toda aba (`atualizado_por`, `atualizado_em`).
5. Conta excluída continua somando, na classe dela, nos meses em que tinha saldo; só sai das pendências e da
   digitação dos meses seguintes.
6. A aba `Contas` não tem coluna de observação (a especificação não pede).
7. O que a pessoa digitou e não salvou fica guardado no navegador (só naquela aba) e volta depois de um erro
   ou de um ajuste; se outra pessoa alterou o saldo da mesma conta nesse meio-tempo, o valor digitado não volta
   e a tela avisa.
8. Salvar os saldos do mês é tudo ou nada: se outra pessoa alterou algum saldo, nada é gravado e a pessoa é avisada.

9. **Troca de classe de uma conta (decisão da Diretoria em 08/11/2026):** ao alterar a classe, o Elo avisa que
   a mudança afeta os totais e a pessoa escolhe:
   - **Corrigir em todos os meses:** a classe estava errada desde o início; os totais de todos os meses são
     recalculados com a classe nova.
   - **Mudou a partir de um mês:** a pessoa escolhe o mês; os meses anteriores continuam somando na classe antiga
     e, daquele mês em diante, vale a nova. O histórico das classes fica na aba `MudancasClasse` (só inclusões).

## Decisões da construção da 1E (09/11/2026)

Tomadas pelo agente durante a construção, sem resposta da Diretoria. Estão na lista do PR com o custo de cada uma.

1. **Duas abas em vez de uma:** `Historico` guarda a receita por linha da planilha de origem (ano, fonte, descrição, valor, linha, observação) e `HistoricoAnos` guarda os totais do ano (despesa total, folha, saldo livre em 1º de janeiro, total das receitas da planilha). A especificação previa uma aba só, com despesa e folha repetidas em cada fonte.
2. **Despesa total, folha e saldo livre de 1º de janeiro são digitados na importação** (a especificação não diz de onde vêm). Só a receita é lida da planilha, pelo DE-PARA de colunas. O saldo é opcional.
3. **Saldo livre no fim do ano = saldo livre de 1º de janeiro do ano seguinte.** O último ano importado fica sem saldo no fim, até o ano seguinte ser importado. Não usa os saldos da Tesouraria, porque eles são vistos só por Diretoria e Financeiro.
4. **Permissões:** `orcamento.historico.ver` para Diretoria, Financeiro e Leitura (os números são agregados, sem dado pessoal); `orcamento.historico.editar` só para o Financeiro. A Coordenação não vê o Histórico.
5. **Ano fechado:** de 2017 até o ano anterior ao atual (horário de Brasília). Ano em andamento aparece como parcial, mas só entra nos números quando existir realizado (1C).
6. **Total da planilha:** o Elo procura a linha "Total das receitas"; se não achar, a pessoa digita. A soma das linhas tem de bater em centavos, senão nada é gravado.
7. **Reimportar um ano substitui** o anterior (as linhas antigas ficam com `ativo = FALSE`); "Desfazer" cancela o ano sem apagar.
8. **O Painel geral da 1B ainda não usa o Histórico** (fim da seção "Telas"). Ficou no roadmap.
9. **Histórico vindo do realizado (regra 25)** fica para a 1C, que ainda não existe.

## Decisões pedidas à Diretoria

1. Execução, Tesouraria e Histórico **dentro do Orçamento** (recomendado) ou num módulo próprio.
2. Uma planilha nova `orcamento_execucao` para lançamentos, saldos e histórico.
3. Ordem das entregas: 1D.1 → 1E → 1C.1 → 1C.2 → 1D.2.
4. Saldos de contas visíveis só para Diretoria e Financeiro.
5. Uso da reserva aprovado pela Diretoria.

## Fora do escopo

- Fluxo de caixa diário ou semanal e projeção de 13 semanas.
- Leitura automática de extratos bancários (OFX).
- Rateio das despesas comuns entre serviços.
- Prestação de contas por termo no formato dos órgãos financiadores.

## Critérios de pronto (cada entrega)

- [ ] Regras da entrega com testes, incluindo quem vê e quem altera
- [ ] Testes de acesso para cada aba nova (`tesouraria.ver` não chega a Coordenação nem a Leitura)
- [ ] Importadores testados com planilhas fictícias no mesmo formato das reais
- [ ] Números da prévia conferidos com o painel provisório, usando dados fictícios no mesmo formato
- [ ] "Preparar estrutura" cria as abas novas no limite de 10 segundos
- [ ] `npm run verificar` e `npm run build` verdes
- [ ] Conferido pela Diretoria na prévia

## Entrega 1C.2 — Painel de execução e recursos livres (issue #185, 17/11/2026)

Detalha a 1C.2 da "Revisão de 10/11/2026". Lê o realizado que a 1C.1 já grava (aba `Realizado`) e o previsto
da Previsão aprovada; **não importa o WK Radar** (as perguntas P1 a P6 da issue são da importação futura e
não bloqueiam esta entrega). Onde houver conflito com as regras 8 a 12 originais, vale esta seção.

### Objetivo e para quem

Responder, sem planilha paralela: "estamos gastando o que previmos?", "quanto recurso livre cada serviço
consome?", "quanto falta ressarcir dos termos?" e "como estamos contra o mesmo período do ano passado?".
Usam: Diretoria e Financeiro (tudo), Coordenação de área (só despesa do seu escopo) e Leitura (só totais).

### Usuários e permissões

| Perfil | Vê | Permissão |
| --- | --- | --- |
| Diretoria, Financeiro | Tudo (despesa e receita, todos os serviços) | `orcamento.execucao.ver` |
| Coordenação de área ou serviço | Só despesa dos serviços do escopo; sem receita, sem adiantamentos, sem comparação de receita | `orcamento.execucao.ver` (com escopo) |
| Leitura | Só os totais do ano e do período (sem serviço, grupo, fonte nem adiantamentos) | `orcamento.painel.ver` |

Ninguém altera nada nesta entrega: as telas são só de leitura (o realizado continua sendo informado na 1C.1,
pelo Financeiro com `orcamento.realizado.editar`). Nenhuma permissão nova.

### Dados

Sem aba nova. Uma coluna nova **opcional** em `Realizado`: `fonte_termo_id` (texto), a fonte restrita do termo
que o recurso livre adiantou. Obrigatória só em linha de despesa com natureza "adiantamento a termo"; vazia nas
demais (sem dado pessoal, sem `sigilo`). Linhas de adiantamento já gravadas sem ela aparecem como "termo não
informado" (regra 5), sem bloquear nada. A grade "Informar realizado" ganha o campo "Termo adiantado" quando a
natureza escolhida é "adiantamento a termo". Mudança só dentro do Orçamento.

### Regras de negócio (com teste)

1. **Previsto do mês** de uma combinação serviço × grupo × fonte = previsto da Previsão **aprovada** do ano,
   já com remanejamentos e suplementações aprovados (1B.2), distribuído pelos meses como a Previsão faz. Receita
   por fonte. Sem Previsão aprovada, o painel mostra só o realizado e avisa.
2. **Execução (%)** = realizado ÷ previsto, no período escolhido (janeiro até o último mês informado, ou um
   mês). Sem previsto, a execução é "sem previsto" (nunca 0% nem infinito). Realizado sem linha na Previsão
   entra numa linha "Fora da previsão".
3. **Só meses informados contam.** O período padrão vai de janeiro ao último mês com realizado informado; o
   previsto é cortado no mesmo mês, para não comparar 9 meses de realizado com 12 de previsto. Mês do meio
   sem informação aparece como "sem dado" e fica fora das somas dos dois lados (previsto e realizado), com aviso
   listando os meses.
4. **Recurso livre por serviço** = soma das despesas cuja fonte tem uso `livre`, por serviço e natureza.
   Despesa sem serviço vai para "Comum" (decisão de 05/11/2026). Mostra também a **receita livre** do período
   e o **resultado do recurso livre** (receita livre − despesa livre).
5. **Adiantamentos e ressarcimentos, por termo (fonte restrita).** Adiantado = soma das despesas "adiantamento a
   termo" com aquele `fonte_termo_id`; ressarcido = soma das receitas "ressarcimento" cuja `fonte_id` é o termo.
   **Saldo em aberto** = adiantado − ressarcido, acumulado de todos os anos (um adiantamento de dezembro pode ser
   ressarcido em março). Saldo negativo (ressarcido a mais) aparece como "ressarcido a mais", nunca some.
   **Há quantos dias:** conta a partir do fim do mês do adiantamento **mais antigo ainda em aberto**, baixando
   do mais antigo para o mais novo (primeiro a entrar, primeiro a sair). Acima de 60 dias, a linha ganha a
   etiqueta "Atenção" (indicador `adiantamentos_em_aberto`). Adiantamento sem termo informado aparece no fim,
   como "Termo não informado — complete na grade do mês".
6. **Comparação com o ano anterior** (regra 12 da 1C.1): só os meses informados nos **dois** anos; os não
   recorrentes saem da comparação e aparecem numa linha à parte, com o motivo. Ano anterior sem nenhum mês
   informado: o painel diz "sem realizado do ano anterior no Elo" (o Histórico da 1E não substitui aqui, regra 13
   da 1C.1).
7. **Nenhum total é digitado**; tudo é soma das linhas do `Realizado`, em centavos.
8. **Quem vê o quê é filtrado antes de somar:** o total que a Coordenação vê é a soma só do escopo dela; o de
   Leitura, só o agregado. Nenhum número fora do escopo vaza por subtração entre totais.
9. **Auditoria:** são telas de totais, sem dado pessoal; não registram auditoria de leitura (como "Realizado do
   ano"). O que existe de auditoria na gravação (1C.1) não muda.

### Telas

Menu **Execução** ganha **Painel de execução** (primeira tela do grupo para quem tem `execucao.ver`) e **Recursos
livres**; **Realizado do ano** continua. Linha de contexto em todas: "Janeiro a setembro de 2026 · realizado
informado até setembro".

**1. Execução › Painel de execução** (Diretoria e Financeiro querem saber se a execução está no previsto, em um
olhar; Coordenação, se o seu serviço está.)
- Caminho: abrir o menu → 1 clique. "Ver os números" e o filtro de serviço não perdem nada ao trocar.
- Primeira dobra: faixa de pendências (meses sem realizado, adiantamento acima de 60 dias; cada uma com atalho
  para resolver), depois três `Indicadores`/números de destaque: **Despesa**, **Receita** e **Resultado** do
  período, cada um com realizado, previsto e execução em %. Ação principal para o Financeiro: "Informar
  realizado" (botão no cabeçalho).
- Seguem: gráfico **ResultadoMensal** (título em conclusão, ex.: "Resultado ficou abaixo do previsto em 2 dos 9
  meses", com a leitura ao lado: o que fazer, como "confira os meses de março e abril"; receita e despesa
  realizadas, mês a mês); gráfico **BarrasHorizontais** "Execução por serviço" (série 1 = previsto, série 2 =
  realizado, maior primeiro; no máximo 2 séries); tabela `TabelaDados` por área, serviço, grupo e fonte com
  previsto, realizado, diferença e execução em %, com busca e ordenação.
- Componentes de `src/ui/`: `CabecalhoPagina`, `Aviso`, `Indicadores`, `ResultadoMensal`, `BarrasHorizontais`,
  `TabelaDados`, `SeletorAno`, `Etiqueta`, `EstadoVazio`. Nada novo no Núcleo.
- Estados: **vazio** (sem nenhum mês informado): "Ainda não há realizado neste ano. O Financeiro informa mês a
  mês em Informar realizado." com o botão só para quem pode; **sem Previsão aprovada**: aviso "Sem Previsão
  aprovada em 2026: mostramos só o realizado" e as colunas de previsto somem; **sem permissão**: tela padrão de
  acesso negado. Telas só de leitura: não há "gravando" nem erro de gravação; erro de leitura mostra "Não foi
  possível carregar o painel. Tente de novo" com o botão.
- Ação sem volta: nenhuma.
- Celular e teclado: cartões empilham, tabela rola na horizontal, gráficos têm "Ver os números"; ordem de
  tabulação: ano → período → pendências → cartões → gráficos → tabela.

**2. Execução › Recursos livres** (Diretoria e Financeiro: quanto recurso livre cada serviço consome e se a conta
fecha.)
- Primeira dobra: números de destaque **Receita livre**, **Despesa livre** e **Resultado do recurso livre** do
  período; abaixo, o resumo de adiantamentos ("Falta ressarcir R$ … em N termos; o mais antigo há N dias").
- Gráfico **Linhas** "Receita livre × despesa livre por mês" (2 séries, `formato: moeda`, "sem dado" nos meses
  não informados); gráfico **BarrasHorizontais** "Recurso livre por serviço" (maior primeiro; nota com a
  natureza dominante); tabela serviço × natureza (RH, encargos, custeio, investimento, tarifas, adiantamento) com
  total, e peso do serviço no total em %.
- **Comparação com o ano anterior**: **BarrasAgrupadas** do mesmo período, os dois anos lado a lado, com
  e sem não recorrentes (alternância "Sem não recorrentes" / "Com todos"), variação em % e em pontos contra a
  receita livre; ano parcial marcado "parcial" (regra 26).
- **Adiantamentos e ressarcimentos**: tabela por termo (adiantado, ressarcido, em aberto, há quantos dias,
  etiqueta Atenção/Em dia). Sem adiantamento: "Nenhum adiantamento em aberto." (estado vazio, não erro).
- Coordenação vê só a despesa livre dos seus serviços; as seções de receita e adiantamentos não aparecem para
  ela (e nem o cabeçalho delas). Leitura não acessa esta tela.
- Estados, celular e teclado: como na tela 1.

**3. Realizado do ano** (já existe, 1C.1): ganha só o link "Ver o painel" no cabeçalho.
**4. Visão geral e Painel geral** (1D.2 e 1B): **não** mudam nesta entrega; passam a mostrar a Execução
na 1D.2.

### Sugestões de melhoria (a Diretoria decide)

- Ligar cada barra de serviço à tabela já filtrada naquele serviço (um clique para o detalhe).
- Mostrar, no painel, a pendência de realizado já existente na tela inicial (regra R11) para o Financeiro
  resolver sem sair do painel.
- Exportar a tabela de execução em CSV, no mesmo padrão de "Baixar planilha" da Previsão.

### Fica de fora

Importação do realizado (WK Radar ou modelo) e as perguntas P1 a P6; tabelas de correspondência
centro de custo ↔ serviço e conta ↔ grupo; lançamentos individuais; aba `Adiantamentos` própria; conferência
dos termos e do recurso livre contra os saldos (regras 16 e 17, que ficam na 1D.2); Visão geral e sinais; uso da
reserva; histórico vindo do realizado (regra 25 original).

### Frentes

`regras e dados` (leitura agregada do realizado e da Previsão, coluna `fonte_termo_id`, escopo, testes) e
`telas` (duas telas novas com gráficos e a grade com o campo "Termo adiantado"). Sem `infraestrutura`.

### Entregas

Uma só entrega (1C.2), conferível na prévia. Depende da 1C.1, que já está no ar.

### Critérios de pronto (1C.2)

- [ ] Testes das regras 1 a 8, incluindo escopo (Coordenação só o seu; Leitura só o agregado; nada vaza por subtração)
- [ ] Testes de borda: período cortado nos dois lados, mês do meio sem dado, previsto zero, saldo de adiantamento negativo, ordem do mais antigo para o mais novo, ano anterior sem dados
- [ ] "Preparar estrutura" acrescenta a coluna `fonte_termo_id` sem perder as linhas existentes
- [ ] Na prévia, com a demonstração: o Painel de execução mostra execução por serviço; Recursos livres mostra o consumo por serviço, a comparação com o ano anterior e um adiantamento em aberto; a Coordenação vê só o seu serviço
- [ ] Gráficos com "Ver os números", `descricao`, título em conclusão, no máximo 4 séries
- [ ] `npm run verificar` e `npm run build` verdes

### Decisões tomadas sozinho (1C.2)

1. **Adiantamentos calculados do `Realizado`, sem aba `Adiantamentos`** (a regra 11 original previa uma).
   Custo se errada: criar a aba e ligar linhas a adiantamentos individuais, o que pede ajuste na grade.
2. **Baixa do mais antigo para o mais novo** (e não "o adiantamento escolhido"), porque o realizado é em totais
   mensais, sem lançamento para escolher. Custo se errada: campo para escolher o adiantamento em cada ressarcimento.
3. **Coluna `fonte_termo_id` no `Realizado`** para saber que termo foi adiantado. Custo: dado antigo sem termo
   fica em "termo não informado" até ser completado.
4. **Limite de 60 dias** para a etiqueta "Atenção" (o do indicador `adiantamentos_em_aberto`). Se errado, é um parâmetro.
5. **Período padrão = janeiro até o último mês informado**, com o previsto cortado no mesmo mês.
6. **Leitura não vê a tela Recursos livres** (só totais no Painel de execução).
7. **Duas telas, não uma**, para o painel principal não ficar longo; se preferir uma só, junte as seções.

## Como a 1D.2 foi construída (20/11/2026, issue #186)

Decisões tomadas durante a construção, além das oito da revisão de 17/11:

1. **Resumo da folha mudou de endereço** (`/orcamento/resumo`) para a Visão geral ser a entrada do módulo em `/orcamento`. *Custo se errada:* voltar a rota e mover o redirecionamento.
2. **Uma proposta de política pendente por vez.** Para corrigir, a Diretoria recusa e o Financeiro propõe outra. *Custo:* tirar uma checagem.
3. **"Quem propõe não aprova" confere o autor do registro** (`criado_por`), não só as permissões. *Custo:* uma linha.
4. **"Último mês com saldo" = qualquer saldo das classes pedidas no mês**, sem exigir todas as contas (conta nova não zera os meses antigos). *Custo:* trocar uma função.
5. **Gráfico do Fim do ano só desenha os meses em que o ano em andamento tem saldo**, e só os anos com saldo em todos esses meses (o `Linhas` do Núcleo não aceita buraco). Os demais anos ficam listados em texto. *Custo:* aceitar `null` no `Linhas` (Núcleo; precisa de pedido).
6. **Folha sobre a receita sem RH realizado dá 0%** (o RH realizado vem das naturezas `rh` e `encargos`). *Custo:* exigir ao menos uma linha de RH para calcular.
7. **Pendência "termos com diferença"** olha só os meses do ano em andamento, até o mês anterior ao atual. *Custo:* mudar o intervalo.

