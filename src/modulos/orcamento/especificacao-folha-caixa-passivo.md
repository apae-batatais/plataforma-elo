# Especificação — Orçamento: Folha com visão de caixa, passivo trabalhista e provisão mensal

- Situação: para aprovação (proposta #126, 14/11/2026)
- Dono do produto: Diretoria
- Complementa `especificacao.md` (Folha 1A, Previsão 1B, rateio de fonte R3/R4) e
  `especificacao-execucao-tesouraria.md` (Realizado 1C.1, reserva 1D.2). Arquitetura: ADR-011 (sem ADR nova:
  não muda hospedagem, armazenamento nem Núcleo).
- Decisões da Diretoria (14/11/2026, issue #126): duas visões lado a lado; painel de passivo mais provisão
  mensal; provisão realizada vem da contabilidade; provisão prevista projetada do último realizado;
  cedidos fora. Respostas às perguntas do Arquiteto: **1.2** (estimar com ajuste), **2.1** (calendário da
  instituição e mês de férias por pessoa), **3.1** (reserva = saldo digitado pela contabilidade).

## Objetivo

1. Mostrar na folha **quando o dinheiro sai** (caixa), sem mudar o **custo do mês** (1/12), que continua
   servindo ao custo dos serviços, aos rateios e ao per capita.
2. Mostrar o **passivo trabalhista**: quanto a instituição deveria se desligasse cada pessoa hoje, por
   serviço e por fonte, com a simulação "e se este serviço ou termo acabar?", ao lado da **reserva** feita.
3. Trazer a **provisão mensal** (multa do FGTS e aviso prévio) como despesa de reserva: no realizado, digitada
   (vem da contabilidade); na previsão, sugerida pelo Elo.

**Para quem:** Financeiro e tesouraria (caixa), Departamento Pessoal (calendário e dados por pessoa),
Diretoria (risco e reserva), coordenações (custo do serviço, sem valor por pessoa).

## Entregas

| Entrega | Conteúdo | Depende de |
| --- | --- | --- |
| **P1 — Folha em caixa** | Calendário de pagamentos da instituição, mês de férias por pessoa, tipo de contrato, visão "Caixa" ao lado de "Custo do mês" | — |
| **P2 — Passivo trabalhista** | Férias tiradas e ajuste do saldo de FGTS por pessoa, cálculo do passivo, painel por serviço e fonte, simulação | P1 (tipo de contrato) |
| **P3 — Provisão e reserva** | Natureza "provisão trabalhista" no realizado, saldo da reserva digitado, provisão sugerida na previsão, reserva ao lado do passivo | P2 |

Cada entrega vira uma issue própria ligada à #126 (sugestão; a #126 fica como guarda-chuva).
Ordem recomendada: P1 → P2 → P3.

## Usuários e permissões

Nenhuma permissão nova no Núcleo; usam-se as do módulo (`manifesto.ts`):

| Quem | Calendário e dados por pessoa | Caixa por pessoa | Caixa por serviço | Passivo por pessoa | Passivo por serviço/fonte e simulação | Reserva e provisão |
| --- | --- | --- | --- | --- | --- | --- |
| Diretoria | vê (`folha.ver_individual`) | vê | vê | vê | vê | vê |
| Financeiro | edita o calendário (`parametros.editar`) e os dados por pessoa (`folha.editar`); informa a reserva e a provisão (`realizado.editar`) | vê | vê | vê | vê | edita |
| Departamento Pessoal | edita dados por pessoa (`folha.editar`); **não** edita o calendário | vê | vê | vê | vê | não vê reserva nem provisão |
| Coordenação | não | **não** | só o seu escopo (`folha.ver`) | **não** | só o seu escopo, sem nome de pessoa | não |
| Leitura | não | não | totais (`folha.ver`) | não | totais (`folha.ver`) | `execucao.ver` (só leitura) |

Regra única: **valor por pessoa só com `orcamento.folha.ver_individual`**; abrir o detalhe de uma pessoa
registra auditoria de leitura (regra 8 do `CLAUDE.md`). Quem tem só `folha.ver` vê totais por serviço e por
fonte, nunca a decomposição por pessoa.

## Entidades

Planilha `orcamento_folha` (pessoal, restrita), salvo onde indicado:

| Aba | Mudança | Colunas | Sigilo |
| --- | --- | --- | --- |
| `Funcionarios` (existente) | colunas novas | `contrato` (`indeterminado` ou `determinado`; vazio = indeterminado), `mes_ferias` (1 a 12, opcional: mês de férias que vale no lugar do padrão) | `mes_ferias`: pessoal |
| `CalendarioPagamento` (nova) | uma linha por mês e vigência, **não pessoal** | `vigencia`, `mes` (1 a 12), `ferias_coletivas` (sim/não), `decimo_pct` (0 a 100), `abono_pct` (0 a 100) | — |
| `FeriasTiradas` (nova) | uma linha por período gozado | `posto_id`, `inicio`, `dias` (1 a 30), `observacao` | `inicio` e `dias`: pessoal |
| `SaldoFGTS` (nova) | ajuste manual, só inclusões; vale a linha mais recente | `posto_id`, `referencia` (data do extrato), `valor`, `observacao` | `valor`: pessoal |
| `Parametros` (existente) | chaves novas (numéricas) | `decimo_parcelas_mes_1` e `_2` ficam no calendário; `aviso_dias_base` = 30, `aviso_dias_por_ano` = 3, `aviso_dias_max` = 90, `multa_fgts` = 40 | — |

Planilha `orcamento_execucao` (não pessoal): aba nova `ReservaTrabalhista` (`ano`, `mes`, `valor`,
`observacao`; uma linha ativa por mês) e **natureza nova** `provisao_trabalhista` na aba `Realizado`
(despesa; a aba e as colunas já existem, só o conjunto de valores aceitos cresce).

Tudo declarado com `definirTabela` e registrado para "Preparar estrutura", que acrescenta abas e colunas sem
mexer nos dados. Nada é apagado: períodos de férias e saldos corrigidos grava-se de novo; remover encerra
(`ativo = FALSE`).

Calendário padrão (quando a instituição ainda não configurou, igual à folha de hoje no custo e à regra legal
no caixa): 13º em novembro 50% e dezembro 50%; sem férias coletivas; abono dividido igualmente nos 12 meses.

## Regras de negócio (cada uma com teste, incluindo quem vê e quem altera)

### P1 — Caixa

1. **Custo do mês não muda.** `calcularLinha` e o Resumo da folha continuam iguais; a visão Caixa é um cálculo
   novo, sem alterar nenhum número já existente. Teste: o custo por serviço é o mesmo antes e depois.
2. **O ano soma igual nas duas visões**, por pessoa e no total (13º, 1/3 de férias, abono e seus encargos só mudam
   de mês). Exceção: quem entra ou sai no meio do ano, ver regra 6.
3. **13º em caixa:** o 13º anual da pessoa (salário base × meses trabalhados no ano ÷ 12) sai nos meses do
   calendário, na proporção de `decimo_pct` (soma 100%). Encargos e FGTS acompanham o mês do pagamento.
4. **1/3 de férias em caixa:** sai no **mês de férias** da pessoa: o `mes_ferias` dela, se houver; senão, nos meses
   marcados como `ferias_coletivas` (dividido igualmente entre eles); se não houver nenhum dos dois, fica
   1/12 por mês (como no custo). O salário do mês de férias continua mensal (a pessoa é paga normalmente).
5. **Abono em caixa:** o valor anual (abono digitado × 12) sai nos meses conforme `abono_pct`; sem calendário,
   1/12 por mês. Indenizações continuam mensais.
6. **Fim de contrato por prazo determinado:** se `contrato = determinado` e há `desligamento` previsto no ano, o
   mês do desligamento traz as **verbas do término**: 13º proporcional ainda não pago e férias proporcionais
   mais 1/3 do período em aberto (cálculo da regra P2.5 a P2.7, **sem aviso prévio e sem multa de 40%**, porque o
   término normal do contrato não gera). A pessoa deixa de ter 13º, 1/3 de férias e abono nos meses seguintes.
   Contrato por prazo indeterminado nunca gera verba de término na previsão (só o passivo, na P2).
7. **Visão por mês, serviço e geral:** Caixa por serviço usa a lotação (como o custo); o total geral e o por
   serviço mostram o **pico** (maior mês) e a **diferença** para o custo do mês.
8. **Calendário:** `decimo_pct` e `abono_pct` somam 100% cada (ou 0 para "não configurado = padrão"). Salvar
   o calendário com soma diferente de 100% é recusado com mensagem. Mudar o calendário grava linhas novas com
   vigência (mês de início); os meses anteriores não mudam.
9. `mes_ferias` fora de 1 a 12 é recusado. Só `folha.editar` altera dados por pessoa; só `parametros.editar` altera
   o calendário (o Departamento Pessoal vê o calendário, não altera).

### P2 — Passivo (se todos fossem desligados hoje, sem justa causa)

Referência de data: hoje (Brasília) ou a data escolhida na simulação. **Remuneração** da pessoa = salário base +
adicional + hora atividade + insalubridade + periculosidade + gratificação de função (a "remuneração salarial"
do Resumo da folha; benefícios e ajuda de custo ficam fora).

1. **Quem entra:** posto com código (funcionário), ativo na data, com `inicio` ≤ data e sem `desligamento` no
   passado. Vaga prevista (sem código) e **profissionais cedidos** (#125) não entram: o ônus da rescisão é de quem
   cede. Teste com um cedido fictício se a #125 já existir; senão, o teste confere que só postos da aba
   `Funcionarios` com código entram.
2. **Período aquisitivo de férias:** cada 12 meses a partir de `inicio`. **Período vencido** = completo (12
   meses) cujos 30 dias não foram totalmente gozados (soma dos `dias` de `FeriasTiradas` dentro do período, os
   períodos mais antigos primeiro). **Proporcional** = meses completos do período em aberto ÷ 12 (fração de 15
   dias ou mais conta como mês).
3. **Férias em dobro:** período vencido cujo prazo de concessão (12 meses depois de completado) já passou conta o
   valor em dobro, e a tela marca "férias em dobro" com ícone e texto. É um aviso para a Diretoria agir.
4. **Valor das férias** = (remuneração ÷ 30 × dias a pagar) mais 1/3. Vencidas: 30 dias menos os gozados;
   proporcionais: 30 × meses ÷ 12.
5. **13º proporcional** = remuneração × meses trabalhados no ano ÷ 12, menos a 1ª parcela se a data for depois do
   mês dela no calendário.
6. **Aviso prévio indenizado** = remuneração ÷ 30 × dias, com dias = `aviso_dias_base` + `aviso_dias_por_ano` ×
   anos completos de casa, no máximo `aviso_dias_max` (30 + 3 por ano, até 90). Sem reflexos (decisão 2 abaixo).
7. **Saldo do FGTS estimado** = soma, de cada mês desde a admissão, de 8% da base do FGTS do mês (usa o valor
   vigente naquele mês na aba `Valores`; antes da primeira vigência registrada, usa a primeira). **Ajuste:** se há
   linha em `SaldoFGTS`, o saldo = valor do extrato + 8% da base dos meses depois da data de referência.
   **Multa** = `multa_fgts` (40%) × saldo. O FGTS dos meses de aviso e do 13º/férias da rescisão não entra
   (decisão 2 abaixo).
8. **Passivo da pessoa** = férias (vencidas + proporcionais) + 13º proporcional + aviso prévio + multa do FGTS.
   Encargos patronais sobre a rescisão ficam de fora (decisão 3 abaixo).
9. **Por serviço:** passivo da pessoa × percentual da lotação vigente na data (mesma distribuição da folha).
10. **Por fonte:** pelo rateio de fonte do serviço no cadastro atual (`FontesFolha`; quando a entrega R4 existir,
    pelo `RateioFonteFolha` da pessoa). Mostra a **verba rescisória por fonte como informação**, sem alerta e sem
    bloqueio: se a fonte pode pagar essas verbas depende do plano de aplicação do termo (Parcerias) e ainda não
    foi confirmado; a tela diz isso em uma linha.
11. **Simulação "e se acabar?":** a pessoa escolhe **um serviço** ou **uma fonte** (termo) e uma data de término.
    O Elo recalcula o passivo na data escolhida e mostra: parcela atribuída ao serviço ou à fonte (passivo de
    cada pessoa × percentual), o total, e quantas pessoas têm 100% da lotação ali (desligamento inteiro) e
    quantas só em parte. Não grava nada; fecha como cálculo temporário.
12. **Ajustes por pessoa** (`FeriasTiradas`, `SaldoFGTS`) só com `folha.editar`; alterar grava auditoria com as
    colunas alteradas, nunca os valores. Valor negativo ou data antes da admissão é recusado.
13. **Sem dado, não é zero:** pessoa sem `inicio` ou sem remuneração entra como "sem dados para calcular" na lista
    de pendências, nunca com valor zero.

### P3 — Provisão e reserva

1. **Realizado:** a provisão do mês é uma linha do realizado com `natureza = provisao_trabalhista` (despesa, por
   serviço, grupo e fonte, como as demais), digitada pelo Financeiro junto com o resto (mesma tela "Informar
   realizado", com a natureza sugerida para o grupo "Provisão trabalhista"). **O Elo não calcula a provisão do
   realizado.** Passa a ser a "linha digitada" que a proposta previu enquanto a importação do realizado não existe.
2. **Reserva já provisionada:** o Financeiro digita o **saldo contábil da reserva trabalhista** de cada mês fechado
   (`ReservaTrabalhista`). O saldo é a verdade (já desconta o que foi usado em rescisões). Mês sem saldo aparece
   como "sem dado", nunca zero. Ver: `execucao.ver`; informar: `realizado.editar`.
3. **Proporção do último realizado:** a mais recente linha de mês fechado com provisão e folha própria informadas
   dá `proporção = provisão ÷ folha própria` (folha própria = realizado de natureza `rh` + `encargos` do mesmo
   mês, **sem cedidos**). Sem esse mês, a sugestão não aparece e a tela explica o que falta.
4. **Provisão sugerida na previsão do ano:** para cada mês do exercício, `proporção × folha prevista dos funcionários
   próprios` (resumo da folha, custo do mês) por serviço. O Financeiro vê a sugestão, pode **ajustar o valor** de
   cada mês e então clica em "Usar como previsão", que grava a despesa de reserva na Previsão (uma linha de
   `Despesas` por serviço, grupo "Provisão trabalhista", distribuição manual por mês, fonte do serviço). Nada
   é gravado sem esse clique; reaplicar atualiza as mesmas linhas, sem duplicar.
5. **Cedidos:** a base da regra 3 e da regra 4 usa só funcionários próprios; cedido nunca entra (#125).
6. **Reserva ao lado do passivo:** o painel mostra, para o último mês com saldo, passivo, reserva e **distância**
   (passivo − reserva) com o texto "Reserva cobre X% do passivo". Distância positiva é aviso (ícone e texto),
   nunca bloqueio. A distância usa a data do saldo; se o saldo for de mês anterior ao atual, a tela avisa "saldo
   de <mês>".
7. **Provisão no total:** a linha entra no total de despesa do realizado e aparece separada ("Provisão
   trabalhista") nas telas do realizado; não conta como pagamento a pessoa nem muda o custo dos serviços.

## Telas

Rotas dentro de `src/app/(elo)/orcamento/` e telas em `src/modulos/orcamento/telas/`.

**Caminho para cada pessoa:**

| Quem | O que quer | Caminho mais curto |
| --- | --- | --- |
| Tesouraria | Ver o pico da folha | **Resumo da folha** → alternar **Custo do mês / Caixa** (1 clique); o gráfico já abre no ano atual |
| Departamento Pessoal | Marcar férias e contrato | **Folha completa** → pessoa → janela de detalhe (já existente) com campos novos; sem sair da lista |
| Financeiro | Configurar o calendário | **Parâmetros** → seção "Calendário de pagamentos" (1 tela, 12 linhas) |
| Diretoria | Ver o passivo e a reserva | Menu **Folha de pagamento › Passivo trabalhista** (1 clique) |

### Resumo da folha, aba Caixa (P1)

- **Primeira dobra:** o controle "Custo do mês | Caixa" (controle segmentado, igual ao `SeletorAno`) sobre os
  números de destaque: **pico de saída** (mês e valor), **total do ano** e **diferença para o custo**.
  Título do cartão em forma de conclusão: "A folha tem o maior pico em novembro: R$ X, R$ Y a mais que a média".
- **Gráfico:** pergunta: "Em que meses a folha pesa mais no caixa?" Forma: **`Linhas`** com 2 séries (Custo do
  mês, cor 1; Caixa, cor 2), 12 meses, formato `moeda`; **ressalto** para o pico, com `descricao` para leitor de
  tela. Ao lado, a leitura: o número do pico (`NumeroQueConta`) e "O 13º e as férias coletivas pesam em
  novembro e dezembro; guarde esse valor antes". Tabela por serviço abaixo (`TabelaDados`), com mês a mês, na aba
  Caixa. Valores em reais; "Ver os números" já vem no componente.
- **Sem calendário configurado:** `Aviso` "O calendário de pagamentos está no padrão (13º em novembro e dezembro).
  Ajuste em Parâmetros" com link para quem pode editar; quem não pode vê só o texto.
- **Pessoa sem permissão individual:** vê o Caixa só por serviço (a tabela por pessoa não aparece).

### Parâmetros › Calendário de pagamentos (P1)

- `Secao` com **12 linhas** (mês, "Férias coletivas" sim/não, "% do 13º", "% do abono"), `Campo` para cada
  percentual, com dica "A soma de todos os meses deve ser 100%" e **total ao vivo** abaixo, com `Aviso` quando
  diferente de 100. Ação principal: **"Salvar calendário"** (`BotaoEnviar`; estado "Gravando…"; ao gravar,
  `Notificacao` "Calendário salvo; vale a partir de <mês>"). Erro: mensagem na tela com o que digitou mantido.
- Vigência: o botão grava "vale a partir do mês atual" (campo visível, editável).

### Folha completa, janela de detalhe da pessoa (P1 e P2)

- Campos novos na janela existente: **Tipo de contrato** (lista: prazo indeterminado / prazo determinado, com a dica
  "Para prazo determinado, preencha a data de desligamento previsto") e **Mês de férias** (lista de meses com
  "Segue o calendário da instituição"). Só para quem edita.
- Seção **Férias já tiradas** (P2): lista de períodos (início, dias) e "Registrar período de férias" (2 campos).
  Seção **Saldo do FGTS** (P2): último extrato (data, valor) e "Atualizar com o extrato" (2 campos), com a dica
  "Opcional. Sem extrato, o Elo estima pelo valor da folha". Abrir a janela registra auditoria de leitura.

### Painel de passivo trabalhista (P2 e P3)

Menu **Folha de pagamento › Passivo trabalhista**, para quem tem `folha.ver` (por pessoa só com
`ver_individual`); agrupado com `AtalhosSecoes` (6 blocos).

1. **Primeira dobra:** **número grande** (`NumeroQueConta`): "Se todos saíssem hoje, a instituição deveria
   R$ X", com a frase "Estimativa pela data de admissão e pela folha; corrija com extratos em Folha completa". Ao lado,
   **reserva** (quando existir) e "Reserva cobre X% do passivo" (`Indicadores`, barra de 0 a 100%, referência 100%,
   sentido `desde`, a situação escrita). Ação principal: **"Simular término de serviço ou termo"** (rola até a
   seção, 0 cliques extras para quem já está na página).
2. **Composição:** `BarrasHorizontais` — "A multa do FGTS é a maior parte do passivo": 4 categorias (férias, 13º,
   aviso prévio, multa do FGTS), 1 série (cor do app), formato `moeda`; leitura ao lado.
3. **Por serviço:** `BarrasHorizontais` (maior primeiro; até 7 serviços, o resto agrupado em "Outros") com tabela
   (`TabelaDados`) completa abaixo; título "O serviço X concentra Y% do passivo".
4. **Por fonte:** mesma forma e título; nota "informação: o que a fonte pode pagar depende do plano de aplicação
   do termo, ainda não conferido".
5. **Distância da reserva (P3):** `BarrasAgrupadas` com 2 barras (Passivo e Reserva) ou `Linhas` quando houver 3 ou
   mais meses de saldo ("A reserva cobriu X% do passivo em <mês>"). Sem saldo: `EstadoVazio` "Informe o saldo da
   reserva em Execução › Reserva trabalhista" com o botão para quem pode.
6. **Simulação:** `Campo` "Serviço ou termo" (lista), "Data de término" (data) e **"Calcular"**; resultado em
   números (parcela atribuída, total, "N pessoas com 100% neste serviço") e tabela por pessoa
   (só `ver_individual`). Estado vazio explica; resultado não grava nada.
7. **Pendências:** `Aviso` com "N pessoas sem dados para calcular" e "N com férias em dobro" (ícone e texto),
   cada uma com link para a janela da pessoa (só `ver_individual`; os demais veem a contagem).

### Execução: Reserva trabalhista e provisão (P3)

- **Informar realizado** ganha a natureza "Provisão trabalhista" (sugerida para o grupo de mesmo nome).
- **Execução › Reserva trabalhista:** grade de 12 meses com um campo de valor por mês e "Salvar saldos". Mesmo
  comportamento tudo ou nada e de versão lida da 1C.1 (R2). Erro mantém o digitado.
- **Previsão do ano › Provisão sugerida:** tabela com mês, sugestão e campo ajustável, mais a proporção usada ("1,8%
  da folha, do realizado de <mês>") e **"Usar como previsão"**. Sem realizado: `EstadoVazio` explicando o que falta.
  Ação sem volta? Não: reaplicar sobrescreve as mesmas linhas, e a confirmação do botão diz "Isto cria ou atualiza
  as linhas de provisão na previsão deste ano".

### Estados, celular e teclado (todas as telas)

- **Vazio, gravando, gravou, erro, sem permissão:** `EstadoVazio` com a frase do que fazer; `BotaoEnviar` mostra
  "Gravando…"; `Notificacao` verde ao gravar (`?ok=`) e erro persistente (`?erro=`); sem permissão a tela mostra
  só o que `Autorizador` libera, nunca valores escondidos por CSS.
- **Celular:** controle "Custo do mês | Caixa" empilha acima do gráfico; gráfico e leitura em coluna; tabela por serviço
  com rolagem lateral e a coluna do nome fixa; áreas de toque de 44 px.
- **Teclado:** ordem de tabulação segue a leitura (controle de visão → gráfico → tabelas); calendário percorre
  mês a mês com Tab; foco visível.
- **Movimento:** números sobem de zero ao abrir; ao trocar Custo/Caixa as linhas vão até a nova posição (já
  pronto em `graficos.tsx`); com "menos movimento", nada anima.

### Peças de `src/ui/` e mudanças fora do módulo

Todas as peças existem: `CabecalhoPagina`, `Secao`, `EstadoVazio`, `Aviso`, `Campo`, `BotaoEnviar`, `Janela`,
`Notificacao`, `TabelaDados`, `AtalhosSecoes`, `SeletorAno` (como referência do controle segmentado), `Linhas`,
`BarrasHorizontais`, `BarrasAgrupadas`, `Indicadores`, `NumeroQueConta`. **Nenhuma mudança no Núcleo.**
Fora do módulo: nenhuma. O menu do app ganha, em `manifesto.ts`: "Passivo trabalhista" (`folha.ver`), "Reserva
trabalhista" (`execucao.ver`, seção Execução).

### Sugestões de experiência de uso (não pedidas; a Diretoria decide)

1. Dentro do "Informar realizado", preencher a provisão do mês com o **valor do mês anterior** como ponto de partida.
2. No Resumo da folha, **selo "pico"** no mês mais pesado e um lembrete na tela inicial do Orçamento duas semanas antes.
3. Na lista da folha, um filtro "**com férias em dobro**" para o Departamento Pessoal agir antes.

## Indicadores novos

| Código | Cálculo | Referência |
| --- | --- | --- |
| `pico_caixa_folha` | Maior mês da folha em caixa ÷ média mensal | Informativo |
| `passivo_trabalhista` | Soma do passivo na data | Informativo |
| `cobertura_passivo` | Reserva do último saldo ÷ passivo | Alerta se menor que 100% |
| `ferias_em_dobro` | Pessoas com período vencido além do prazo | Alerta se maior que zero |

## Fica de fora

- Importar o realizado e a provisão da contabilidade (continua no roadmap; a provisão é digitada enquanto isso).
- Rescisão antecipada de contrato por prazo determinado (art. 479, metade dos meses restantes), cedidos (#125),
  rescisão por pedido de demissão ou justa causa, reflexos do aviso, encargos patronais sobre a rescisão, ações
  trabalhistas, pensão e consignado.
- Verbas rescisórias por termo conferidas contra o plano de aplicação (depende de Parcerias).
- Provisão calculada pelo Elo no realizado (decisão da Diretoria: vem da contabilidade).

## Frentes

P1: `telas`, `regras e dados`. P2: `telas` (inclui os gráficos), `regras e dados`. P3: `telas`, `regras e dados`.
Sem `infraestrutura`: nenhuma planilha nova; abas novas pela "Preparar estrutura".

## Decisões tomadas sozinho (e o custo se estiverem erradas)

1. **Aviso prévio** 30 dias + 3 por ano completo, até 90, indenizado (da proposta). Se a regra da instituição for
   outra, é só mudar os parâmetros.
2. **Sem reflexos** do aviso (13º e férias proporcionais do período projetado) e sem FGTS sobre verbas da rescisão:
   o passivo fica um pouco subestimado (poucos pontos percentuais).
3. **Sem encargos patronais** (INSS, terceiros) sobre a rescisão: a instituição pode ter isenção (Cebas); se não
   tiver, o passivo é subestimado.
4. **Término de contrato determinado sem aviso e sem multa de 40%** na previsão de caixa. Confirmar com a
   contabilidade; se errado, o pico do mês de término fica menor do que a realidade.
5. **13º em duas parcelas, novembro e dezembro**, configurável pelo calendário (da proposta).
6. **Remuneração para férias e 13º** = a remuneração salarial do Resumo da folha (sem benefícios e ajuda de custo);
   sem médias de horas extras ou variáveis, que o Elo não guarda. Subestima se houver muito variável.
7. **Abono em caixa** pago nos meses do calendário (padrão: 1/12 por mês) e **indenizações mensais**: o Elo não tem
   data de pagamento por pessoa para esses itens.
8. **Férias em dobro** contadas no passivo (valor dobrado, com aviso). Se a Diretoria preferir só o aviso, o valor
   cai nesse trecho.
9. **Uma folga de férias por ano por pessoa** (um mês) no caixa; fracionamento em até três períodos fica para depois.
10. **Verba por fonte** é informação, usando o rateio de fonte do serviço existente; sem alerta até a confirmação nos
    planos de aplicação.
11. **Provisão entra no total de despesa do realizado** como linha própria, e no previsto como itens de `Despesas`
    por serviço no grupo "Provisão trabalhista". Se a Diretoria quiser a provisão fora do resultado, a
    separação é só de exibição (um filtro).
12. **Simulação** atribui ao serviço ou à fonte a **parcela proporcional** ao percentual da lotação; mostra também
    quantas pessoas têm 100% lá. Se a Diretoria espera "toda a pessoa", é só trocar a conta.
13. **Reserva por mês** (uma linha ativa por mês), sem separar por serviço: a reserva da contabilidade não vem por
    serviço.
14. **Sem ADR nova**: abas e colunas novas, sem mudança de arquitetura.

## Critérios de pronto

Cada entrega:

- [ ] Testes das regras (P1: 1 a 9; P2: 1 a 13; P3: 1 a 7), incluindo quem vê, quem altera e que Coordenação
      e Leitura nunca veem valor por pessoa
- [ ] "Preparar estrutura" cria as abas e colunas novas sem mexer nos dados
- [ ] Auditoria de leitura ao abrir a pessoa; auditoria de alteração com colunas, nunca valores
- [ ] `npm run verificar` e `npm run build` verdes

Na prévia, com a demonstração (dados fictícios):

- [ ] **P1:** no Resumo da folha, "Custo do mês" tem os mesmos números de antes; "Caixa" mostra pico em novembro e
      dezembro; mudar o calendário mexe só no caixa
- [ ] **P2:** o painel mostra o passivo por serviço e por fonte; registrar um extrato do FGTS muda o saldo da pessoa;
      a simulação de um serviço mostra a parcela e quantas pessoas têm 100% nele
- [ ] **P3:** informar a provisão e o saldo da reserva de um mês fechado mostra a sugestão da previsão com a proporção;
      "Usar como previsão" cria as linhas; o painel mostra "Reserva cobre X% do passivo"
