# Especificação — Módulo Orçamento

- Situação: revisão 3 (27/10/2026): estrutura da aba Estudo; sem Tabela Salarial; centros de custo = Serviços
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

## Regras de negócio — Entregas 1B e 1C (resumo, detalhadas antes de construir)

1. Valor do item = quantidade × ocorrências × valor unitário, calculado pelo app.
2. A distribuição mensal do item soma exatamente o valor do item.
3. Todo item e todo lançamento tem fonte de recurso. A fonte pode ficar "a definir"
   durante a elaboração, mas o exercício só é aprovado com todas as fontes preenchidas.
4. **As coordenações de área propõem itens da própria área**; o Financeiro aceita, ajusta ou recusa.
5. Exercício aprovado só muda por remanejamento aprovado pela Diretoria.
6. A previsão de Recursos Humanos é gerada a partir da folha (custo × rateio, mês a mês).
7. A importação do realizado não duplica lançamentos, e o que não se reconhece vai para a fila "a classificar".
8. **O realizado de 2026 também é importado**, para comparar ano a ano.

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
  ano, e o orçamento 2027 prevê R$ 8,38 mi em RH. Falta explicar a diferença de
  R$ 1,6 mi. A Diretoria vai conferir. Isso é necessário antes da 1B, porque a
  previsão de RH passa a vir da folha. As vagas previstas e o reajuste,
  cadastrados na 1A, já devem explicar parte dela.
- **Sistema contábil e formato do arquivo do realizado.** A Diretoria vai
  verificar. Isso é necessário antes da 1C.

## Decisões da Diretoria (27/10/2026)

1. Projeto Incentivado conta como recurso público.
2. O limite de referência da folha sobre a receita é 65%.
3. As coordenações de área propõem itens no app.
4. O realizado de 2026 também é importado.
5. Será criado o perfil Departamento Pessoal, que pode ver os salários individuais.
6. A construção começa pela Folha de Pagamento.

## Critérios de pronto — Entrega 1A

- [ ] Regras 1 a 12 da folha com testes
- [ ] Testes de acesso: quem vê os totais, quem vê os valores individuais, quem altera
- [ ] Importador testado com uma planilha fictícia no mesmo formato
- [ ] "Preparar estrutura" cria as abas novas e cabe no limite de 10 segundos
- [ ] `npm run verificar` e `npm run build` verdes
- [ ] Conferido pela Diretoria na prévia, com dados fictícios
