# Especificação — Módulo Orçamento

- Situação: revisão 4 (28/10/2026): Entrega 1B (Previsão) detalhada para aprovação.
  Revisão 3 (27/10/2026): estrutura da aba Estudo; sem Tabela Salarial; centros de custo = Serviços
- Dono do produto: Diretoria
- Base: estrutura das planilhas "Apae Batatais - Orçamento 2027" e
  "Apae Batatais - Folha Pagamento 2027" (Google Drive, versão de 23/10/2026)
- Arquitetura: ADR-011. O app guarda os dados em abas de Google Planilhas, que
  são só armazenamento. Contas, regras, permissões e auditoria ficam no app.

## Objetivo

Substituir as planilhas anuais de orçamento e de folha por um app. Nele, as
áreas propõem o que precisam, o Financeiro consolida e a Diretoria aprova.
A execução (previsto × realizado) e a captação de receitas são acompanhadas
mês a mês, com indicadores de saúde financeira sempre atualizados.

## Entregas

| Entrega | Conteúdo | Situação |
| --- | --- | --- |
| **1A — Folha de Pagamento** | Tabela salarial, postos (colaboradores e vagas previstas), componentes do custo, **grid de rateio por centro de custo**, resumo por centro de custo, importador da planilha da folha | **primeira a construir** |
| 1B — Previsão | Exercício, despesas (com propostas das coordenações), receitas e captação, RH gerado a partir da folha, aprovação e remanejamentos | depois da 1A |
| 1C — Execução | Importação do realizado (2026 e 2027), fila "a classificar", painel e indicadores, prestação de contas por fonte | depois da 1B |

## Retrato do orçamento 2027 hoje (planilha)

| Item | Valor |
| --- | --- |
| Despesas previstas | R$ 13,66 mi em 355 itens |
| Receitas previstas | R$ 14,01 mi em 64 itens |
| Resultado previsto | + R$ 0,35 mi |
| Recursos Humanos | 61,4% da despesa; 59,8% da receita |
| Receita livre × restrita | 17,5% × 82,5% |
| Dependência de recursos públicos | **80,4%** (Projeto Incentivado conta como público) |
| Folha atual | 146 colaboradores, 62 cargos, cerca de R$ 565 mil por mês |

## Usuários e permissões

| Perfil | Pode | Permissões |
| --- | --- | --- |
| Diretoria | Ver tudo, inclusive salários; aprovar o exercício e os remanejamentos | `orcamento.painel.ver`, `orcamento.exercicio.aprovar`, `orcamento.folha.ver`, `orcamento.folha.ver_individual` |
| Financeiro | Consolidar a previsão; gerir receitas e realizado; cadastrar a folha e o rateio; definir os parâmetros | `orcamento.painel.ver`, `orcamento.previsao.editar`, `orcamento.receitas.editar`, `orcamento.realizado.editar`, `orcamento.folha.ver`, `orcamento.folha.ver_individual`, `orcamento.folha.editar`, `orcamento.parametros.editar` |
| **Departamento Pessoal** (perfil novo) | Ver e cadastrar a folha e o rateio. Não mexe no restante do orçamento | `orcamento.folha.ver`, `orcamento.folha.ver_individual`, `orcamento.folha.editar` |
| Coordenação de área | Propor itens de despesa da própria área (1B); ver os totais da folha da própria área | `orcamento.previsao.propor`, `orcamento.folha.ver` (escopo de área) |
| Leitura | Ver o painel e os totais | `orcamento.painel.ver`, `orcamento.folha.ver` |

`orcamento.folha.ver` mostra **só totais por centro de custo**.
`orcamento.folha.ver_individual` mostra os valores de cada pessoa.

## Onde os dados ficam (planilhas e abas)

Os salários são dados pessoais. Por isso a folha fica numa **planilha separada**
(`orcamento_folha`), que pode ter compartilhamento mais restrito no Drive.

| Planilha | Aba | O que guarda | Sigilo |
| --- | --- | --- | --- |
| `orcamento_folha` | Funcionarios | Código, nome, admissão (ou início previsto), cargo, departamento, carga horária mensal, desligamento. **Sem código = vaga prevista** | nome: pessoal |
| `orcamento_folha` | Valores | As colunas digitadas da aba Estudo, com vigência: salário atual, reajuste (%), hora atividade (sim/não), adicional, ajuda de custo, bolsa estágio, insalubridade, periculosidade, gratificação de função, plano de saúde, bolsa estudo, locomoção, alimentação, férias, abono e indenizações | valores: pessoal |
| `orcamento_folha` | Lotacoes | Percentual de cada funcionário em cada **Serviço** (do Núcleo), com vigência | — |
| `orcamento_folha` | Parametros | Reajuste padrão e mês do reajuste, % de hora atividade, % de FGTS, INSS, terceiros, FAP, aposentadoria especial e PIS | — |

**Centros de custo = Serviços** (Administração › Serviços). Não há Tabela Salarial:
cargo é texto livre, como na planilha. A planilha `orcamento` só entra na Entrega 1B.

## Regras de negócio — Entrega 1A (Folha)

1. As colunas com fórmula da aba Estudo são **calculadas pelo app** (nenhuma fórmula na planilha):
   - Valor Hora = Salário atual ÷ Carga horária
   - Salário Base = Salário atual × (1 + Reajuste), a partir do mês do reajuste
   - VHora Base = Salário base ÷ Carga horária
   - Hora Atividade = 5% do salário base, para quem recebe
   - 1/3 Férias = Salário base ÷ 3 ÷ 12
   - 13º = Salário base ÷ 12
   - FGTS = 8% de (salário base + adicional + hora atividade + insalubridade + 1/3 férias + 13º)
   - TOTAL = soma de Salário base até FGTS
2. O **Resumo da folha** reproduz o bloco abaixo da relação de funcionários (coluna C):
   remuneração salarial, natureza não salarial, benefícios, encargos (INSS 20%, terceiros 5,8%,
   FAP 0,5%, aposentadoria especial 6% sobre salário base + insalubridade de quem tem insalubridade,
   FGTS 8% e PIS sobre a remuneração salarial), indenizações e total geral; e os quadros Total sem
   encargos, **Total CEBAS** (INSS + terceiros + FAP + aposentadoria especial), Total FGTS e
   Total remuneração + FGTS (= total geral − Total CEBAS).
   Correções em relação à planilha: Plano de saúde e Bolsa estudo entram em Benefícios; Indenizações sem #REF!.
3. A lotação de cada funcionário soma **exatamente 100%**; o app não salva de outro jeito.
4. Todo funcionário ativo tem lotação; quem não tem aparece no atalho "sem lotação".
5. O valor de um serviço é o resumo (com encargos) dos funcionários × o percentual da lotação.
6. Percentuais com até duas casas; "Dividir igualmente" fecha 100,00% na última linha.
7. Um mesmo serviço não se repete na lotação de um funcionário.
8. **Sem código = vaga prevista** (ex.: "A contratar…", estagiários), com o mês de início.
9. O reajuste vale a partir do mês definido nos parâmetros, sem alterar os meses anteriores.
10. Nada é apagado: desligamento encerra; mudar valores ou lotação grava linhas novas com "vale a partir de".
11. Valores individuais só para `orcamento.folha.ver_individual`; consultas registram auditoria de leitura.
    Coordenações veem o resumo só dos serviços do seu escopo (unidade, área ou serviço).
12. Toda alteração é registrada na auditoria com as colunas alteradas, nunca com os valores.

## Entrega 1B — Previsão (para aprovação)

O orçamento de 2027 começa **do zero no app** (não importa a planilha atual).
As coordenações propõem, o Financeiro consolida e a Diretoria aprova.

### Cadastros (Orçamento › Cadastros, Financeiro)

| Cadastro | Campos | Observação |
| --- | --- | --- |
| **Grupos de gasto** | Nome (único), "é Recursos Humanos?" | Ex.: Material de consumo, Alimentação, Serviços de terceiros. Os de RH somam no indicador da folha. |
| **Fontes de recurso** | Nome (único), natureza (**pública** ou **própria/privada**), uso (**livre** ou **restrita**) | Ex.: Subvenção municipal (pública, restrita), Projeto Incentivado (**pública**), Leilão (própria, livre). Base dos indicadores. |

Cada cadastro tem a sua tela com as opções **Adicionar**, **Alterar** e **Excluir**, no mesmo padrão
de Administração › Áreas e Serviços:
- **Adicionar:** formulário ao lado da lista; recusa nome repetido (sem diferença de acento ou maiúscula).
- **Alterar:** botão em cada linha; muda nome e marcações. O que já foi lançado passa a mostrar o nome novo.
- **Excluir:** pede confirmação; o registro sai das listas, mas fica guardado em "excluídos" e pode ser
  reativado. Não deixa excluir um grupo ou fonte usado em item ativo do exercício em elaboração ou aprovado
  (avisa quantos itens usam).
- Quem pode: Financeiro (`orcamento.previsao.editar`). Os demais só veem os nomes nas listas.

### Exercício

- Um exercício por ano (ex.: 2027), com situação: **Em elaboração → Aprovado → Encerrado**.
- Só a Diretoria aprova. Para aprovar: nenhum item com fonte "a definir" e nenhuma proposta pendente.
- Depois de aprovado, os valores só mudam por **remanejamento** (abaixo).

### Despesas

Cada item de despesa tem: **Serviço** (centro de custo; a área vem do serviço), **Grupo de gasto**,
**Fonte de recurso** (uma por item; pode ficar "a definir" durante a elaboração), descrição,
quantidade × ocorrências × valor unitário (o app calcula o valor) e a **distribuição nos meses**:
igual nos 12 meses, só em meses escolhidos, ou mês a mês digitado. A distribuição sempre soma o valor do item.

**Recursos Humanos** entra de dois jeitos:
1. **Automático da folha:** custo de cada funcionário × lotação, mês a mês, por serviço
   (Resumo da folha). Não se digita; muda quando a folha muda. Fonte: escolhida por serviço
   (ex.: "Escola → Convênio Educação"), com "a definir" enquanto não escolhida.
2. **Itens à parte**, num grupo marcado como RH: RPA, terceirizados, rescisões, etc.

### Receitas

Cada item de receita tem: **Fonte de recurso**, descrição, valor e distribuição nos meses (igual à despesa),
e a situação da captação: **Garantida** (contrato/termo assinado), **Em negociação** ou **A captar**.
O painel mostra o quanto da receita prevista já está garantido.

### Propostas das coordenações

- A coordenação lança itens de despesa **só nos serviços do seu escopo**, como "Proposta".
- O Financeiro **aceita** (entra no orçamento), **ajusta e aceita** ou **recusa** (com motivo).
- Na proposta, quantidade, valor e distribuição nos meses são **opcionais**: a coordenação nem sempre
  tem referência de preço. Proposta sem valor aparece como "a definir" / "Aguardando cotação".
  Nenhum item sem valor entra no orçamento: o Financeiro só aceita depois que houver valor.
- **Setor de Compras** (perfil `compras`, permissão `orcamento.previsao.cotar`): no menu "Cotações", vê as
  propostas pendentes de todos os serviços e informa quantidade, valor unitário, situação da cotação,
  observação e distribuição nos meses (`cotado_por` registra quem cotou). Não muda serviço, grupo, fonte
  nem descrição, não aceita nem recusa, e não vê a folha nem a previsão. Fluxo: coordenação propõe →
  Compras cota → Financeiro aceita (ou ajusta/recusa) → Diretoria aprova o exercício.
- O acesso ao módulo passa a ser `orcamento.acessar` (todos os perfis do módulo); o que aparece no menu
  depende das demais permissões.
- A coordenação vê a situação das suas propostas; não vê salários nem outros serviços.
- As propostas só são aceitas até a aprovação do exercício.

### Remanejamentos (depois de aprovado)

- O Financeiro pede: tirar valor de um item (ou mês) e pôr em outro, com justificativa.
- A Diretoria aprova ou recusa. Aprovado, os dois itens mudam; o original fica no histórico.
- O total do orçamento não muda num remanejamento; aumento de receita/despesa entra como **suplementação**, que também precisa da Diretoria.

### Painel da previsão

Despesa × receita do ano e mês a mês; resultado previsto; por área, serviço, grupo e fonte;
RH (folha + itens à parte) e os indicadores abaixo com os sinais de alerta.

### Permissões novas

| Permissão | Quem |
| --- | --- |
| `orcamento.painel.ver` | Diretoria, Financeiro, Leitura |
| `orcamento.previsao.editar` (despesas, receitas, cadastros, aceitar propostas, pedir remanejamento) | Financeiro |
| `orcamento.previsao.propor` (escopo: serviços da coordenação) | Coordenação de serviço |
| `orcamento.previsao.cotar` (todas as propostas pendentes, sem decidir) | Compras |
| `orcamento.exercicio.aprovar` (aprovar exercício, remanejamentos e suplementações) | Diretoria |

### Onde os dados ficam (planilha `orcamento`, não sigilosa)

Abas da 1B.1: `GruposGasto`, `Fontes`, `Exercicios`, `Despesas` e `Receitas` (cada item com as colunas
`m1` a `m12` da distribuição nos meses), `FontesFolha` (fonte da folha por serviço, com histórico) e
`CentrosCusto` (classificação de cada serviço para a Análise por área).
A 1B.2 acrescenta `Propostas` (histórico de decisões) e `Remanejamentos`.
Itens nunca são apagados: são cancelados (`ativo = FALSE`) ou alterados com histórico na auditoria.

### Regras de negócio — 1B

1. Valor do item = quantidade × ocorrências × valor unitário, calculado pelo app.
2. A distribuição mensal soma exatamente o valor do item (centavos ajustados no último mês).
3. Todo item tem fonte; "a definir" é permitido só em elaboração. O exercício só é aprovado sem "a definir" e sem propostas pendentes.
4. Coordenação propõe só nos serviços do seu escopo; o Financeiro decide; recusa exige motivo.
5. Exercício aprovado só muda por remanejamento ou suplementação aprovados pela Diretoria.
6. RH da folha = resumo com encargos × lotação, mês a mês (o mesmo número do Resumo da folha).
7. Nomes de grupos e fontes são únicos (sem diferença de acento ou maiúscula).
8. Toda alteração é auditada (colunas, nunca valores pessoais). Os valores do orçamento não são pessoais.

### Análise por área (decisões de 28/10/2026)

Modelo da aba "Análise por Área" da planilha do orçamento 2027 (só o desenho; nenhum valor copiado).

- **Centros de custo** (Orçamento › Centros de custo): cada Serviço é *custo direto*, *custo indireto*
  (apoio da área, rateado entre os diretos) ou *despesa* (administrativo, rateado entre as áreas), com
  atendidos, sessões no ano e área (m²). Sem classificação = custo direto. Nº de profissionais = soma da
  lotação da folha (50% conta 0,5).
- **Item de despesa:** + categoria (Operacional ou Projetos/Capital), prioridade (urgente/importante)
  e situação da cotação. **Receita:** + área (opcional).
- **Painel:** filtros de área, categoria e base de rateio (% do custo direto, profissionais, atendidos
  ou m²). Cards: resultado (receita restrita − gastos), receita restrita, gastos, custos e despesas.
  Matriz grupos × centros diretos; rateio A (direto), B (indireto da área), C = A + B, D (despesas
  administrativas: a área recebe a fração do seu custo no custo total, rateada entre os seus centros pela
  mesma base), total, per capita mensal (÷ atendidos ÷ 12) e por sessão; detalhamento do custo indireto;
  despesas administrativas por centro e grupo. A folha entra como "Recursos Humanos – folha" (operacional).
- Base vazia em todos os centros → usa o custo direto; se ele também for zero, partes iguais.

### Painel geral (28/10/2026)

Compara os exercícios (até os 4 mais recentes), com os mesmos números da Previsão de cada ano:
cartões do ano atual com a variação sobre o anterior (receita, despesa, resultado, folha sobre a
receita, dependência de recursos públicos, recursos livres); receita × despesa por ano; indicadores ao
longo dos anos com as referências (65% e 70%); despesa mês a mês por ano; despesa por área e por grupo
(todo o RH numa linha); composição da receita (pública × própria e restrita × livre); resumo em tabela.
Cada gráfico tem "Ver os números" em tabela.

### Entrega 1B.2 — decisões de construção (29/10/2026)

- **Propostas** (Orçamento › Planejamento › Propostas): a coordenação propõe despesas só nos serviços do
  seu escopo; pode alterar ou retirar enquanto a proposta aguarda. O Financeiro aceita (entra no
  orçamento), ajusta e aceita, ou recusa com motivo (a coordenação lê o motivo). Propostas ficam na aba
  `Despesas` com `situacao` (proposta/aceito/recusada), `proposto_por` e `motivo_decisao`.
- **Aprovação**: quadro "Situação do exercício" na Previsão do ano (Em elaboração → Aprovado → Encerrado),
  com as pendências e o botão da Diretoria. Só aprova sem fonte "a definir" e sem proposta pendente.
  Encerrar só com nenhum pedido de ajuste pendente.
- **Remanejamentos e suplementações** (aba `Ajustes`): o Financeiro pede, a Diretoria aprova ou recusa
  (com motivo). Remanejamento tira valor de uma despesa num mês e põe em outra (o total não muda);
  suplementação aumenta ou reduz uma despesa ou receita num mês. O item original não muda: a Previsão
  soma os ajustes aprovados e mostra o valor "antes". Na aprovação, o saldo do mês é conferido de novo.
- **Preparar estrutura** passa a acrescentar colunas novas em abas que já existem (no fim do cabeçalho),
  sem mexer nos dados.

### Construção em duas partes

- **1B.1** — Cadastros (grupos e fontes), exercício, despesas, receitas, RH da folha e painel.
- **1B.2** — Propostas das coordenações, aprovação do exercício, remanejamentos e suplementações.

## Entrega 1C — Execução (resumo, detalhada antes de construir)

1. A importação do realizado não duplica lançamentos, e o que não se reconhece vai para a fila "a classificar".
2. **O realizado de 2026 também é importado**, para comparar ano a ano.
3. A importação usará o mesmo DE-PARA de colunas da folha.

## Indicadores

| Código | Cálculo | Referência |
| --- | --- | --- |
| `custo_folha_centro` | Custo mensal e anual da folha por centro de custo e área | Informativo (1A) |
| `folha_sem_rateio` | Postos ativos sem rateio ou fora de 100% | Alerta se maior que zero (1A) |
| `folha_sobre_receita` | Despesa de RH ÷ receita total | **Alerta acima de 65%** (1B) |
| `dependencia_recursos_publicos` | Receita pública (**inclui Projeto Incentivado**) ÷ receita total | Alerta acima de 70% (1B) |
| `recursos_livres` | Receita livre ÷ receita total | Informativo (1B) |
| `resultado_previsto` | Receita prevista − despesa prevista | Alerta se negativo (1B) |
| `execucao_orcamentaria` | Realizado ÷ previsto, por área, grupo e mês | Informativo (1C) |

> Profissionais cedidos (proposta #125): `folha_sobre_receita`, `dependencia_recursos_publicos` e `recursos_livres` passam a ter a visão "com cedidos" (padrão) e "sem cedidos". Ver `especificacao-cedidos.md`.

## Telas — Entrega 1A

1. **Resumo da folha:** o resumo da aba Estudo no mês escolhido e no ano, os quadros
   (Total geral, sem encargos, CEBAS, FGTS, remuneração + FGTS) e o total por serviço.
2. **Folha de Pagamento:** todas as colunas da aba Estudo, com as calculadas destacadas,
   totais no rodapé, escolha do mês, vista resumida e atalhos (sem lotação, vagas, desligados).
3. **Ficha do funcionário:** todos os campos da aba Estudo, os calculados à vista e a lotação.
4. **Lotação:** grade funcionários × serviços para corrigir vários de uma vez.
5. **Parâmetros** da folha.
6. **Importar planilha:** envio do .xlsx e **DE-PARA escolhido pela pessoa**:
   - Folha: qual aba tem os funcionários, a linha do cabeçalho e qual coluna corresponde a cada
     campo do cadastro (Cargo e Salário atual obrigatórios; Código ou Nome para identificar).
   - Lotação: coluna "Lotação" da própria folha (100%), outra aba (uma linha por serviço com
     Funcionário, Serviço e Percentual, ou uma coluna por serviço) ou nenhuma. O funcionário da
     aba de lotação é achado pelo código ou pelo nome.
   - O app sugere o DE-PARA pelos títulos das colunas; a pessoa confere e muda.
   - Depois: a pessoa escolhe a qual Serviço corresponde cada nome de lotação; relatório antes de gravar.
   - **Reimportar e lotação depois:** quem já está cadastrado (mesmo código, ou mesma vaga) não é
     duplicado e não tem os valores alterados. Se o arquivo trouxer lotação para essa pessoa: sem
     lotação → recebe a do arquivo (a partir da admissão ou de 1º de janeiro); com lotação diferente
     → é atualizada a partir da data escolhida na confirmação (pode desmarcar); igual → nada muda.
     A lotação anterior fica no histórico (nova linha com vigência; nada é apagado).
   - **Só lotação:** o arquivo pode trazer só a aba de rateio (Funcionário, Serviço, Percentual ou uma
     coluna por serviço). O funcionário é achado entre os cadastrados pelo código ou pelo nome (nome
     repetido no cadastro não é usado).

## O que muda fora do módulo (precisa de aprovação)

- **Núcleo:**
  - Novo perfil "Departamento Pessoal".
  - Ligação das permissões do Orçamento aos perfis Diretoria, Financeiro,
    Departamento Pessoal, Coordenação e Leitura.
  - Tudo isso é criado por "Preparar estrutura", sem apagar nada do que já existe.
- **Netlify:** a variável `PLANILHAS` ganha mais duas chaves, `orcamento` e `orcamento_folha`.
- **Drive:**
  - Duas planilhas novas e em branco na pasta da plataforma.
  - As duas precisam de acesso da conta de serviço. Na pasta compartilhada, o acesso já vem automaticamente.

## Pendências (não bloqueiam a Entrega 1A)

- **Diferença entre a folha e o orçamento.** A folha atual custa R$ 6,78 mi por
  ano, e a planilha do orçamento 2027 prevê R$ 8,38 mi em RH (diferença de R$ 1,6 mi).
  Não bloqueia mais a 1B: o orçamento começa do zero, o RH vem da folha e o que
  não está na folha (RPA, terceirizados, rescisões…) entra como itens de RH à parte.
- **Sistema contábil e formato do arquivo do realizado.** A Diretoria vai
  verificar. Isso é necessário antes da 1C.

## Decisões da Diretoria (27/10/2026)

1. Projeto Incentivado conta como recurso público.
2. O limite de referência da folha sobre a receita é 65%.
3. As coordenações de área propõem itens no app.
4. O realizado de 2026 também é importado.
5. Será criado o perfil Departamento Pessoal, que pode ver os salários individuais.
6. A construção começa pela Folha de Pagamento.

## Decisões da Diretoria (28/10/2026)

1. Item de despesa classificado por **Serviço + Grupo de gasto + Fonte**.
2. **Uma fonte por item** (despesa paga por duas fontes vira dois itens).
3. RH = **folha automática + itens de RH à parte**.
4. O orçamento 2027 **começa do zero no app** (sem importar a planilha atual).

## Critérios de pronto — Entrega 1A

- [ ] Regras 1 a 12 da folha com testes
- [ ] Testes de acesso: quem vê os totais, quem vê os valores individuais, quem altera
- [ ] Importador testado com uma planilha fictícia no mesmo formato
- [ ] "Preparar estrutura" cria as abas novas e cabe no limite de 10 segundos
- [ ] `npm run verificar` e `npm run build` verdes
- [ ] Conferido pela Diretoria na prévia, com dados fictícios

## Cadastros em lote e importação de despesas e receitas (v0.8)

- **Grupos de gasto e fontes de recurso em lote:** colar uma lista copiada da planilha
  (Grupo: Nome; RH opcional. Fonte: Nome; Natureza pública/própria; Uso livre/restrito),
  conferir a prévia e confirmar. Nomes já cadastrados (inclusive excluídos) e repetidos são ignorados.
- **Importar despesas e receitas** (Planejamento › Importar despesas e receitas, permissão
  `orcamento.previsao.editar`), no exercício em elaboração, com DE-PARA como o da folha:
  - aba, linha do cabeçalho e coluna de cada campo (despesa: serviço, grupo, fonte, descrição,
    categoria, observação; receita: fonte, descrição, área, situação da captação, observação);
  - valores por coluna de cada mês, valor anual (igual nos 12 meses) ou, nas despesas,
    quantidade × vezes × valor unitário;
  - nomes reconhecidos pelo nome ou código; os outros a pessoa associa a um cadastro **existente**
    (fonte da despesa pode ficar "a definir"; área da receita, "geral");
  - linhas sem descrição, sem serviço/grupo/fonte obrigatórios, sem valor ou com captação
    desconhecida não entram e aparecem no relatório.
- **Reimportar substitui:** a aba `ItensImportados` guarda o que veio de cada importação. Uma nova
  importação do mesmo ano e tipo grava os itens novos e depois cancela os da anterior
  (`ativo = FALSE`, ficam no histórico). Itens lançados à mão e propostas não são tocados.
- **Núcleo:** `gravarLinhas` (armazenamento) e `atualizarVarios` (tabela) gravam muitas linhas
  numa só chamada ao Google, para o cancelamento caber no tempo da hospedagem.

## Rateio dos custos comuns e rateio de fontes (revisão 5, proposta #91, 10/11/2026)

Muda a decisão de 28/10/2026 ("uma fonte por item"; uma fonte por serviço na folha), aprovada pela
Diretoria na issue #91. Arquitetura: ADR-020. Quem não configurar nada continua com o
funcionamento atual. O app **Parcerias** (`src/modulos/parcerias/especificacao.md`) guarda termos,
fontes e aportes.

### Entrega R1 — Regras de rateio dos custos comuns (só Orçamento; não depende das outras)

**Conceitos**
- **Regra de rateio:** diz *quem participa* (áreas e/ou serviços) e *por qual base* ratear.
- **Bases:** partes iguais, m², profissionais (lotação da folha), atendidos, **vagas** (campo novo em
  Centros de custo), custo direto, ou **base própria** cadastrada pela OSC (nome + um valor por serviço).
- **Dois níveis (opcional):** quando os participantes são **áreas**, o valor é dividido entre as áreas
  pela base do nível 1 e, dentro de cada área, entre os serviços diretos pela base do nível 2 (se não
  houver, repete o nível 1). Quando os participantes são **serviços**, há um nível só.
- **Onde a regra vale:** padrão no **Grupo de gasto**; o **item de despesa** pode trocar. Serviços de
  **apoio** e o **administrativo** têm regra própria no cadastro de Centros de custo, e ela vale
  também para a folha de quem trabalha neles. Sem regra, vale a base escolhida no painel (hoje).

**Abas novas** (planilha `orcamento`, sem dados pessoais): `RegrasRateio` (nome único, base do nível 1
e do nível 2, `ativo`), `RegrasRateioParticipantes` (regra × área ou serviço), `BasesRateio` (bases
próprias: nome, `ativo`) e `BasesRateioValores` (base × serviço × exercício × valor).
Colunas novas: `regra_rateio_id` em `GruposGasto`, `Despesas` e `CentrosCusto`; `vagas` em `CentrosCusto`.

**Regras de negócio (com teste)**
1. Nome de regra e de base própria único (sem diferença de acento ou maiúscula).
2. Regra tem ao menos um participante; participantes são todos áreas ou todos serviços, sem repetir.
3. **Ordem de cálculo, sem ciclo:** custos comuns → serviços de apoio → administrativo. Regra de
   apoio só tem serviços diretos como participantes; a do administrativo, áreas ou diretos; a de
   custo comum pode incluir qualquer serviço, e o que apoio ou administrativo receberem segue a regra
   deles.
4. Valor do participante = valor × base do participante ÷ soma das bases dos participantes. A soma
   dos rateios é **exatamente** o valor (centavos ajustados no maior participante).
5. Base da área = soma da base dos seus serviços diretos (50% de profissional conta 0,5).
6. Soma das bases zero → usa o custo direto; se também zero → partes iguais (como hoje).
7. **Precedência:** regra do item > regra do grupo > regra do serviço de origem > base do painel.
8. Item com regra própria pode ficar sem serviço ("Comum"); a área e o serviço do item só valem
   para a regra padrão.
9. O total do orçamento não muda por causa do rateio; só a distribuição entre serviços.
10. Excluir regra ou base própria só se não houver grupo, item ou serviço ativo usando (avisa quantos);
    fica em "excluídos" e pode ser reativada.
11. Regras e bases só se alteram por `orcamento.parametros.editar` (Financeiro); alteração auditada.
    Todos que veem o painel veem o resultado (`orcamento.painel.ver`).

**Telas:** Cadastros › **Regras de rateio** (lista, formulário com participantes e bases, **Dividir
igualmente**, prévia "como ficaria com os valores atuais", exemplo em reais); Cadastros › **Bases
próprias**; campo de regra em Grupo de gasto, Despesa e Centro de custo; na Análise por área, a coluna
"regra usada" em cada rateio e o detalhamento "de onde veio" (comum, apoio, administrativo).

### Entrega R2 — App Parcerias (ver `src/modulos/parcerias/especificacao.md`)

Sem mudança no Orçamento. Cria o app, a planilha `parcerias`, os perfis e `catalogos.ts` (ADR-020).

### Entrega R3 — Fontes dos termos e rateio de fonte nas despesas (depende de R2)

- **Ligar fontes dos termos** (Cadastros › Fontes dos termos): para cada fonte de termo lida de
  Parcerias, escolher (a) a **Fonte do cadastro** (natureza e uso) e (b) a **conta vinculada** da
  Tesouraria (aba `Contas`, classe "vinculada"). Aba `FontesTermo` (fonte do termo → Fonte do
  cadastro e conta). Fonte de termo sem ligação não aparece no rateio. Os indicadores
  `dependencia_recursos_publicos` e `recursos_livres` leem natureza e uso por essa ligação. O aporte
  usa a conta da fonte a que pertence. Há termos com 3 contas (municipal, estadual e federal) e termo
  federal com 2 contas (custeio e piso da enfermagem): cada conta é uma fonte do termo.
- **Categorias do plano de aplicação** (mesma tela): para cada categoria do plano de uma fonte (lida de
  Parcerias), dizer **de onde vem**: um ou mais Grupos de gasto e/ou "Folha de pessoal". Aba
  `CategoriasPlanoOrigens` (fonte do termo, categoria, origem).
- **Rateio de fonte da despesa:** aba `RateioFonte` (despesa, serviço da linha de custo, fonte do termo
  **ou** Fonte própria do cadastro, percentual). A fonte do item continua existindo: sem rateio, vale
  100% nela (nenhum dado antigo muda). **Recurso próprio** = Fonte do cadastro de natureza própria.

**Regras (com teste)**
1. Cada linha de custo (item × serviço rateado) tem rateio de fonte que soma **exatamente 100%**.
2. Só oferece as fontes dos termos **que atendem aquele serviço** na data do item, mais o recurso próprio.
3. Com rateio de fonte, a fonte do item mostra "Várias" e o painel por fonte soma pelas linhas.
4. "A definir" continua permitido só em elaboração; o exercício só se aprova sem "a definir".
5. Fonte de termo encerrada ou fora da vigência não entra em item novo; os já rateados continuam.
6. Rateio em aba com vigência: só inclusões; a linha mais recente vale (como a lotação).
7. Alteração auditada (colunas, não valores). Quem edita: `orcamento.previsao.editar`.
8. **Conta vinculada:** a conta escolhida tem classe "vinculada"; a mesma conta não serve a duas fontes
   de termo ativas ao mesmo tempo (aviso, não bloqueia); se a Fonte da conta na Tesouraria for diferente
   da Fonte do cadastro ligada, aparece o aviso "conta e fonte não combinam" (pega erro como fundo
   errado no cabeçalho de um documento). Só `orcamento.parametros.editar` liga fontes e categorias.
9. **Plano de aplicação (aviso, nunca bloqueia):** no rateio de fonte, a despesa é conferida contra o
   plano da fonte. Aviso quando (a) a categoria da despesa (pela origem do grupo de gasto) **não existe**
   no plano da fonte; (b) o comprometido na categoria, no exercício, passa do **valor da categoria**.
   Se a fonte permite remanejar, (b) vale só para o **total da fonte** e a categoria vira informação.
   Despesa cujo grupo não tem origem ligada a categoria alguma aparece como "sem categoria no plano".
   Isso substitui a pendência "despesas que a fonte não pode pagar".

### Entrega R4 — Rateio de fonte na folha e painel de comprometimento (depende de R3)

- **Folha:** `RateioFonteFolha` na planilha `orcamento_folha` (funcionário, serviço da lotação, fonte,
  percentual, vigência), por **linha de lotação**: soma 100% por funcionário × serviço. Sigilo: liga
  pessoa a fonte, então só quem tem `orcamento.folha.ver_individual` vê por pessoa; os demais veem só
  totais por fonte. Quem edita: `orcamento.folha.editar` (Financeiro e Departamento Pessoal).
  `FontesFolha` (fonte por serviço) vira rateio de 100% para quem ainda não tiver rateio próprio.
- **Painel "Comprometimento das fontes"** (Orçamento › Planejamento), para quem tem `orcamento.painel.ver`:
  por fonte de termo, valor atual (de Parcerias), comprometido no exercício (despesas + folha pelo rateio,
  mês a mês, até o fim da vigência), saldo e %. **Alerta** quando o comprometido passa do valor
  (risco de glosa). Por serviço: custo total (direto + rateios), cobertura por termo e fonte e
  **contrapartida em recurso próprio**. Cada tela com "Ver os números".
- **Horas como base de rateio (R4):** na lotação e no rateio de fonte da folha, cada linha pode ter
  **horas semanais dedicadas** (campo opcional `horas_semanais`, mesma tabela e mesmo sigilo da linha).
  O botão **Calcular pelas horas** preenche os percentuais = horas da linha ÷ soma das horas do
  funcionário (diferença de arredondamento na maior linha). A regra de rateio dos custos comuns ganha a
  base **horas dedicadas** (soma das horas da lotação dos funcionários do serviço; altera o código
  da R1, por isso entra aqui). A equipe do termo em Parcerias (função e horas) aparece como
  referência, sem ligar a pessoa.
- **Contrapartida prevista:** o painel compara o **recurso próprio previsto** do termo e da fonte
  (Parcerias) com o recurso próprio realmente rateado (regra 6).
- **Cronograma e caixa:** o painel mostra, mês a mês, o comprometido contra o **previsto a receber por
  mês** (cronograma de Parcerias, com aportes), indicando meses em que o gasto vem antes do repasse.
- **Plano de aplicação na folha:** a folha entra na categoria "Folha de pessoal" (R3, regra 9).
- **Indicadores novos:** `fonte_acima_do_valor` (alerta se maior que zero), `contrapartida_por_servico`
  (informativo).

**Regras (com teste)**
1. Folha: rateio de fonte por linha de lotação soma 100%; funcionário ativo sem rateio usa a fonte do serviço.
2. Comprometido = Σ custo mensal × % da fonte, nos meses do exercício dentro da vigência do termo.
3. Valor de referência = valor da fonte em Parcerias (valor inicial, global ou per capita × vagas
   custeadas × fator de cobertura, + aportes ativos) na data da consulta; o **previsto por mês** de Parcerias mostra se o
   comprometido vem antes do recebimento (necessidade de caixa).
4. Valores individuais nunca aparecem a quem só tem `orcamento.folha.ver`; leitura individual é auditada.
5. Se Parcerias estiver desligado, o catálogo é vazio e só existe recurso próprio.
6. Contrapartida do serviço = custo total − parcela coberta pelas fontes dos termos.
7. Horas: o percentual calculado soma 100%; sem horas informadas o botão avisa e não muda nada; base
   "horas" sem horas em nenhum serviço da regra cai no custo direto (regra 6 da R1).
8. Comprometido do mês acima do previsto a receber do mês é aviso, nunca bloqueio.

### Fica de fora

Prestação de contas por termo; ligar receita do termo à fonte do termo; conferência dos termos da
Tesouraria com as fontes de Parcerias (regras 16 e 17, já adiadas); anexos.

### Frentes

R1: `telas`, `regras e dados`. R2: ver Parcerias. R3 e R4: `telas`, `regras e dados`.
"Preparar estrutura" acrescenta as abas e colunas novas sem mexer nos dados.

### Fora do módulo (precisa de aprovação)

- **Núcleo / plataforma (R2):** perfis ganham as permissões `parcerias.*`; módulo ativo em
  `src/plataforma`; `catalogos.ts` recriado (ADR-013 e ADR-020). **Netlify:** `PLANILHAS` ganha `parcerias`.
- **Drive:** planilha nova e em branco `parcerias` na pasta da plataforma.

### Critérios de pronto

- [x] R1 (11/11/2026, exceto regra 8, item sem serviço, adiada): regras com testes; o total do orçamento é o mesmo antes e depois
- [ ] R3: conta ligada à fonte, aviso "conta e fonte não combinam" e aviso quando a despesa sai do plano
      de aplicação (com e sem remanejamento), com os termos fictícios no formato dos termos reais
- [ ] R3 e R4: testes de acesso (quem vê por pessoa, quem vê totais, quem altera)
- [ ] Dados antigos (fonte do item, fonte da folha por serviço) dão o mesmo resultado nos painéis
- [ ] `npm run verificar` e `npm run build` verdes; Diretoria confere na prévia com dados fictícios

## Ajustes da onda 2 (issue #116): receita e realizado ligados a projeto

- Situação: aguardando aprovação da Diretoria. Arquitetura: ADR-023. Contexto: `src/modulos/projetos/especificacao.md`,
  seção "Ligações, onda 2" (evento de captação). Depende da Execução 1C.1 (`Realizado`) e da onda 1 (issue #115).
- **Aba `Realizado`**: + `projeto_id` e `projeto_codigo` (cópia), opcionais, em linhas de despesa e de receita.
  A grade **Execução › Informar realizado** ganha o campo opcional **"Projeto"** em cada linha (lista dos projetos
  ativos que o Projetos oferece à plataforma; sem Projetos, o campo some). Linha com projeto continua somando
  normalmente nos totais, no painel e nos indicadores; o campo só marca de que projeto ela é.
- **Receita vinda do projeto**: na porta 2 de um evento de captação, o Projetos pede à plataforma um item de
  **Receita "A captar"** na Fonte de natureza própria escolhida, com o valor da meta de receita (mesmo caminho
  que a onda 1 usa para os custos). Cancelado ou parado encerra o item; nova versão troca o valor sem apagar.
  O item mostra a origem ("Projeto PRJ-0001") e só o Projeto o altera.
- **Leitura para o projeto** (`resultadoDoProjeto`): devolve receita realizada, custo realizado e quantidade de
  lançamentos do projeto; **passa pelo `Autorizador`** (`orcamento.painel.ver`). Sem lançamentos devolve "sem
  lançamentos", nunca zero. Valores não são dados pessoais.
- Regra de teste: linha de Realizado com projeto aparece no resultado do projeto e **também** nos totais do
  Orçamento, uma vez só; projeto desligado não quebra a grade.

## Código da conta contábil nos cadastros (proposta #127, 14/11/2026)

**Objetivo:** o Financeiro conferir um grupo de gasto ou uma fonte com a conta da contabilidade
pelo código, sem tabela de correspondência à parte. O código vem do sistema contábil da OSC; o Elo
**não mantém plano de contas** (decisão da Diretoria, 10/11/2026). Quem não preencher usa o
Orçamento como hoje.

**Decisões da Diretoria (comentário da issue):** o campo entra em **Grupos de gasto** e em **Fontes
de recurso** (não entra nas Contas da Tesouraria nem nos Serviços); o código aparece nas listas e
telas **e** ganha um botão "Baixar planilha".

### Usuários e permissões

Sem permissão nova. Quem vê e quem altera segue os cadastros: alterar o código = Financeiro
(`orcamento.previsao.editar`); quem vê os cadastros e as listas vê o código. O código não é dado
pessoal nem sensível (sem `sigilo`).

### Entidades

- `GruposGasto` (planilha `orcamento`): coluna nova `codigo_conta` (`textoOpcional()`).
- `Fontes` (planilha `orcamento`): coluna nova `codigo_conta` (`textoOpcional()`).
- Linhas antigas ficam com a coluna vazia; "Preparar estrutura" acrescenta a coluna sem mexer nos dados.
- O código é texto (guarda zeros à esquerda e pontos, como `3.1.02.001`); o Elo não interpreta nem
  valida o formato do plano de contas.

### Regras de negócio (com teste)

1. O código é opcional. Aceita letras, números, ponto, hífen e barra; espaços das pontas e repetidos
   são limpos; no máximo 30 caracteres. Fora disso, o cadastro recusa e diz o que está errado.
2. O código é **único dentro do cadastro**, entre os registros ativos (grupo com grupo, fonte com fonte),
   sem diferença de maiúscula ou espaço. Repetido: recusa e diz qual grupo/fonte já usa o código.
   Grupo e fonte podem ter o mesmo código entre si (são planos diferentes: despesa e receita).
3. Excluir um grupo/fonte libera o código; reativar recusa se o código já foi tomado por outro
   (avisa qual) — a pessoa altera o código na hora de reativar ou antes de reativar o outro.
4. Adicionar, alterar e cadastrar em lote gravam `codigo_conta` com a versão lida e registram
   auditoria com a coluna alterada, nunca o valor.
5. **Cadastro em lote:** a lista colada ganha uma coluna opcional "Código da conta" (grupo:
   Nome; Tipo; Código. Fonte: Nome; Natureza; Uso; Código). Código repetido na lista ou já usado
   aparece na prévia como erro da linha, e a linha não entra.
6. **Importar despesas e receitas:** a coluna "reconhecer pelo nome ou código" passa a casar também
   pelo `codigo_conta` do grupo e da fonte (além do nome). Se o código casar com um só registro, usa-o;
   nome e código que apontam para registros diferentes contam como não reconhecido (a pessoa associa
   na tela, como hoje).
7. **Baixar planilha** (CSV aberto no Excel e no Google Planilhas, com acentos corretos e separador
   de ponto e vírgula), gerada pela camada de aplicação, só para quem já pode ver a lista:
   - Cadastros (grupos e fontes): nome, código da conta, demais campos do cadastro (ativos).
   - Despesas e receitas do exercício na tela: uma linha por item, com **código da conta do grupo**
     e **código da conta da fonte** em colunas próprias, além de serviço, grupo, fonte, descrição e
     valor anual e mensal. Valores como número puro (sem "R$"), para somar na planilha.
   - Despesas da folha (automáticas) entram no total mensal por serviço como na lista, sem valor
     individual de pessoa: o arquivo respeita as mesmas regras de quem vê individual (regra de
     Folha 1A); quem só vê totais recebe só totais.
   - Células que começam com `=`, `+`, `-` ou `@` recebem apóstrofo na frente (evita fórmula
     executada ao abrir o arquivo; texto do usuário nunca vira fórmula).
   - Baixar não grava nada; não gera auditoria de leitura (sem dado sensível).
8. Painéis e totais **não mudam**: o código só aparece como rótulo. Agrupar ou somar por código é outra
   proposta.

### Telas

Quem usa: o Financeiro, ao cadastrar e conferir com a contabilidade; coordenações e Diretoria só
leem. Caminho mais curto: Cadastros › Grupos de gasto (ou Fontes) › Alterar › digitar o código › Salvar
(3 cliques, nada se perde ao cancelar).

1. **Cadastros de Grupos de gasto e de Fontes de recurso** (`/orcamento/previsao/grupos`, `.../fontes`):
   - Lista ganha a coluna **Código da conta** (vazio mostra "—", não texto de erro), logo depois do nome,
     e um campo de busca já existente continua achando por nome; passa a achar também por código.
   - Formulários Adicionar/Alterar ganham o campo **Código da conta contábil (opcional)**, com a dica
     "Como está no sistema da contabilidade, por exemplo 3.1.02.001". Rótulo sempre visível.
   - Erro (código repetido ou caractere inválido): a janela continua aberta, com tudo o que a pessoa
     digitou, e a mensagem diz qual grupo/fonte já usa o código e que ela pode alterar este ou aquele.
   - Gravou: aviso "Grupo salvo." / "Fonte salva." (como hoje).
   - Sem permissão: sem os botões Adicionar/Alterar/Excluir; a coluna aparece.
   - Botão **Baixar planilha** ao lado de "Cadastrar em lote" (ação secundária; "Adicionar" continua a principal).
   - Cadastro em lote: exemplo de linha da prévia com a coluna nova e o texto de ajuda explicando que a
     coluna é opcional.
2. **Despesas e Receitas do exercício** (`/orcamento/previsao/despesas`, `.../receitas`): a tabela
   mostra o código sob o nome do grupo e da fonte em texto menor (não ganha coluna nova, para não
   estourar a largura); **Baixar planilha** no cabeçalho da lista, respeitando o ano e os filtros em tela
   (diz no botão: "Baixar planilha (ano 2027)").
3. **Celular e teclado:** a lista de cadastros usa o padrão responsivo atual (o código vira uma linha do
   cartão); campos e botões na ordem natural; o download é um link com rótulo, alcançável por teclado.
4. **Estado vazio do arquivo:** sem itens no exercício, o botão fica desligado com a dica "Nada para baixar
   ainda". Erro ao gerar: mensagem simples e a pessoa pode tentar de novo.
5. **Componentes de `src/ui/`:** os mesmos que os cadastros já usam (`JanelaFormulario`, campos, tabela,
   `BotaoEnviar`, botão fantasma). Nenhuma peça nova; não há gráfico.
6. **Ação sem volta:** não há (o código se altera sempre; excluir é reversível, como hoje).
7. **Sugestões (não estão na proposta, a Diretoria decide):** (a) mostrar o código também nos painéis
   (rótulo das barras e tabelas), (b) avisar na tela de Cadastros quantos grupos/fontes ainda estão sem
   código ("12 de 15 com código"), (c) filtrar a lista por "sem código".

### Fica de fora

Código nas Contas da Tesouraria e nos Serviços; plano de contas mantido pelo Elo; validar o formato do
código; somar ou agrupar painéis por código; **casar o realizado da contabilidade pelo código** (depende da
importação do realizado, já no roadmap — esta entrega só deixa o código pronto para ela); exportar outras
telas (Tesouraria, Realizado, Histórico).

### Frentes

`telas`, `regras e dados`. Sem infraestrutura. Fora do módulo: nenhuma mudança no Núcleo (a exportação
é uma rota em `src/app/(elo)/orcamento/` que chama um caso de uso do módulo, no padrão das rotas de anexos).

### Decisões tomadas sozinho

- Código único dentro de cada cadastro (se a contabilidade usar o mesmo código para dois grupos, a
  Diretoria precisará liberar; custo: pequeno, é retirar a regra 2).
- CSV em vez de arquivo .xlsx (sem biblioteca nova; abre no Excel e no Google Planilhas).
- Código em texto livre de até 30 caracteres, sem validar formato.

### Entrega

Uma só (pequena): colunas e regras 1–6, telas dos cadastros, depois o botão "Baixar planilha" (regra 7).

### Critérios de pronto

- [x] Testes: código opcional, limpeza, único por cadastro, reativação, lote, importação por código, CSV
      (acentos, número puro, proteção de fórmula, quem vê totais x individual), acesso (quem altera, quem só vê)
- [x] Dados antigos sem código funcionam como antes; "Preparar estrutura" acrescenta as colunas
- [x] Na prévia (dados fictícios): alterar um grupo e uma fonte com código; ver o código nas listas e nas
      despesas; tentar repetir um código (mensagem clara); baixar a planilha e abrir no Excel/Google Planilhas
- [x] `npm run verificar` e `npm run build` verdes
