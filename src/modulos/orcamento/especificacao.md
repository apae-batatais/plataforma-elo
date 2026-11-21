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

## Rateio de fonte, R3 e R4: detalhamento para a construção (issue #140)

Continuação da #95. **Não muda nenhuma decisão aprovada** das seções R3 e R4 acima; só diz como construir, em
que ordem e o que cada tela mostra. Situação: aguardando aprovação da Diretoria. Arquitetura: ADR-020 (sem ADR nova).

### O que já existe (conferido no código em 14/11/2026)

- Parcerias (R2) já expõe `termosParaOrcamento` (`src/modulos/parcerias/index.ts`): termo, serviços, fontes com
  `valorAtual`, `parcelas`, `aportesParcelas`, `recursosProprios`, `permiteRemanejar`, `categorias` (plano) e `equipe`
  com horas. Nada em `src/plataforma` entrega isso ao Orçamento ainda.
- Orçamento tem `Despesas.fonte_id`, `FontesFolha` (fonte por serviço), `Rateios` (lotação por `posto_id`, na aba
  `Lotacoes`), `Contas.fonte_id` (conta vinculada), regras de rateio R1 e o resumo da folha. Falta tudo de `FontesTermo`,
  `CategoriasPlanoOrigens`, `RateioFonte`, `RateioFonteFolha`, `horas_semanais` e o painel.
- Passivo (P2.10) e Painel de sustentabilidade (S4) já preveem trocar `FontesFolha` pelo percentual do R4 e
  reaproveitar o painel de comprometimento. Por isso o cálculo do percentual por fonte fica numa função única (decisão 3).

### Entregas (cada uma conferível na prévia, nesta ordem)

| Entrega | O que traz | Como a Diretoria confere |
| --- | --- | --- |
| **R3a** | Catálogo de Parcerias na plataforma; Cadastros › **Fontes dos termos** (ligar fonte do termo à Fonte do cadastro e à conta vinculada; categorias do plano e origem); avisos de conta | Ligar as fontes dos termos fictícios e ver o aviso "conta e fonte não combinam" |
| **R3b** | **Rateio de fonte** em cada despesa; fonte do item "Várias"; avisos do plano de aplicação | Dividir uma despesa entre um termo e o recurso próprio; ver o aviso de categoria fora do plano |
| **R4a** | Rateio de fonte na folha (`RateioFonteFolha`), `horas_semanais`, **Calcular pelas horas** e a base "horas dedicadas" | Dividir a fonte de um funcionário; calcular pelas horas |
| **R4b** | Painel **Comprometimento das fontes**, contrapartida, caixa mês a mês e os dois indicadores | Ver o comprometido, o saldo, o alerta de glosa e a contrapartida por serviço |

R3a, R3b e R4a podem ser três PRs seguidos; R4b só depois de R3b e R4a. Quem não ligar nenhuma fonte de termo vê o
Orçamento exatamente como hoje (regra 10).

### Decisões de construção (tomadas sem pergunta; ver o custo no PR)

1. **Catálogo:** a plataforma ganha `src/plataforma/catalogos.ts`, que entrega ao Orçamento a interface
   `CatalogoParcerias` (a mesma forma de `TermoParaOrcamento`), pelo caminho da ADR-013, como a ADR-020 já previa.
   O Orçamento define a interface, não importa Parcerias. Parcerias desligado = catálogo vazio. É a única mudança
   fora da pasta do Orçamento (precisa da aprovação desta especificação).
2. **"Funcionário" é o posto** da aba `Funcionarios` (`posto_id`), a mesma chave da lotação (`Rateios`). O
   `RateioFonteFolha` é gravado por lote, como a lotação: (`posto_id`, `lote`, `servico`, `fonte`, `percentual`,
   `vigencia`); só inclusões, vale a vigência mais recente. A fonte é "termo:<id da fonte>" ou "cadastro:<id da Fonte
   própria>". O mesmo desenho vale para `RateioFonte` da despesa, que também guarda `lote`.
3. **Função única do percentual por fonte**, em `dominio/` (pura): `percentuaisDeFonte(linha, mês)`, usada pelo painel,
   pelo resumo da folha e, depois, pelo passivo e pelo Painel de sustentabilidade. Ordem de busca: rateio próprio da
   linha → rateio de 100% derivado de `FontesFolha` (folha) ou de `Despesas.fonte_id` (despesa) → "a definir". A
   conversão é **só na leitura**: nenhum dado antigo é regravado.
4. **Linha de custo** da despesa = item × serviço que o rateio de custos comuns (R1) atribui; o valor mensal da linha
   é o valor do item nos meses da distribuição × a parte do serviço. O percentual de fonte vale sobre esse valor.
5. **Comprometido do termo é acumulado por exercício, não só do exercício aberto**, porque o valor atual da fonte
   cobre toda a vigência: soma os exercícios com orçamento cadastrado, mês a mês, dentro da vigência. A tela mostra o
   quebrado por ano e, quando a vigência passa de um ano sem orçamento cadastrado, um aviso "faltam exercícios:
   2027" (o comprometido está subestimado). A regra 2 de R4 continua valendo mês a mês.
6. **Horas na base de rateio dos custos comuns**: o cálculo de R1 (`dominio/rateio-custos.ts`) ganha a base `horas`
   (regra 7 de R4). Mexe só em código do Orçamento.
7. **Vaga prevista** (posto sem ficha) também tem rateio de fonte e entra no comprometido, com o rótulo "vaga".
8. **Aviso de vigência:** fonte de termo que vence antes de um mês com custo rateado nela entra como aviso "custo
   depois do fim do termo" no painel (nunca bloqueia), porque o comprometido só conta até o fim da vigência.

### Telas e usabilidade

**Cadastros › Fontes dos termos** (R3a). Quem: Financeiro, ligando as fontes uma vez, e de novo a cada fonte nova.
Caminho: abrir a tela, escolher a Fonte do cadastro e a conta em cada linha e **Salvar ligação** (3 cliques por fonte).
- Primeira dobra: aviso "N fontes de termos ainda sem ligação" (quando houver) e a tabela das fontes (termo,
  fonte, Fonte do cadastro, conta vinculada, situação). Ação principal: **Salvar ligação**.
- Componentes: `CabecalhoPagina`, `Secao`, `Aviso`, `TabelaDados`, `Campo`, `BotaoEnviar`, `Etiqueta` ("Sem ligação",
  "Ligada", "Conta e fonte não combinam"), `Janela` para as categorias do plano, `EstadoVazio`.
- Estados: **vazio** (Parcerias desligado ou sem termos em vigor): "Nenhum termo em vigor. Cadastre o termo em
  Parcerias para ligar as fontes aqui." **Gravando**: botão em andamento. **Gravou**: "Ligação salva." **Erro**: "A
  planilha mudou enquanto você editava. Atualize a página e refaça só esta linha." (versão lida, nada digitado se
  perde nas outras linhas). **Sem permissão**: lista só leitura com "Só o Financeiro liga as fontes."
- Formulário: dois campos por fonte (Fonte do cadastro obrigatória; conta vinculada opcional, com dica "Escolha a
  conta onde o repasse deste termo entra"). A mesma conta em duas fontes ativas mostra aviso, sem bloquear.
- Categorias do plano (janela por fonte): cada categoria lida de Parcerias com "De onde vem" (um ou mais Grupos de
  gasto e/ou "Folha de pessoal"). Sem origem = "sem categoria no plano" nos avisos, sem erro.
- Celular: a tabela rola de lado e cada linha vira cartão empilhado; teclado: Tab percorre campo a campo, Enter salva.

**Rateio de fonte na despesa** (R3b). Quem: Financeiro e Coordenação com `orcamento.previsao.editar`. Caminho: no
formulário do item, seção **Fontes do recurso** com "Dividir entre fontes"; sem clicar nada o item segue com uma fonte.
- A seção mostra, por serviço da linha de custo, as fontes oferecidas (só as que atendem o serviço na data, mais o
  recurso próprio), percentual de cada uma e o **total em tempo real** ("Soma: 100%", em vermelho com texto
  "Faltam 20%" fora disso). Botão **Dividir igualmente**.
- Estados: gravar só liga com soma 100% em todas as linhas; erro "O rateio de <serviço> soma 90%. Ajuste para 100%." e
  o que foi digitado fica na tela. Avisos do plano (`Aviso`): "Esta despesa não tem categoria no plano de aplicação
  de <fonte>" e "O comprometido em <categoria> passa do valor do plano em R$ X"; nunca impedem gravar.
- Na lista de itens, a coluna Fonte mostra "Várias" (com a dica da divisão ao passar o mouse).
- Ação sem volta: nenhuma (o rateio é uma inclusão; voltar é incluir outra).

**Rateio de fonte na folha** (R4a). Quem: Financeiro e Departamento Pessoal (`orcamento.folha.editar`). Fica na
ficha do funcionário, ao lado da lotação (mesma tela e mesmo sigilo), e como grade na tela **Lotação**: cada linha de
lotação ganha as colunas **Horas semanais** (opcional) e **Fontes** (uma ou mais, com percentual). Botão **Calcular
pelas horas**: preenche os percentuais; sem horas, o aviso "Informe as horas semanais de cada serviço para calcular"
e nada muda. Quem tem só `orcamento.folha.ver` vê apenas **totais por fonte**, sem nome (estado "sem permissão" para
a ficha, com "Peça ao Departamento Pessoal ou ao Financeiro."). A equipe do termo (função e horas, de Parcerias) aparece
como referência ao lado, sem ligar a pessoa. Abrir a ficha continua gravando a leitura individual na auditoria.

**Painel "Comprometimento das fontes"** (R4b), Orçamento › Planejamento, para `orcamento.painel.ver`.
Pergunta: *alguma fonte vai gastar mais do que tem, e quanto cada serviço consome de recurso próprio?*
- Primeira dobra: faixa de alertas ("2 fontes acima do valor", "1 mês com gasto antes do repasse") e a **tabela das
  fontes** (termo, fonte, valor atual, comprometido, saldo, %). Ação principal: abrir "Ver detalhe" da fonte em alerta.
- Gráficos (todos com `descricao`, "Ver os números" e série ≤ 4):
  1. *Quanto de cada fonte já está comprometido?* `Indicadores`, % comprometido de cada fonte com referência
     tracejada em 100% (`sentido: 'ate'`). Título: "Fontes acima de 100% correm risco de glosa". Leitura ao lado: o que
     fazer ("Reveja o rateio ou peça aditivo"). Sem dados: "—", nunca zero.
  2. *Em que meses o gasto vem antes do repasse?* `Linhas` com duas séries (comprometido do mês, previsto a receber)
     para a fonte escolhida, formato moeda. Título: "O gasto passa do repasse em <meses>". Sem cronograma em
     Parcerias: o gráfico some e aparece "Cadastre o cronograma do termo para ver o caixa."
  3. *Quanto cada serviço cobre com termos e com recurso próprio?* `Barras100` por serviço (termos × recurso próprio
     × sem fonte). Título: "<Serviço> sustenta X% do custo com recurso próprio". Serviço sem custo não aparece.
  4. Contrapartida: tabela por serviço (custo total, coberto pelos termos, recurso próprio, previsto em Parcerias).
- Estados: sem fonte ligada → `EstadoVazio` "Ligue as fontes dos termos para ver o comprometimento" com o botão
  **Ligar fontes dos termos**; exercício parcial → nota "faltam exercícios" (decisão 5); sem permissão → a tela não
  aparece no menu.
- Celular: tabela com rolagem lateral e gráficos em largura total; **Ver os números** é o caminho do leitor de tela.

**Sugestões de melhoria (para a Diretoria decidir, fora desta entrega):** (a) mostrar na ficha do termo, em
Parcerias, um atalho "Ver comprometimento no Orçamento" para quem tem as duas permissões (ligação entre apps, passa
por `src/plataforma`); (b) aviso por e-mail ou na agenda quando uma fonte passar de 90% do valor.

### Fica de fora (além do que a seção R4 já adia)

Ligação entre pessoa e termo em Parcerias; alerta de glosa por categoria do plano na folha (só total, no aviso de
R3, regra 9); exportar o painel em planilha.

### Frentes e critérios de pronto

Frentes: `telas`, `regras e dados`. **Fora do módulo:** `src/plataforma/catalogos.ts` (decisão 1), sem mudança no Núcleo.
"Preparar estrutura" acrescenta as abas e colunas novas (`FontesTermo`, `CategoriasPlanoOrigens`, `RateioFonte`,
`RateioFonteFolha`, `horas_semanais`) sem mexer nos dados.

- [x] R3a (15/11/2026): ligação e conta com os termos fictícios no formato dos termos reais (3 contas; federal com 2 contas)
- [ ] R3b: soma 100% por linha de custo, fontes só do serviço e da data, avisos do plano com e sem remanejamento
- [ ] R4a: rateio por linha de lotação, sigilo por pessoa, "Calcular pelas horas" com arredondamento na maior linha
- [ ] R4b: comprometido igual à soma das linhas; sem rateio nenhum, os painéis dão o mesmo número de hoje
- [ ] Testes de acesso em cada entrega: quem vê por pessoa, quem vê totais, quem altera
- [ ] `npm run verificar` e `npm run build` verdes; prévia conferida com dados fictícios

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
**não mantém plano de contas** (decisão da Diretoria, 10/11/2026; **revertida em 20/11/2026**, ver
"Plano de contas estruturado (proposta #221)" mais abaixo). Quem não preencher usa o Orçamento como hoje.

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

## Painel de sustentabilidade financeira (proposta #131, 14/11/2026)

Especificado em `especificacao-sustentabilidade.md` (cobertura do déficit dos serviços, origem e dependência, fôlego, resultado e
execução das parcerias). Acrescenta a coluna `origem` em `CentrosCusto`, `recorrencia` em `Fontes` e a aba `LimitesSustentabilidade`.

## Plano de contas estruturado (proposta #221, 20/11/2026, ADR-036)

**Substitui a decisão da #127** ("o Elo não mantém plano de contas"), por decisão da Diretoria em 20/11/2026.
**Objetivo:** o Financeiro cadastra o plano de um exercício dentro do Elo; previsto e realizado do mesmo
exercício usam o mesmo plano; comparar dois exercícios mostra o que entrou e o que saiu; e a divergência
entre a área da contabilidade e a área do serviço aparece sem cruzar planilhas. Responde as perguntas P1
(correspondência de centro de custo) e P2 (nível da conta que vira grupo) da #185; P3 a P6 continuam com a
Diretoria e a contabilidade.

### Decisões da Diretoria (20/11/2026, na proposta)

1. O plano estruturado substitui o texto livre. 2. Grupo de Contas é um conceito único e incorpora o Grupo
de gasto. 3. A Área do plano é independente da Área do Serviço. 4. Habilitar Itens por Área só orienta.
5. Vigência por exercício, no padrão de Lotações e Rateios. 6. Uma proposta; o Arquiteto divide em entregas.

### Usuários e permissões

Sem permissão nova, igual aos cadastros de grupos de gasto: alterar Áreas, Grupos, Itens e o plano =
Financeiro (`orcamento.previsao.editar`); ver = quem já vê os cadastros e a Previsão. Coordenação e Leitura
só leem. Nada aqui é dado pessoal (sem `sigilo`). Toda gravação usa `inserir`/`atualizar` com a versão lida e
`registrarAuditoria` com as colunas alteradas, nunca os valores.

### Entidades (planilha `orcamento`, declaradas com `definirTabela`)

- **`GruposGasto` = Grupo de Contas** (mesma aba e mesmos ids): `nome`, `rh`, `regra_rateio_id` e
  `codigo_conta` ficam como estão. Na tela vira "Grupo de Contas". Sem migração de dados.
- **`AreasPlano`** (nova): `nome`, `codigo` (`textoOpcional`, mesmas regras de `dominio/codigo-conta.ts`,
  único entre ativos).
- **`ItensContabeis`** (nova): `grupo_id`, `nome`, `codigo` (opcional, único dentro do grupo entre ativos).
  Um item pertence a um só grupo.
- **`PlanoContas`** (nova, só inclusões): `exercicio` (ano), `lote`, `vigencia` (data dentro do ano),
  `area_id`, `grupo_id`, `item_id` (vazio = grupo presente na área sem itens habilitados). Um lote é o plano
  completo daquele exercício naquela data.
- **`Despesas` e `Realizado`**: colunas opcionais `item_id` e `area_plano_id` (linhas antigas ficam vazias;
  "Preparar estrutura" acrescenta as colunas sem mexer nos dados).
- **`Fontes.codigo_conta` continua** (decisão sozinho 1 abaixo).

### Regras de negócio (com teste)

1. **Cadastros**: Área, Grupo de Contas e Item têm nome obrigatório (único entre ativos no seu cadastro, sem
   diferença de maiúscula ou espaço) e código opcional (regras da #127: até 30 caracteres, único entre ativos,
   reativar recusa se o código foi tomado). Excluir encerra (`ativo = FALSE`); nada se apaga. Excluir Grupo ou
   Item usado em despesa, realizado ou plano continua permitido, mas o confirmar diz quantos lançamentos usam.
2. **Plano por exercício**: o Financeiro monta o plano marcando, por Área, os Grupos e, em cada Grupo, os
   Itens habilitados. Salvar grava um lote novo com **todas** as linhas do plano (tudo ou nada, com a versão
   lida); nunca altera nem apaga o lote anterior. Plano vazio não grava.
3. **Vigência**: `vigencia` é uma data dentro do exercício (padrão: 1º de janeiro, ou hoje se o exercício já
   começou); o plano que vale numa data é o lote mais recente com `vigencia` ≤ a data. Vigência fora do ano é
   recusada. Plano de exercício `encerrado` não aceita lote novo.
4. **Copiar de um exercício**: "Começar do plano de <ano anterior>" preenche o formulário com o plano que
   valia no fim do outro exercício; nada é gravado até a pessoa salvar. Sem plano anterior, o botão não aparece.
5. **Só entra o que está ativo**: Área, Grupo ou Item encerrado não pode entrar num plano novo; o que já
   estava em plano antigo continua lido normalmente (aparece com a marca "encerrado").
6. **Consistência**: todo Item do plano pertence ao Grupo da mesma linha; todo par (Área, Grupo) aparece uma só
   vez por lote; Item sem o Grupo no mesmo lote é recusado.
7. **Orienta, nunca bloqueia**: ao lançar despesa ou realizado com Grupo, Item ou Área fora do plano do
   exercício (na data do lançamento), grava normalmente e mostra o aviso "Este item não está habilitado para
   esta área em <ano>". Item de outro Grupo que o escolhido é recusado (erro de dado, não de plano).
8. **Escolha na tela de lançamento**: ao escolher a Área e o Grupo, a lista de Itens mostra primeiro os
   habilitados no plano e, abaixo, "Outros itens do grupo" (não habilitados). Sem plano no exercício, mostra
   todos os itens do grupo.
9. **Comparar exercícios** (leitura): entre dois exercícios, lista **o que entrou** e **o que saiu** de Áreas,
   Grupos (por Área) e Itens, mais "mudou de grupo" quando o mesmo item mudou de grupo. A comparação usa o
   plano vigente no fim de cada exercício. Sem plano em um dos lados: estado vazio explicando.
10. **Divergência área do plano × área do serviço** (leitura): lista lançamentos de despesa e de realizado do
    exercício em que `area_plano_id` está preenchida e difere da Área do Serviço (`CentrosCusto`/Núcleo, via o
    caso de uso que o Orçamento já usa), com total por par (Área do plano, Área do serviço), em centavos. O
    filtro de escopo vem **antes** de somar: Coordenação só vê o seu escopo; Leitura vê só totais. Lançamento
    sem `area_plano_id` conta como "sem área do plano", nunca como divergência nem zero.
11. **Código antigo**: o `codigo_conta` dos grupos passa a ser o código do Grupo de Contas, sem perder valor
    nenhum; "Baixar planilha" e a importação por nome ou código seguem funcionando; o CSV ganha as colunas
    **Item contábil** e **Área do plano** nas despesas, e a lista de itens e do plano (um arquivo por exercício).
12. **Painéis e totais não mudam**: nenhum total, indicador ou painel é recalculado pelo plano (somar por Área
    ou Grupo do plano é outra proposta). O total do orçamento nunca muda por causa do plano.
13. **Demonstração**: `popularFicticio` ganha áreas, itens e planos de dois exercícios, sem nome de
    instituição, e algumas despesas com área divergente, para a Diretoria conferir na prévia.

### Telas

Quem usa: o Financeiro monta e mantém; Diretoria e coordenações leem. Menu: Orçamento › Previsão › Plano de contas.

1. **Plano de contas** (`/orcamento/previsao/plano`) — caminho mais curto: abrir › escolher o exercício ›
   "Começar do plano de <ano anterior>" › ajustar › "Salvar plano" (4 cliques, nada se perde se cancelar).
   - Primeira dobra: `SeletorAno`, uma frase de leitura ("Plano de 2027: 6 áreas, 14 grupos, 58 itens, vale
     desde 01/01/2027") e a ação principal **Editar plano** (ou **Montar plano de <ano>** se não há). Abaixo,
     uma seção por Área (`Secao`), com seus Grupos e os Itens habilitados em lista; busca por nome ou código.
   - **Editar**: janela ampla (`Janela`) com a grade Área × Grupo e, ao abrir o grupo, caixas de seleção dos
     Itens (rótulo sempre visível, "Marcar todos"). Campo "Vale a partir de" com a dica "Dentro do ano de
     <ano>". Botão **Salvar plano** (`BotaoEnviar`, mostra "Gravando…").
   - **Estados**: vazio (`EstadoVazio`: "Este exercício ainda não tem plano de contas." com **Montar plano** e,
     se houver, **Começar do plano de <ano>**); gravou (`Notificacao` "Plano de 2027 salvo."); erro (janela
     continua aberta com tudo o que foi marcado, mensagem diz o que corrigir); sem permissão (sem botões, a
     leitura continua); encerrado (`Aviso`: "O exercício está encerrado; o plano não pode mudar.").
   - **Ação sem volta:** não há; salvar cria uma versão nova e o histórico de vigências aparece em
     "Versões anteriores" (`Excluidos`-like, só leitura).
2. **Cadastros** (`/orcamento/previsao/areas` nova; `/grupos` e `/itens` na mesma tela de Grupo): Áreas e
   Grupos de Contas no padrão dos cadastros atuais (`TabelaDados`, `Janela`, `Campo`, `Excluidos`);
   Itens contábeis dentro da janela do Grupo (lista com **Adicionar item**). Texto de tela: "Grupo de Contas"
   (antes "Grupo de gasto"); a dica do código continua "Como está no sistema da contabilidade". Cadastro em
   lote de Áreas e de Itens no mesmo formato do lote atual (Nome; Código; no item, também o Grupo).
3. **Comparar exercícios** (`/orcamento/previsao/plano/comparar`): dois `SeletorAno` ("Comparar 2027 com
   2026"), três blocos "Entrou", "Saiu", "Mudou de grupo", em tabelas (`TabelaDados`) com contagem no título.
   Sem gráfico: é lista de diferenças. Vazio: "Os dois planos são iguais."
4. **Divergências de área** (aba "Divergências" na tela do Plano): título em forma de conclusão ("R$ 120 mil
   foram lançados em área diferente da do serviço") e tabela Área do plano × Área do serviço com total e
   número de lançamentos; clicar abre a lista dos lançamentos. Sem divergência: "Nenhuma divergência em
   2027." e, se há lançamentos sem área, `Aviso` "N lançamentos ainda não têm área do plano".
5. **Formulários de despesa e de realizado**: ganham, depois de Grupo, os campos opcionais **Item contábil** e
   **Área do plano** (dica: "Só orienta: você pode escolher outro"); aviso amarelo do plano (regra 7) abaixo
   do campo, nunca impede **Salvar**. Lista de despesas mostra o item sob o grupo em texto menor.
6. **Celular e teclado:** listas viram cartões (padrão atual); a grade do plano vira uma Área por vez com
   Grupos recolhíveis; ordem natural de teclado; caixas com área de 44 px.
7. **Componentes de `src/ui/`:** `CabecalhoPagina`, `Secao`, `SeletorAno`, `TabelaDados`, `Janela`, `Campo`,
   `BotaoEnviar`, `EstadoVazio`, `Aviso`, `Notificacao`, `Excluidos`, `FormularioConfirmado`. Nenhuma peça
   nova no Núcleo.
8. **Sugestões (não estão na proposta; a Diretoria decide):** (a) avisar nos Cadastros quantos grupos e itens
   ainda estão fora do plano do exercício; (b) botão "Baixar planilha" do plano (já incluído como CSV na
   regra 11, mas sem tela de importação); (c) preencher a Área do plano automaticamente com a do serviço
   quando o lançamento não informar (hoje fica vazia, para a divergência ser real).

### Entregas (cada uma conferível na prévia, nesta ordem)

- **1 de 3 — Cadastros e plano por exercício:** abas novas, Áreas, Grupo de Contas (renome na tela) com Itens,
  tela do Plano com copiar do ano anterior, versões, CSV e demonstração. Regras 1 a 6, 11 (CSV do plano), 13.
- **2 de 3 — Lançamentos orientados pelo plano:** colunas `item_id` e `area_plano_id`, campos e avisos nos
  formulários de despesa e realizado, importação de itens e CSV com as colunas novas. Regras 7, 8 e 11.
- **3 de 3 — Comparar exercícios e divergências:** regras 9 e 10 e as duas telas. Fecha a proposta.

### Fica de fora

Responder P3, P5 e P6 da #185; agrupar ou somar painéis pelo plano; **importar o plano de uma planilha**
(cadastro manual por ora); bloquear lançamento; Itens por Fonte; plano nas Contas da Tesouraria; Núcleo.

### Frentes

`telas` e `regras e dados` (sem infraestrutura). Fora do módulo: nenhuma mudança no Núcleo.
Atualizar o `CLAUDE.md` do módulo (a linha "Sem plano de contas no Elo" deixa de valer) e o plano de
execução da entrega.

### Decisões tomadas sozinho

1. **Fontes mantêm `codigo_conta`.** A proposta diz que o plano substitui o texto livre de Grupos e Fontes,
   mas o plano só tem despesa (Área, Grupo, Itens). Tirar o código das Fontes perderia dado sem substituto e
   quebraria o CSV e a importação por código. *Custo se errado:* retirar o campo das Fontes (pequeno).
2. **Grupo de Contas = mesma aba `GruposGasto`**, sem migração de ids. *Custo:* migrar `grupo_id` se a
   Diretoria quiser separar os dois conceitos (médio).
3. **Plano em lotes completos por exercício**, não linha a linha, como `Lotacoes`. *Custo:* trocar o desenho
   das abas antes de haver dado real (baixo).
4. **Área do plano e Item ficam nos lançamentos (despesa e realizado) como colunas opcionais** e nunca são
   preenchidos sozinhos, para a divergência ser real. *Custo:* preencher depois por regra (baixo).
5. **Existência no exercício = estar no plano daquele ano**; Áreas, Grupos e Itens são cadastros únicos.
   *Custo:* se a Diretoria quiser o mesmo nome com sentido diferente por ano, criar outro cadastro.
6. **Quem edita = Financeiro** (`previsao.editar`), sem permissão nova. *Custo:* criar permissão (baixo).
7. **ADR-036** registra a reversão da decisão da #127.

### Critérios de pronto

- [ ] Testes: cadastros (nome e código únicos, reativação), plano em lote (tudo ou nada, versão lida, só
      inclusão, vigência fora do ano, exercício encerrado), vigência (qual lote vale), copiar do ano anterior,
      item de outro grupo, orientação sem bloqueio, comparação entre exercícios, divergência (escopo antes de
      somar, sem área do plano), acesso (Financeiro altera; coordenação, Leitura e Diretoria só leem)
- [ ] Dados antigos sem plano funcionam como antes; "Preparar estrutura" acrescenta abas e colunas
- [ ] Na prévia: montar o plano de 2027 a partir do de 2026, salvar, ver "Versões anteriores"; lançar uma
      despesa fora do plano e ver o aviso sem bloqueio; comparar 2027 com 2026; ver a divergência de área
- [ ] `npm run verificar` e `npm run build` verdes

## Lançamento de despesas por rateio (proposta #225, 20/11/2026)

### Objetivo

Hoje a Entrega R1 (acima) só **mostra** o rateio calculado na Análise por área; a despesa continua
sendo uma única linha, sem serviço, e nada é gravado por serviço. Esta entrega grava uma **despesa
por serviço participante**, com o valor já rateado pela Regra de rateio escolhida, para quem precisa
ver e exportar a despesa já dividida (não só o resultado no painel). Arquitetura: ADR-038.

### Para quem

Financeiro, ao cadastrar uma despesa prevista que precisa ser dividida entre vários serviços de
forma proporcional (ex.: uma conta de alimentação rateada pelo nº de atendidos de cada serviço).

### Usuários e permissões

- `orcamento.previsao.editar` (Financeiro): cadastra, altera e encerra um Lançamento de rateio. Sem
  permissão nova.
- `orcamento.painel.ver`: vê os Lançamentos de rateio e as despesas que eles geram, junto com as
  demais despesas.

### Entidades

- **Aba nova `LancamentosRateio`** (planilha `orcamento`, sem dados pessoais): `ano`, `grupo_id`,
  `fonte_id`, `descricao`, `regra_rateio_id` (obrigatório, de `RegrasRateio`), `quantidade`,
  `ocorrencias`, `valor_unitario`, `distribuicao`, `m1`..`m12`, `categoria`, `observacao`, `ativo`.
  Mesmos campos de uma despesa (ver `Despesas`), mas sem `servico`: o lançamento não pertence a
  nenhum serviço, a Regra de rateio é que decide quem recebe.
- **Coluna nova opcional `lancamento_rateio_id` em `Despesas`**: presente só nas linhas geradas por
  um Lançamento de rateio. Essas linhas ficam travadas no cadastro comum de Despesas (regra 4).

### Regras de negócio (com teste)

1. O Lançamento de rateio pede os mesmos campos de uma despesa (grupo, fonte, descrição,
   quantidade, ocorrências, valor unitário, distribuição/meses, categoria, observação) mais a
   **Regra de rateio**, que precisa já existir e estar ativa (Cadastros › Regras de rateio).
2. **Cálculo:** o valor de cada mês do lançamento (igual à distribuição de uma despesa comum) é
   dividido entre os serviços participantes da regra pelos mesmos pesos em todos os meses
   (`ratearPelaRegra`, R1) — as bases (atendidos, m², profissionais…) não variam por mês.
3. **Geração:** cada serviço participante com peso maior que zero recebe uma linha em `Despesas`
   com `ano`, `servico` (o do participante), o mesmo `grupo_id`, `fonte_id`, `descricao` e
   `categoria` do lançamento, `quantidade = 1`, `ocorrencias = 1`, `distribuicao = 'manual'`,
   `m1`..`m12` com o valor já rateado daquele serviço, `situacao = 'aceito'` e
   `lancamento_rateio_id` apontando para o lançamento. Sem `regra_rateio_id` próprio (já foi
   aplicada; não entra de novo na Análise por área).
4. **Travamento:** uma despesa com `lancamento_rateio_id` não tem botão de editar valor ou excluir
   no cadastro comum de Despesas; aparece com a etiqueta "Gerada por rateio" e um atalho para o
   Lançamento de origem. Qualquer mudança passa pelo Lançamento (regra 5).
5. **Recálculo automático**, só enquanto o exercício do lançamento está em elaboração
   (`Exercicios.situacao === 'elaboracao'`), nestes cinco pontos (lista fechada; ver ADR-038):
   salvar o próprio lançamento; salvar a Regra de rateio usada; salvar os valores de uma Base
   própria usada pela regra; alterar atendidos, m² ou vagas de um serviço participante; alterar a
   lotação (profissionais) de um serviço participante. Em cada um, as despesas geradas antes são
   encerradas (`ativo = FALSE`) e as novas, recalculadas, são gravadas. Fora desses cinco pontos
   (ex.: um serviço encerrado), não recalcula sozinho — reabrir e salvar o lançamento de novo.
6. **Depois do exercício aprovado**, as despesas geradas ficam congeladas como estão: nenhum dos
   cinco pontos as altera mais (mesma regra de qualquer despesa aprovada: precisaria de
   remanejamento ou suplementação).
7. **Excluir o lançamento** (só com o exercício em elaboração) encerra o lançamento e todas as
   despesas que ele gerou. Com o exercício aprovado, não há como excluir (regra 6).
8. Regra sem nenhum serviço participante elegível (nenhum custo direto recebendo, como na regra 2
   de R1): o lançamento grava normalmente, mas aparece um aviso "Nenhuma despesa gerada: ajuste a
   Regra de rateio" — não bloqueia salvar.
9. Alteração auditada: do Lançamento (colunas, nunca valores) e de cada despesa gerada ou encerrada
   pelo recálculo (com o `lancamento_rateio_id` no detalhe).

### Telas

Orçamento › Despesas › **Lançamento de despesas por rateio** (lista e formulário).

1. **Quem usa e o que quer fazer:** o Financeiro cadastra uma despesa que precisa dividir
   proporcionalmente entre serviços, sem fazer a conta à mão. Caminho mais curto: abrir a tela,
   preencher como uma despesa comum, escolher a Regra de rateio, ver a prévia e salvar.
2. **Lista:** lançamentos do exercício, com descrição, grupo, regra usada, valor anual e quantos
   serviços recebem. Ação principal: "Novo lançamento".
3. **Formulário:** os mesmos campos de uma despesa (`Campo`, com dica e obrigatório) mais a Regra
   de rateio (lista das regras ativas). Antes de salvar, mostra a **prévia** "como ficaria"
   (reaproveita `previaDaRegra`, já existente nas Regras de rateio): quanto cada serviço
   participante vai receber, em reais e percentual, com os valores atuais das bases.
4. **Na lista comum de Despesas:** as linhas geradas mostram a `Etiqueta` "Gerada por rateio" (sem
   botão de editar valor ou excluir) e um link "Ver lançamento de origem" que abre o Lançamento.
5. **Estados:** vazio ("Nenhum lançamento de rateio ainda" + "Novo lançamento"); gravando
   (`BotaoEnviar`); gravou (`?ok=`, com "X despesas geradas/atualizadas"); erro (`Aviso`, sem
   perder o que foi digitado); sem permissão.
6. **Ação sem volta:** excluir um lançamento (regra 7) pede confirmação (`FormularioConfirmado`)
   explicando que todas as despesas geradas por ele serão encerradas.
7. **Celular e teclado:** mesma lista e formulário em largura de celular; prévia em tabela rolável
   na horizontal se precisar.
8. **Sugestão (não está na proposta, a Diretoria decide):** mostrar, na tela do Lançamento, um
   aviso quando a base cair para custo direto ou partes iguais em todos os participantes (regra 6
   de R1), para o Financeiro notar antes de aprovar o exercício.

### Fica de fora

Pesos que variam mês a mês (hoje usa os mesmos pesos em todos os meses); recálculo fora dos cinco
pontos listados (ex.: serviço encerrado); reabrir exercício aprovado para recalcular (segue a regra
normal de remanejamento e suplementação).

### Frentes

`telas`, `regras e dados`. Sem infraestrutura, sem mudança no Núcleo.

### Decisões tomadas sozinho

- **Aba `LancamentosRateio` separada de `Despesas`**, em vez de reaproveitar `Despesas` para a
  "mãe": mantém separado o que é configurado (o lançamento) do que é gerado (as despesas por
  serviço). Se errado: dá para fundir depois (custo pequeno).
- **Mesmos pesos em todos os meses** do lançamento (regra 2): bases como atendidos ou m² não variam
  por mês hoje no Elo. Se a Diretoria quiser peso variável por mês, é entrega nova (custo médio).
- **Lista fechada de cinco pontos de recálculo** (regra 5): cobre os pontos onde a base, a regra ou
  o próprio lançamento mudam hoje no Orçamento. Se faltar um ponto (ex. serviço encerrado), o
  recálculo não dispara sozinho; custo de ampliar a lista depois é pequeno a médio, por ponto.
- **Aviso, não bloqueio, quando não há despesa gerada** (regra 8): evita impedir salvar o
  lançamento enquanto a Diretoria ajusta o cadastro da regra. Custo se errado: pequeno.

### Entrega

Uma só: aba e coluna novas, cadastro e cálculo do Lançamento, geração e travamento das despesas,
recálculo automático nos cinco pontos da regra 5.

### Critérios de pronto

- [ ] Testes: cálculo mês a mês com os pesos da regra; geração e travamento das despesas; cada um
      dos cinco pontos de recálculo; nada muda com o exercício aprovado; excluir o lançamento
      encerra as despesas geradas; auditoria sem valores; acesso (quem edita, quem só vê).
- [ ] Na prévia (dados fictícios): cadastrar um Lançamento com uma Regra de dois níveis; ver a
      prévia antes de salvar; confirmar as despesas geradas na lista comum, travadas, com a
      etiqueta "Gerada por rateio"; mudar a base de um serviço participante e ver o recálculo
      automático; excluir o lançamento e confirmar que as despesas geradas somem (encerradas).
- [ ] `npm run verificar` e `npm run build` verdes.
