# Especificação — Orçamento: Painel de sustentabilidade financeira

- Situação: para aprovação (proposta #131, 14/11/2026)
- Dono do produto: Diretoria
- Complementa `especificacao.md` (Previsão, rateio dos custos comuns, indicadores),
  `especificacao-execucao-tesouraria.md` (Realizado, Tesouraria), `especificacao-folha-caixa-passivo.md` (passivo, #126),
  `especificacao-cedidos.md` (visão com e sem cedidos, #125) e `src/modulos/parcerias/especificacao.md` (termos, vagas, repasses).
  Arquitetura: ADR-011, ADR-020 e ADR-022 (**sem ADR nova**: não muda hospedagem, armazenamento nem Núcleo; o Orçamento só lê
  Parcerias pela plataforma, como as ADRs já preveem).
- Decisões da Diretoria (issue #131, 14/11/2026): uma proposta com cinco blocos; cobertura dos serviços em destaque;
  dependência reformulada pela origem do serviço. Respostas às perguntas do Arquiteto: **1.3** (origem do serviço: vale o
  campo no cadastro; se vazio, vale o termo, olhando o **tipo de instrumento**), **2.1** (recurso próprio livre do ano = só a
  receita livre do ano) e **3.2** (limite de alerta para a instituição **e** limite opcional por serviço). Indicadores de
  passivo e de retorno da captação são especificados agora; cada cartão só aparece quando o dado existir.

## Objetivo

Responder, com números e sem planilha paralela: **quanto o repasse de cada termo cobre do custo do serviço, quanto sai de recurso
próprio para completar, e se esse aporte ameaça a sustentabilidade da instituição.** Em volta disso, o painel mostra de onde vem a
receita (pela origem do serviço), quanto fôlego a instituição tem e como está o resultado.

**Para quem:** Diretoria e Presidência (decidir e negociar repasses), Financeiro (acompanhar), Conselho (ler, perfil Leitura).

## Entregas

| Entrega | Conteúdo | Depende de |
| --- | --- | --- |
| **S1 — Cobertura dos serviços** | Origem do serviço, cobertura e déficit por serviço, aporte próprio, per capita, **peso do aporte** com limites, tela do painel (bloco 1) | Parcerias (existe); custo por serviço (existe); cedidos C2 só para a visão "com cedidos" |
| **S2 — Origem e dependência** | Receita por origem, concentração por financiador, recorrente × eventual (bloco 2) | S1 |
| **S3 — Fôlego e resultado** | Meses de reserva, margem, folha sobre a receita; cartões de passivo, repasse em atraso e retorno da captação **quando houver dado** (blocos 3 e 4) | S1; #126 P3, 1C.2 e #116 L5 só para os cartões deles |
| **S4 — Execução das parcerias** | Execução do termo, saldo a devolver, ocupação das vagas (bloco 5) | S1; R3 e R4 (comprometimento das fontes) |

Sugestão: uma issue por entrega, ligadas à #131 (que fica como guarda-chuva). Ordem: S1 → S2 → S3 → S4.

## Usuários e permissões

| Quem | Pode | Permissões |
| --- | --- | --- |
| Diretoria | Ver o painel inteiro | `orcamento.sustentabilidade.ver` (nova), `orcamento.tesouraria.ver` |
| Financeiro | Ver o painel; classificar a origem dos serviços; definir limites de alerta | as anteriores e `orcamento.parametros.editar` (já existe) |
| Leitura (Conselho) | Ver o painel, **menos** os cartões de saldo (reserva, passivo, repasse em atraso) | `orcamento.sustentabilidade.ver` (nova); sem `tesouraria.ver` |
| Coordenação, Compras, Departamento Pessoal | Não veem o painel | — |

- O painel mostra **totais por serviço e da instituição**; nunca valor individual de pessoa (a folha entra só como custo do
  serviço, como no painel geral). Não há leitura individual sensível, então **não há auditoria de leitura**.
- Alterar a origem de um serviço e os limites de alerta é **auditado** (colunas alteradas, nunca os valores), com a versão lida.
- Cartão que depende de saldo (reserva, passivo, repasse em atraso) exige `orcamento.tesouraria.ver`; sem ela o cartão mostra
  "Você não tem permissão para ver os saldos" (sem número).
- O painel usa os termos pela leitura de Parcerias da plataforma (ADR-022). Parcerias desligado: o bloco 1 mostra só o custo,
  sem repasse, e diz "Ative o app Parcerias para ver a cobertura".

## Entidades

Tudo na planilha `orcamento` (sem dado pessoal; sem `sigilo`). Nenhuma coluna ou aba no Núcleo.

- `CentrosCusto` (existe): coluna nova **`origem`** (opcional): `contratado` (o poder público contrata a instituição),
  `propria_apoio` (iniciativa própria com apoio público) ou `propria` (iniciativa própria). Vazio = vale a sugestão do termo.
  Só faz sentido em serviço do tipo `direto`.
- `Fontes` (existe): coluna nova **`recorrencia`** (opcional): `recorrente` ou `eventual`. Só para fonte de natureza **própria**.
  Vazio = "sem classificar".
- `LimitesSustentabilidade` (aba nova): `indicador` (`peso_aporte`, `meses_reserva`, `concentracao_financiador`,
  `margem_operacional`), `servico` (opcional; só para `peso_aporte`), `valor` (número), `ativo`. Uma linha ativa por
  indicador (e serviço). Limpar o limite encerra a linha (`ativo = FALSE`); nada é apagado.
- "Preparar estrutura" acrescenta as colunas e a aba sem mexer nos dados.
- **Sem aba de resultado:** todos os números do painel são calculados na hora a partir de Previsão, Parcerias, Tesouraria,
  Realizado e cedidos.

## Regras de negócio (cada uma com teste, incluindo quem vê e quem altera)

### Origem do serviço

1. Valores válidos de `origem`: `contratado`, `propria_apoio`, `propria`, ou vazio. Outro valor é recusado com mensagem.
2. **Origem sugerida pelo termo** (só quando o campo está vazio), olhando os termos em vigor no ano que atendem o serviço:
   - algum termo de **colaboração** ou **convênio** → `contratado`;
   - senão, algum termo de **fomento** → `propria_apoio`;
   - senão (acordo de cooperação, "outro" ou nenhum termo) → `propria`, **sem sugestão** (aparece "sem termo").
   Mais de um tipo: vale o primeiro da lista acima. Acordo de cooperação e "outro" não indicam origem sozinhos.
3. **Origem efetiva** = campo, se preenchido; senão a sugerida. A tela mostra de onde veio ("definida por você" ou "sugerida pelo
   termo X"), e o campo pode ser corrigido a qualquer hora. A sugestão nunca é gravada sozinha.
4. Alterar a origem grava `CentrosCusto.origem` com a versão lida e registra auditoria (coluna alterada). Quem altera:
   `orcamento.parametros.editar`.
5. Serviços de apoio e o administrativo não têm origem (o custo deles já está rateado nos diretos).

### Cobertura do serviço (bloco 1)

Ano = o exercício escolhido. **Visão** = "incluir cedidos" ligado (padrão, como em `especificacao-cedidos.md`) ou desligado.
Só entram serviços **diretos** com exercício aprovado (ou encerrado). Exercício em elaboração: o painel abre com o aviso
"Previsão ainda em elaboração; os números podem mudar".

6. **Custo total do serviço** = custo direto previsto (despesas aceitas, RH da folha, com os ajustes aprovados) + rateios dos
   custos comuns, de apoio e do administrativo (R1) — **o mesmo número da Análise por área**, nunca recalculado de outro jeito.
   Na visão "com cedidos" soma também o custo dos cedidos do serviço (C2); na visão "sem cedidos" não.
7. **Repasse previsto do serviço no ano** = para cada termo em vigor no ano que atende o serviço, a soma das parcelas do ano
   (parcelas das fontes e dos aportes ativos, mês a mês) × (vagas custeadas do serviço ÷ soma das vagas custeadas dos
   serviços do termo) — a mesma atribuição da regra 16 de Parcerias. Termo sem vagas custeadas em nenhum serviço: o repasse
   **não é atribuído** a serviço algum e aparece no serviço o aviso "o termo X não tem vagas custeadas em Parcerias; sem elas o
   repasse não é distribuído". Vários termos no mesmo serviço somam.
8. **Cedidos do serviço** (só na visão "com cedidos") = valor dos cedidos no ano, pelo mesmo cálculo da regra 8 de C2, por tipo de
   cedente. Entra como **cobertura de quem cede**, nunca como recurso da instituição.
9. **Déficit do serviço** = custo total − repasse − cedidos. **Aporte próprio** = déficit quando positivo, senão zero. Se o
   repasse e os cedidos passam do custo, o serviço mostra "Repasse acima do custo em R$ X" (não é aporte negativo e **não
   compensa** o aporte de outro serviço).
10. **O aporte próprio é o mesmo nas duas visões** (teste): tirar os cedidos tira o mesmo valor do custo e da cobertura.
    Mudam o custo total e as porcentagens.
11. **Cobertura do termo** = repasse ÷ custo total ("o termo paga 82% do serviço"); **cobertura de cedidos** = cedidos ÷ custo
    total; **parte própria** = aporte ÷ custo total. Custo zero: as três aparecem como "—".
12. **Per capita** (por mês, conforme o seletor de visão): **custo** ÷ 12 ÷ vagas custeadas do serviço (soma entre os termos),
    **repasse** ÷ 12 ÷ vagas custeadas, e as duas contas ÷ **atendidos médios do ano** (contagem de pessoas do Núcleo, a mesma de
    Parcerias, regra 18). Sem vagas: "sem vagas informadas"; unidade da meta que não é pessoa: "sem contagem automática" no
    "por atendido". Nunca zero no lugar de "sem dado".
13. **Peso do aporte na instituição** (indicador central, `peso_aporte`) = soma dos aportes próprios dos serviços com origem
    efetiva `contratado` ÷ **receita livre do ano** (Σ das receitas previstas do ano nas Fontes de uso **livre**, todas as
    situações de captação — a mesma base do indicador `recursos_livres`; cedido nunca é livre). Serviços `propria_apoio` e
    `propria` aparecem na lista com o aporte deles, mas **não entram** no indicador central.
    - Receita livre zero e aporte maior que zero: sem número; texto "Não há receita livre prevista para cobrir o aporte de R$ X".
    - Valor acima de 100% é mostrado como é (a barra para em 100% e o texto diz "acima de 100%").
14. **Limites de alerta** (`LimitesSustentabilidade`): o da instituição (`peso_aporte`, em %) e, opcional, um **por serviço**.
    Alerta da instituição quando o peso passa do limite. Alerta do serviço quando o aporte **do serviço** ÷ a mesma receita livre
    passa do limite dele. **Sem limite definido não há alerta** (o app não impõe régua): o cartão mostra o número e a frase
    "Defina o limite de alerta em Cadastros › Limites do painel". Limite entre 0 e 100 (aceita decimal). Alterar: auditado;
    quem altera: `orcamento.parametros.editar`.
15. **Evolução nos anos**: cada cartão mostra os anos em que o Elo tem exercício aprovado, calculados do mesmo jeito; ano sem
    exercício aprovado aparece como "sem dado", nunca zero. O Elo **não reconstrói** anos sem previsão (o histórico importado, 1E,
    não tem custo por serviço).

### Origem e dependência (bloco 2, S2)

16. **Receita por origem do serviço** (no ano, em dinheiro mais, na visão "com cedidos", cedidos como série à parte):
    - *Contratado pelo poder público* = repasse atribuído a serviços de origem efetiva `contratado`;
    - *Iniciativa própria com apoio público* = repasse atribuído a serviços `propria_apoio`;
    - *Iniciativa própria* = receita prevista total em dinheiro − todos os repasses de termos do ano;
    - *Cedidos* (só "com cedidos") = receita de cedidos (C2).
    Repasse **não atribuído** (termo sem vagas custeadas) usa a origem sugerida pelo **tipo do termo** (regra 2).
    Se o repasse dos termos passa da receita prevista total, "iniciativa própria" fica zero e aparece o aviso "O repasse previsto
    dos termos (R$ X) é maior que as receitas lançadas (R$ Y): confira as Receitas". O indicador `dependencia_recursos_publicos`
    **continua como está** (público × privado); este painel só acrescenta a leitura por origem.
17. **Concentração por financiador** (`concentracao_financiador`) = maior ente ÷ receita prevista total em dinheiro, onde ente =
    parceiro dos termos (parcelas do ano, agrupando parceiros sem diferença de acento ou maiúscula). Mostra também a tabela por
    **termo** e por **Fonte de recurso do cadastro** (receitas lançadas), para o caso de receita sem termo. Alerta só se houver
    limite (regra 14).
18. **Receita própria recorrente × eventual** (`receita_recorrente`): receitas do ano em Fontes de natureza **própria**, somadas por
    `recorrencia`. Fonte sem classificação soma em "sem classificar", e o cartão avisa quantas fontes faltam classificar. Sem
    nenhuma fonte própria: cartão oculto.

### Fôlego (bloco 3, S3)

19. **Meses de reserva** (`meses_de_reserva`) = saldo da classe **reserva** da Tesouraria no último mês com saldo ÷ **despesa média
    mensal**. A despesa média mensal é a média do **realizado** dos meses informados no ano; sem nenhum mês informado, a
    previsão do ano ÷ 12 (a tela diz qual base foi usada). Sempre sem cedidos (é dinheiro). Sem saldo: `EstadoVazio` ("Informe o
    saldo do mês em Tesouraria"). Limite opcional (`meses_reserva`, "alertar abaixo de X meses").
20. **Referência de literatura** (3 a 6 meses de reserva): aparece só como texto de apoio ("Referência de literatura estrangeira;
    as fontes brasileiras consultadas não trazem valor"), **nunca** como limite nem alerta. Quem define o alerta é a instituição.
21. **Cobertura do passivo trabalhista** = o indicador `cobertura_passivo` da #126 (reserva ÷ passivo). O cartão **só aparece**
    quando há passivo calculado e saldo de reserva; sem isso fica oculto (não mostra zero).
22. **Repasse em atraso** = saldo em aberto dos adiantamentos de recurso livre a termos (aba `Adiantamentos`, 1C.2). Cartão oculto
    enquanto a aba não existir ou não tiver lançamentos. Não há "recebido" em Parcerias: o painel **não adivinha** atraso pela data
    das parcelas.

### Resultado (bloco 4, S3)

23. **Margem operacional** (`margem_operacional`) = resultado previsto ÷ receita prevista total, **sempre em dinheiro** (sem
    cedidos nas duas visões: o resultado é igual, e o denominador também). Negativo é "falta". Limite opcional (`margem_operacional`,
    "alertar abaixo de X%"). Receita zero: "—".
24. **Folha sobre a receita**: o indicador `folha_sobre_receita` existente, com o seletor de visão e a referência de 65% que já vale.
25. **Retorno da captação**: custo por real captado = custo realizado ÷ receita realizada das linhas do Realizado ligadas a projetos
    do tipo **captação** (`especificacao.md`, "Ajustes da onda 2"). Depende de o Projetos oferecer à plataforma a lista dos projetos
    desse tipo (leitura nova, fora do módulo, na S3). Sem projetos de captação com lançamentos, o cartão fica oculto.

### Execução das parcerias (bloco 5, S4)

26. O bloco **reaproveita** o painel "Comprometimento das fontes" (R4) e a ocupação de vagas de Parcerias; **não cria cálculo
    novo**. Mostra por termo: execução (comprometido ÷ valor), saldo a devolver (valor da fonte − comprometido projetado até o
    fim da vigência, quando positivo) e ocupação. Sem R3/R4 construídas, o bloco é omitido (não mostra "em breve").

### Valores e conferência

27. Valores em reais com duas casas; porcentagem arredondada só na tela (cálculo com os valores inteiros); a soma dos serviços
    da tabela de cobertura é **igual** ao total do cartão (teste) e o custo total da instituição bate com o painel geral na
    visão correspondente (teste de regressão com e sem cedidos).
28. Serviço **sem termo** e origem efetiva `propria`: repasse zero, aporte = custo, **fora do indicador central**.

## Telas

**Quem usa e o que quer:** a Diretoria abre o painel para saber, num relance, se o aporte está sob controle, e entra no serviço
para ter o argumento da negociação. **Caminho mais curto:** menu Orçamento › Painéis › **Sustentabilidade financeira**
(1 clique); do cartão do serviço à tabela completa, 1 clique.

### 1. Painel (`/orcamento/sustentabilidade`, menu Painéis)

**Cabeçalho:** título "Sustentabilidade financeira", seletor de **ano** e interruptor **"Incluir cedidos"** (só aparece se há
cedidos no ano; ligado por padrão; vai no endereço; nunca é gravado). Abaixo, a linha "Inclui R$ X de profissionais cedidos…"
como na `especificacao-cedidos.md`. Âncoras para os cinco blocos (links "Cobertura", "Origem", "Fôlego", "Resultado",
"Execução"); só aparecem os blocos que têm dado.

**Primeira dobra (sem rolar), pela ordem:**
1. **Faixa de alertas** (só se houver): "O aporte de recursos próprios passa de X% da receita livre" e "N serviços acima do
   limite". Cada alerta tem ícone e texto (não só cor).
2. **Peso do aporte na instituição**: `Indicadores` com um item (barra de 0 a 100%, referência tracejada no limite, evolução nos
   anos em `anteriores`), a frase "Dos R$ X de receita livre do ano, R$ Y (Z%) vão cobrir déficit de serviços contratados" e, ao
   lado, o que fazer: "Acima do limite de X%: leve este painel para a negociação dos repasses". **Ação principal:** "Ver a
   cobertura por serviço" (rola até o bloco 1). Sem limite: a frase "Defina o limite de alerta" com o botão **"Definir limite"**
   (só para quem edita).
3. **Cobertura por serviço** (início do bloco 1).

**Bloco 1 — Cobertura dos serviços**
- Gráfico **"O termo paga 82% do serviço X; o serviço Y depende mais de recurso próprio"** (título gerado com o maior aporte):
  `Barras100`, uma barra por serviço contratado, ordenadas pelo maior aporte, séries **Repasse do termo**, **Cedidos** (só com
  cedidos) e **Recurso próprio** (até 3 séries), com a pergunta "quanto do custo cada fonte cobre?". Leitura ao lado: o serviço
  com maior parte própria e o que fazer ("Peça a revisão do repasse do serviço Y").
- Gráfico **"Aporte próprio por serviço"**: `BarrasHorizontais` em reais, maior primeiro, uma série (`naCorDoApp`), `notas` com
  "limite do serviço: X%" quando há alerta.
- **Tabela completa** (`TabelaDados`) por serviço: origem (com "sugerida pelo termo X" ou "definida"), custo total, repasse,
  cedidos, déficit, cobertura do termo, aporte próprio, % da receita livre, per capita (custo e repasse, por vaga e por
  atendido), avisos (termo sem vagas, repasse acima do custo). Clicar no nome do serviço abre a Ficha do serviço (plataforma).
- **Per capita**: `BarrasAgrupadas` (série Custo e série Repasse, por mês e por vaga, um grupo por serviço, `rotuloCategoria`
  "Serviço") com a leitura "O repasse por vaga é R$ X; o custo é R$ Y".
- Serviços de origem `propria` ou `propria_apoio` ficam numa segunda tabela, "Serviços de iniciativa própria", abaixo, sem entrar
  no indicador central.
- **Corrigir a origem:** coluna "Origem" com botão **"Alterar origem"** (só `parametros.editar`), em janela
  (`JanelaFormulario`) com três opções em texto e "Usar a sugestão do termo". Erro: a janela continua aberta.

**Bloco 2 — Origem e dependência (S2)**
- **"Metade da receita vem de serviços contratados"** (título com o número real): `Barras100`, uma barra por ano, séries
  Contratado, Iniciativa própria com apoio público, Iniciativa própria e Cedidos (4 séries).
- **Concentração por financiador**: `BarrasHorizontais` dos 5 maiores entes (restante em "Outros"), com o maior em
  `Indicadores` (valor e limite opcional); tabela por termo e por fonte.
- **Recorrente × eventual**: `Barras100` por ano, séries Recorrente, Eventual e Sem classificar; aviso com o botão **"Classificar
  fontes"** (leva a Cadastros › Fontes de recurso).

**Bloco 3 — Fôlego (S3):** número grande `NumeroQueConta` "X meses de reserva" com a base usada, `Linhas` por mês (referência
tracejada no limite, se houver) e o texto de apoio da literatura (regra 20). Cartões de **cobertura do passivo** e **repasse em
atraso** só aparecem se houver dado.

**Bloco 4 — Resultado (S3):** `Indicadores` com margem operacional e folha sobre a receita (referência de 65%); retorno da
captação como número grande, quando houver; `Linhas` por ano (`rotuloCategoria` "Ano") da margem.

**Bloco 5 — Execução (S4):** tabela por termo e links "Ver comprometimento das fontes" e "Ver ocupação de vagas".

**Estados (todas as telas):**
- **Vazio:** `EstadoVazio` com motivo e o próximo passo ("Nenhum serviço contratado ainda. Em Cadastros › Centros de custo,
  marque a origem do serviço ou cadastre um termo em Parcerias").
- **Carregando:** o texto "Calculando…" sem número zerado.
- **Gravando / gravou / erro** (alterar origem e limites): botão em "Salvando…", aviso "Origem salva." / "Limite salvo.", erro
  com a mensagem simples e tudo o que a pessoa digitou preservado.
- **Sem permissão:** quem não tem `orcamento.sustentabilidade.ver` não vê o item no menu e, pelo endereço, vê "Você não tem
  acesso a este painel"; sem `tesouraria.ver`, só os cartões de saldo mostram o aviso da regra de permissões.
- **Ano parcial:** o texto diz "ano em andamento: previsão aprovada, realizado até <mês>".
- **Sem dados num cartão** (passivo, atraso, captação): cartão oculto, nunca zero.

**Componentes de `src/ui/`:** `Indicadores`, `NumeroQueConta`, `BarrasHorizontais`, `Barras100`, `BarrasAgrupadas`, `Linhas`,
`TabelaDados`, `EstadoVazio`, `JanelaFormulario`, campos e `BotaoEnviar` dos cadastros. **Nenhuma peça nova.** Todo gráfico leva
`descricao` e "Ver os números"; no máximo 4 séries. Textos de exemplo e dados fictícios sem nome de instituição, marca ou cidade.

### 2. Cadastros › Limites do painel (`/orcamento/previsao/limites`)

Lista dos limites (indicador, serviço, valor) com **"Adicionar limite"** (ação principal), alterar e remover (encerra). Campos: o
indicador (lista), o serviço (só no peso do aporte, opcional), o valor com a dica do que significa ("alertar quando passar de X%
da receita livre"). Cada indicador mostra a referência de literatura, quando houver, como texto de apoio. Quem não edita vê a
lista sem os botões. Celular: cartões em coluna; teclado: ordem natural, janela com foco preso e Esc fecha.

### 3. Fontes de recurso e Centros de custo

- **Fontes:** o formulário ganha **"Recorrência da receita"** (Recorrente / Eventual / Sem classificar), visível só em fonte de
  natureza própria, com a dica "Recorrente entra todo mês; eventual depende de eventos e campanhas".
- **Centros de custo (serviço direto):** a lista ganha a coluna **Origem** e o mesmo botão "Alterar origem".

**Ação sem volta:** não há (origem e limites sempre se corrigem; remover limite encerra e pode ser readicionado).

**Celular e teclado:** gráficos em coluna única; tabelas com rolagem horizontal e o nome do serviço fixo; todos os valores em
"Ver os números"; âncoras alcançáveis por teclado.

### Melhorias de experiência de uso (sugestões; a Diretoria decide)

1. **Imprimir/baixar o painel** para levar à negociação (PDF ou "Baixar planilha", como em #127).
2. **Simulador de repasse:** campo "e se o repasse subisse X%?" recalculando o aporte e o peso (sem gravar nada).
3. **Alerta no menu** (número ao lado do painel) quando o peso passa do limite, como já há para outras pendências.
4. **Texto pronto de negociação** por serviço ("O termo cobre 82% do custo de R$ X; o déficit anual é R$ Y"), para copiar.

## Fica de fora

- Realizado do aporte (aporte medido sobre o realizado, mês a mês): depende de saber o repasse **recebido**, que Parcerias ainda não
  registra. Fica no roadmap.
- Painel por coordenação (cada coordenação ver o seu serviço) e ficha do serviço com o aporte: entrega futura, pela Ficha do serviço
  da plataforma.
- Histórico de anos fechados por serviço (a importação 1E não traz custo por serviço).
- Régua de referência imposta pelo app; referência de literatura só como texto.
- Alterar o indicador `dependencia_recursos_publicos` (continua público × privado, ao lado da leitura por origem).
- Mudanças no Núcleo.

## Frentes

`telas`, `regras e dados` (usar também `graficos`). Sem infraestrutura.

**Fora do módulo (precisa de aprovação):**
- `src/plataforma/ligacoes.ts` e `src/modulos/parcerias/`: leitura de **vagas custeadas por serviço e termo** e dos **atendidos
  médios do ano por serviço** (hoje só dentro de Parcerias), sem dado pessoal, para o Orçamento calcular a cobertura (S1).
- Permissão nova `orcamento.sustentabilidade.ver` no manifesto do Orçamento (perfis Diretoria, Financeiro e Leitura) e o item de
  menu — está **no módulo**, mas entra aqui porque muda quem enxerga.
- Projetos oferece à plataforma a lista de projetos do tipo captação (S3, só para o retorno da captação).

## Decisões tomadas sozinho

| Decisão | Se estiver errada |
| --- | --- |
| Origem fica em `CentrosCusto.origem` (Orçamento), não no cadastro de Serviços do Núcleo | Mover para o Núcleo exige aprovação e migração de uma coluna; baixo |
| Sugestão do termo: colaboração e convênio → contratado; fomento → iniciativa própria com apoio público; acordo de cooperação e "outro" sem sugestão | Ajustar uma tabela de três linhas e os testes |
| Só origem `contratado` entra no peso do aporte | Incluir `propria_apoio` é mudar um filtro |
| Repasse do serviço = parcelas do ano × vagas custeadas (regra 16 de Parcerias), sem esperar R3/R4 | Quando R4 existir, a contrapartida de lá pode divergir; passa-se a usar o cálculo da R4 nos dois lugares |
| Cedido cobre o serviço, mas **não** é aporte nem recurso livre; aporte igual nas duas visões | Se a Diretoria quiser cedido como aporte, o déficit muda; as contas mudam em um ponto |
| Receita livre = previsão do ano (a mesma base de `recursos_livres`); realizado fica no roadmap | Mostrar também o realizado exige "repasse recebido" |
| Sem limite definido não há alerta | Pôr um padrão é adicionar um valor inicial; mas a Diretoria disse que o app não impõe régua |
| Limites ficam em aba própria e quem edita é o Financeiro (`parametros.editar`); tela "Cadastros › Limites do painel" em vez de "Parâmetros" (que hoje é da folha) | Dar a edição à Diretoria é uma linha no manifesto |
| Permissão nova de ver o painel, com Leitura incluída | Tirar Leitura é uma linha no manifesto |
| Receita por origem: repasses dos termos + restante da receita como iniciativa própria (receitas do cadastro não têm serviço) | Se a Diretoria quiser receita por serviço, é preciso o campo "serviço" em Receitas (mudança maior) |
| Concentração: ente = parceiro do termo; receita sem termo aparece por fonte | Mudar o critério muda só a função de cálculo |
| Despesa média usada nos meses de reserva: realizado médio do ano, ou previsão ÷ 12 | Trocar a base é trocar uma função |
| Reserva = classe "reserva" da Tesouraria (sem o livre disponível) | Incluir o disponível é somar uma classe |
| `Recorrência` em Fontes (só natureza própria) | Mover para outro cadastro exige migrar a coluna |
| Margem sempre sem cedidos | Mostrar com cedidos é um denominador diferente |
| Sem ADR nova | Se a Diretoria quiser registrar a ligação, é um documento curto |

## Critérios de pronto

- [ ] **S1:** testes de origem (campo, sugestão por tipo de instrumento, correção), cobertura e déficit por serviço, aporte igual
      nas duas visões, repasse sem vagas, peso do aporte com e sem limite, limite por serviço, per capita sem vagas;
      acesso (quem vê, quem altera, Leitura sem saldos, Parcerias desligado)
- [ ] **S1 na prévia (dados fictícios):** o painel mostra, por serviço contratado, quanto o termo cobre e quanto sai de recurso
      próprio; o peso do aporte aparece em número e alerta ao passar do limite definido em Cadastros › Limites do painel;
      alterar a origem de um serviço muda o painel; ligar e desligar "Incluir cedidos" não muda o aporte
- [ ] **S2:** receita por origem, concentração e recorrente × eventual com os avisos de fonte sem classificar
- [ ] **S3:** meses de reserva com as duas bases; cartões de passivo, atraso e captação ocultos sem dado
- [ ] **S4:** bloco de execução só depois de R3 e R4
- [ ] Soma dos serviços = total do cartão; custo da instituição bate com o painel geral
- [ ] `npm run verificar` e `npm run build` verdes
