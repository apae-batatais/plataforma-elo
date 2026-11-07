# Especificação — Orçamento: Execução, Tesouraria e Histórico (Entregas 1C, 1D e 1E)

- Situação: **aprovada em 07/11/2026 pela Diretoria**
- Dono do produto: Diretoria
- Complementa `especificacao.md` deste módulo. Detalha a Entrega 1C (Execução), que lá está só em
  resumo, e propõe duas entregas novas: 1D (Tesouraria) e 1E (Histórico). Depois de aprovada, entra
  no `especificacao.md` e este arquivo sai.
- Base: estudo das planilhas financeiras de 2016 a 2026 (projeto "Financeiro" no claude.ai), o painel
  provisório "Análise financeira da Apae Batatais" e a proposta de acompanhamento, revisão 3.
- Arquitetura: ADR-011. Planilha é só armazenamento; contas, regras, permissões e auditoria ficam no app.

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
| **1D.1 — Contas e saldos** | Cadastro das contas (livre disponível, reserva, vinculada); saldo do extrato por mês; ajustes de conciliação; conferência dos termos | — (pode começar antes da 1C) |
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
