# Especificação — Orçamento: profissionais cedidos no custo dos serviços

- Situação: para aprovação (proposta #125, 14/11/2026)
- Dono do produto: Diretoria
- Complementa `especificacao.md` (Folha 1A, Previsão 1B, Análise por área, indicadores) e
  `especificacao-folha-caixa-passivo.md` (caixa e passivo: **cedidos ficam fora**). Arquitetura: ADR-011 e
  ADR-022 (sem ADR nova: não muda hospedagem, armazenamento nem Núcleo).
- Decisões da Diretoria (issue #125, 14/11/2026): cedido como receita e despesa de mesmo valor, separadas do
  dinheiro; valor informado ou custo equivalente, por pessoa; cadastro próprio de quem cede, com termo opcional.
  Respostas às perguntas do Arquiteto: **1.2** (padrão **com cedidos** em todos os indicadores, com seletor para
  tirar), **2** (o cedido segue o serviço em que trabalha; poder público conta como público; empresa e "outro"
  são apoio de terceiros; cobertura por serviço fica com a issue #131), **3.3** (custo equivalente digitado à
  mão, sem cálculo do app), **4.1** (aviso 60 dias antes do fim, ajustável pelo Departamento Pessoal).

## Objetivo

Mostrar o **custo real** dos serviços e a **participação de quem cede** (poder público, empresas com cota de
aprendiz ou de PcD, outros), sem mexer no **dinheiro**: saldos, tesouraria, caixa, realizado, orçamento
aprovado e remanejamentos continuam como são. O cedido entra como **despesa e receita de mesmo valor**, em
uma visão "com cedidos" que é o padrão, com seletor para a visão "sem cedidos". O resultado previsto é igual
nas duas.

**Para quem:** Departamento Pessoal (cadastra), Financeiro (orçamento e custo), coordenações (equipe e avisos
do próprio serviço), Diretoria (custo real e participação dos parceiros).

## Entregas

| Entrega | Conteúdo | Depende de |
| --- | --- | --- |
| **C1 — Cadastro e avisos** | Quem cede, profissional cedido (valor, lotação, vigência), aviso de fim de cessão | — |
| **C2 — Custo real e participação** | Visão com/sem cedidos em painéis, análise por área, per capita, indicadores, ficha do serviço; tela "Participação de quem cede" | C1 |

Cada entrega vira uma issue própria ligada à #125 (sugestão; a #125 fica como guarda-chuva). Ordem: C1 → C2.

## Usuários e permissões

Nenhuma permissão nova no Núcleo; usam-se as do módulo. O cedido é uma **pessoa da equipe**: mesmo sigilo e mesma
permissão dos funcionários da folha.

| Quem | Quem cede (cadastro) | Cedido por pessoa (nome, valor) | Totais de cedidos por serviço e por cedente | Aviso de fim de cessão |
| --- | --- | --- | --- | --- |
| Diretoria | vê | vê (`folha.ver_individual`) | vê | vê |
| Financeiro | vê; edita os parâmetros (`parametros.editar`) | vê e edita (`folha.editar`) | vê | vê |
| Departamento Pessoal | vê e edita (`folha.editar`) | vê e edita | vê | **recebe**, com nome |
| Coordenação | não | **não** | só o seu escopo (`folha.ver`), sem nome | **recebe**, do seu serviço, sem nome de pessoa (só função, serviço e data) |
| Leitura | não | não | totais (`folha.ver`) e painéis (`painel.ver`) | não |

Regra única: **valor e nome por pessoa só com `orcamento.folha.ver_individual`**; abrir a ficha de um cedido
registra auditoria de leitura (regra 8 do `CLAUDE.md`). O cadastro de quem cede não é dado pessoal.

## Entidades

Planilha `orcamento_folha` (pessoal, restrita):

| Aba | Colunas | Sigilo |
| --- | --- | --- |
| `Cedidos` (nova) | `colaborador` (nome ou descrição da vaga cedida), `funcao` (texto livre, como o cargo da folha), `carga_horaria` (horas por mês, opcional), `cedente_id`, `inicio`, `fim_previsto` (vazio = sem data), `encerramento` (data em que a cessão realmente acabou, opcional), `observacao` | `colaborador`: pessoal |
| `ValoresCedidos` (nova, só inclusões; vale a linha mais recente com `vigencia` até o mês) | `cedido_id`, `vigencia`, `valor_mensal`, `tipo_valor` (`informado` = valor informado por quem cede; `equivalente` = custo equivalente digitado pelo Departamento Pessoal), `observacao` | `valor_mensal`: pessoal |
| `LotacaoCedidos` (nova, com vigência, igual a `Lotacoes`) | `cedido_id`, `servico` (código do Núcleo), `percentual`, `vigencia` | — |
| `Parametros` (existente) | chave nova `cessao_aviso_dias` (numérica, padrão 60) | — |

Planilha `orcamento` (não pessoal):

| Aba | Colunas | Sigilo |
| --- | --- | --- |
| `Cedentes` (nova) | `nome`, `tipo` (`poder_publico`, `empresa_aprendiz`, `empresa_pcd`, `outro`), `termo_id` e `termo_numero` (cópia; opcionais), `observacao` | — |

- Tudo declarado com `definirTabela` e registrado para "Preparar estrutura", que acrescenta abas e colunas sem
  mexer nos dados. Nada é apagado: cedente e cedido são **encerrados** (`ativo = FALSE` ou `encerramento`).
- **Não há aba de despesa nem de receita de cedidos.** A despesa e a receita são **calculadas pelo app** a
  partir destas abas (como o RH da folha), nunca digitadas; assim não há valor duplicado para divergir.
- `termo_id` vem do catálogo de nomes de Parcerias oferecido pela plataforma (ADR-013); se Parcerias estiver
  desligado, o campo some e o cadastro funciona igual. O Orçamento não importa o módulo Parcerias.

## Regras de negócio (cada uma com teste, incluindo quem vê e quem altera)

### C1 — Cadastro e avisos

1. **Quem cede:** nome obrigatório e único entre os ativos (sem diferença de maiúscula e espaço); tipo
   obrigatório. A cessão **não depende de termo**; `termo_id` é opcional e, se informado, tem de existir no
   catálogo de Parcerias. Cedente com cedidos ativos não pode ser encerrado (a tela diz quantos são).
   Quem altera: `orcamento.folha.editar`.
2. **Profissional cedido:** função, cedente e início obrigatórios; `fim_previsto` não pode ser antes do início;
   carga horária, se informada, é maior que zero. Tem sempre **pelo menos um valor** (regra 3) e **lotação que
   soma 100%** (regra 4) para contar nos números; sem isso aparece na lista como "falta valor" ou "falta
   lotação", e fica fora dos totais (nunca soma errado em silêncio). Alterar grava com a versão lida e
   registra auditoria com as colunas, nunca os valores.
3. **Valor por pessoa:** mensal, maior que zero, com `tipo_valor`. Mudar o valor grava **nova linha** com
   vigência (mês de início do novo valor); o histórico fica. A ficha mostra qual tipo vale hoje ("informado por
   quem cede" ou "custo equivalente, digitado") e a data. O app **não calcula** custo equivalente.
4. **Lotação:** percentuais por serviço que somam exatamente 100% (mesma validação `validarRateio` e mesma
   vigência da folha); serviço tem de existir e estar ativo no Núcleo.
5. **Cedido ativo no mês:** começou até o último dia do mês e não terminou antes do primeiro dia. Termina
   quando `encerramento` está preenchido, senão no `fim_previsto`; sem nenhum dos dois, continua. Mês cheio
   (sem proporcional por dia, como a folha).
6. **Aviso de fim de cessão:** cessão ativa, com `fim_previsto` e sem `encerramento`, entra no aviso quando
   faltam `cessao_aviso_dias` dias ou menos (inclusive já vencida e ainda não encerrada, em destaque).
   O prazo é um parâmetro (1 a 365; padrão 60) alterado só por `orcamento.parametros.editar`. O aviso sai
   quando a pessoa **encerra** a cessão ou **prorroga** (novo `fim_previsto`, com auditoria). Quem recebe:
   Departamento Pessoal e Financeiro (todos os serviços, com nome) e coordenação (só os serviços do seu
   escopo, sem nome). Mês e dia no fuso de Brasília.
7. **Mesma pessoa em dois lugares:** um cedido não é funcionário da folha; nada do cadastro de cedidos
   altera a folha, o custo do mês, o caixa nem o passivo trabalhista. Teste: os números da folha são os mesmos
   antes e depois de cadastrar cedidos.

### C2 — Custo real e participação

8. **Despesa de cedidos:** para cada serviço e mês, soma `valor_mensal × percentual da lotação` dos cedidos
   ativos no mês. Entra no **custo do serviço**, nos rateios dos custos comuns como custo direto do serviço
   (base "custo"), na base "profissionais" (conta cada cedido ativo, com o percentual de lotação) e no
   **per capita** (÷ atendidos ÷ 12), tudo **apenas na visão com cedidos**.
9. **Receita de cedidos:** o mesmo valor, por cedente e mês, como receita "sem passar pelo caixa". Entra no
   total de receitas e na receita garantida da visão com cedidos; aparece nas listas como linhas automáticas
   "Cedidos — <cedente>" (somente leitura; não aceita edição, captação nem exclusão). Despesa e receita de
   cedidos são **sempre iguais em cada mês**, por construção (teste).
10. **Resultado previsto igual nas duas visões** (teste). O orçamento aprovado, os remanejamentos, a
    aprovação do exercício, a Tesouraria, o Realizado e a `execucao_orcamentaria` **nunca incluem cedidos** (não
    há dinheiro nem lançamento); a execução mostra "sem cedidos" fixo.
11. **Indicadores existentes (padrão com cedidos, seletor para tirar):**
    - `folha_sobre_receita`: (RH da folha + cedidos) ÷ (receita total + cedidos).
    - `dependencia_recursos_publicos`: cedido de cedente **poder público** conta como receita pública; empresa
      (aprendiz ou PcD) e "outro" **não** contam (são apoio de terceiros). O cedido entra no denominador.
    - `recursos_livres`: cedido **nunca** é recurso livre (entra só no denominador).
    - `resultado_previsto`: igual nas duas visões.
    - Total CEBAS da folha: continua só da folha (cedido não gera encargo para a instituição).
    - Os alertas (65% e 70%) valem para a visão **que está na tela**, com a mesma referência; ao lado do
      número, o painel mostra o outro ("sem cedidos: 58%"), para ninguém ler um alerta sem saber qual visão.
    - Histórico de anos fechados (1E): vem de importação, não tem cedidos; os indicadores dele são
      rotulados "sem cedidos".
12. **Participação de quem cede:** por cedente e por ano, quanto cada um representa (em reais e em % do custo
    de todos os serviços), por tipo de cedente; **separando** "pessoas" (cedidos) de "dinheiro" quando o
    cedente tem termo ligado (o dinheiro vem da leitura de Parcerias pela plataforma, ADR-022, com a permissão
    de quem vê; sem Parcerias ou sem permissão, só "pessoas"). Cedente sem cedido ativo no ano aparece zerado.
13. **Ligação com o serviço e com a #131:** a visão de ligação `custoDoServico` (Ficha do serviço) ganha o
    campo `cedidos` (valor previsto no ano, por cedente, **sem nome de pessoa**), mostrado só a quem vê o
    custo do serviço (`execucao.ver` no escopo); o realizado dele continua sem cedidos. O Orçamento também
    exporta uma leitura por serviço e por cedente (tipo e valor anual), sem dado pessoal, para o painel de
    sustentabilidade financeira (#131) tratar o cedido como cobertura do serviço atribuída a quem cede. Essa
    leitura passa pelo `Autorizador` (`folha.ver`, escopo de serviço); o painel em si é da #131.
14. **Seletor "Incluir cedidos":** padrão **ligado**. A escolha vale na tela em que a pessoa está (vai no
    endereço, para compartilhar o link) e nunca é gravada como preferência. Total dos painéis com o seletor
    desligado é igual ao de hoje, centavo a centavo (teste de regressão com e sem cedidos cadastrados).
15. **Sem cedidos cadastrados**, nada muda: o seletor não aparece e os números são os de hoje.

## Telas

Seguem as habilidades `telas` e `graficos` e `docs/identidade-visual.md`; nenhuma peça nova em `src/ui/`
(se faltar alguma, é mudança no Núcleo e volta à Diretoria).

### 1. Cedidos (Folha de pagamento › Cedidos, `/orcamento/cedidos`) — C1

- **Quem usa:** Departamento Pessoal, ao cadastrar e acompanhar. Caminho mais curto para cadastrar:
  Cedidos › Adicionar cedido › preencher › Salvar (3 cliques depois de abrir o formulário; nada se perde se
  cancelar).
- **Primeira dobra:** faixa **"Cessões perto do fim"** (só se houver; ver tela 3) e a lista de cedidos com
  filtros "Todos / Ativos / Encerrados", busca por nome ou função; botão principal **"Adicionar cedido"**;
  ação secundária **"Quem cede"** (abre o cadastro, tela 2). Colunas: nome, função, quem cede, serviço(s),
  valor mensal e tipo ("Informado" ou "Equivalente"), fim previsto, situação. Quem não tem
  `folha.ver_individual` não vê a tela (aparece o texto "Você não tem acesso aos valores por pessoa" e o
  link para os totais).
- **Formulário (janela)**, rótulo sempre visível: Nome ou descrição da vaga cedida*; Função*; Carga horária
  (horas por mês, dica "ex.: 160"); Quem cede*; Início da cessão*; Fim previsto (dica "deixe vazio se não
  há data"); Valor mensal* (dica "valor em reais por mês"); **Tipo do valor***: "Informado por quem cede" ou
  "Custo equivalente (digitado)", com a frase "O Elo não calcula o custo equivalente; digite o valor que a
  instituição gastaria com um funcionário da mesma função."; Lotação por serviço* (as mesmas linhas de
  percentual da folha, com a soma visível e o botão "Dividir igualmente" quando houver mais de um serviço);
  Observação. Erro: a janela continua aberta, com tudo o que foi digitado, e a mensagem diz o campo e como
  corrigir (por exemplo "A lotação soma 90%; precisa somar 100%.").
- **Ficha do cedido** (abre auditoria de leitura): dados, histórico de valores, lotação e cessões; botões
  "Alterar valor" (grava nova vigência, pede o mês), "Prorrogar cessão" (novo fim previsto) e
  **"Encerrar cessão"** (ação sem volta de fato: a confirmação explica "A pessoa deixa de contar no custo dos
  serviços a partir do mês de <mês>. O histórico fica guardado.").
- **Estados:** vazio ("Nenhum profissional cedido ainda. Use 'Adicionar cedido' para começar."); gravando
  (botão "Salvando…" desabilitado); gravou ("Cedido salvo."); erro de versão ("Alguém alterou este cedido
  enquanto você editava. Recarregue para ver a versão nova."); sem permissão (sem botões de alterar).
- **Celular e teclado:** a lista vira cartões (nome, função e fim previsto em cima); formulário em uma coluna,
  ordem natural dos campos; janela fecha com Esc e devolve o foco ao botão que a abriu.

### 2. Quem cede (Cadastros › Quem cede, `/orcamento/previsao/cedentes`) — C1

- **Quem usa:** Departamento Pessoal e Financeiro. Lista de cedentes (nome, tipo, termo, cedidos ativos, valor
  mensal de hoje) e **"Adicionar quem cede"**. Campos: Nome*; Tipo* (Poder público, Empresa com cota de
  aprendiz, Empresa com cota de PcD, Outro); Termo em Parcerias (opcional, lista de termos; some se Parcerias
  estiver desligado); Observação. Encerrar com cedidos ativos: recusa com a quantidade.
- Estados e celular como na tela 1.

### 3. Aviso de fim de cessão — C1

- **Onde aparece:** (a) faixa no topo de **Cedidos** e do **Resumo da folha** ("2 cessões terminam em até
  60 dias"; vencida e não encerrada vem primeiro, em destaque com ícone e texto, nunca só cor); (b) número ao
  lado de "Orçamento" no menu (como o das Requisições) para quem recebe o aviso. Cada item diz: função,
  serviço, data de fim e dias que faltam; para Departamento Pessoal e Financeiro, também o nome. Ação:
  **"Prorrogar"** ou **"Encerrar"** (quem edita) ou "Abrir ficha". Coordenação só lê e vê "Fale com o
  Departamento Pessoal".
- **Parâmetro:** o prazo (padrão 60 dias) fica em Folha de pagamento › Parâmetros, campo **"Avisar o fim
  da cessão com quantos dias de antecedência"**, só para quem tem `parametros.editar`.
- **Mudança fora do módulo:** o número do menu mora em `src/plataforma/alertas.ts` (composição da plataforma);
  a Diretoria aprova essa mudança junto com a especificação.

### 4. Seletor "Incluir cedidos" e as visões — C2

- **Onde:** Painel geral, Previsão do ano, Análise por área, Resumo da folha (só custo) e as listas de
  Despesas e Receitas. Um **interruptor com rótulo "Incluir cedidos"**, ligado por padrão, perto do filtro de
  ano. Só aparece se há cedidos cadastrados no ano.
- **Leitura:** quando ligado, uma linha de texto diz "Inclui R$ X de profissionais cedidos (despesa e receita
  de mesmo valor, sem passar pelo caixa)". Desligado, "Só o dinheiro que passa pelo caixa". Nos números de
  destaque dos indicadores, o outro valor vem pequeno abaixo ("sem cedidos: 58%").
- **Despesas (lista):** linha automática por serviço, "Pessoal cedido", sem botões de editar, marcada como
  automática (como o RH da folha). **Receitas (lista):** linhas "Cedidos — <cedente>", marcadas como "sem passar
  pelo caixa".
- **Análise por área:** coluna extra "Cedidos" no custo do serviço e **dois per capita lado a lado** ("com
  cedidos" e "sem cedidos"); o total do orçamento nunca muda pelo rateio.
- **Gráficos:** nenhum novo nos painéis existentes (as barras e totais só ganham a parcela de cedidos). Quando
  houver série por parcela, "dinheiro" e "cedidos" são duas séries com texto/legenda, e a leitura ao lado diz o
  que fazer ("Sem os cedidos, a folha pesa 71% da receita: acima da referência de 65%").
- **Sem permissão:** quem não vê folha não vê a parcela por serviço; vê só o total no painel geral.

### 5. Participação de quem cede (Painéis › Participação de quem cede, `/orcamento/previsao/cedentes/participacao`) — C2

- **Pergunta que responde:** quanto cada parceiro aporta em pessoas (e em dinheiro, quando há termo)?
- **Forma:** **tabela com barra de proporção** (comparação entre poucas categorias; componentes de
  `src/ui/graficos.tsx`, valores em reais e em % do custo dos serviços, no máximo quatro séries: poder público,
  empresa com cota de aprendiz, empresa com cota de PcD, outro). Título em forma de conclusão: "O poder público
  cobre X% do custo dos serviços em pessoas". Leitura ao lado: o que fazer ("3 cessões terminam em 60 dias:
  veja a lista").
- **Sem dados:** "Nenhum profissional cedido em <ano>." Ano parcial: o ano corrente mostra "previsto até
  dezembro" no título.
- Abaixo, a tabela por cedente, com "pessoas" e "dinheiro do termo" em colunas separadas.

### Melhorias de experiência de uso (sugestões; a Diretoria decide)

- Alerta de **aviso também por e-mail** ao Departamento Pessoal (hoje só dentro do Elo).
- **Duplicar cedido** para cadastrar vários da mesma cessão (por exemplo, vários aprendizes).
- **Cadastro em lote** de cedidos por lista colada, como Grupos e Fontes.
- Mostrar na Ficha do serviço a equipe cedida (só função e fim, sem nome).

## Fica de fora

- Cálculo do custo equivalente pelo app (decisão 3.3); tabela salarial.
- Cedido no **caixa**, na **tesouraria**, no **realizado** e no **passivo trabalhista**; reconhecimento
  contábil da cessão (gratuidade recebida): fica com a contabilidade da instituição (pendência da proposta).
- Cobertura de cada serviço, origem do serviço e painel de sustentabilidade: issue #131 (aqui só a leitura).
- Cedido no histórico importado de anos fechados.
- Aviso por e-mail; cedido de dois cedentes ao mesmo tempo; proporcional por dia no mês de início e de fim.
- Importar cedidos de planilha.

## Frentes

`telas`, `regras e dados`. Sem infraestrutura. **Fora do módulo (precisa de aprovação):**
`src/plataforma/alertas.ts` (número no menu) e `src/plataforma/ligacoes.ts` (entrega da leitura por cedente à
#131 e do catálogo de termos); nenhuma mudança no Núcleo.

## Decisões tomadas sozinho

| Decisão | Custo se estiver errada |
| --- | --- |
| Valor do cedido é **mensal fixo com vigência**, sem 13º, férias ou encargos calculados (o app não calcula custo equivalente) | Médio: se a Diretoria quiser custo com encargos, o Departamento Pessoal digita o valor já completo; calcular depois é uma entrega nova |
| Mês cheio, sem proporcional por dia | Baixo: pequeno desvio no mês de início e de fim |
| Cedido **fora** do realizado, da execução, do caixa e do passivo | Médio: se a Diretoria quiser ver cedido no realizado, é preciso um lançamento automático mensal |
| Alertas 65% e 70% valem para a visão na tela, com a outra mostrada ao lado | Baixo: é trocar a regra do alerta |
| Cedido **não** é recurso livre; só poder público conta como público | Baixo: segue a resposta 2; se mudar, é regra única no cálculo |
| Aviso para coordenação **sem nome** da pessoa (só função, serviço e data) | Baixo: liberar nome é ligar a permissão individual |
| Na base de rateio "profissionais", cedido conta como profissional do serviço (visão com cedidos) | Baixo: muda só a divisão dos custos comuns |
| Receita de cedidos aparece na captação como **garantida** | Baixo: rótulo e soma da receita garantida |
| Sem ADR nova | Baixo: a decisão (cedido calculado, nunca digitado) cabe nesta especificação |

## Critérios de pronto

- [ ] Testes: cedente (único, tipo, termo opcional, encerrar com cedidos), cedido (validações, valor com vigência,
      lotação 100%, ativo no mês, encerramento e prorrogação), aviso (prazo, vencida, quem recebe e quem não vê
      nome), receita = despesa em todo mês, resultado igual nas duas visões, indicadores nas duas visões com
      poder público x empresa, regressão (sem cedidos nada muda, folha/caixa/passivo/execução/tesouraria
      idênticos), acesso (quem vê nome e valor, quem vê só totais, coordenação no escopo, auditoria de leitura)
- [ ] "Preparar estrutura" acrescenta as abas e a chave de parâmetro sem mexer nos dados
- [ ] Na prévia (dados fictícios, sem nomes próprios): cadastrar quem cede (um poder público e uma empresa) e
      dois cedidos (um valor informado, um equivalente); ver o custo do serviço e o per capita com e sem cedidos;
      ver o resultado previsto igual; ver o aviso de uma cessão perto do fim e prorrogá-la; conferir que os
      saldos da Tesouraria e o caixa da folha não mudaram
- [ ] `npm run verificar` e `npm run build` verdes
