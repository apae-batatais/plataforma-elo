# Especificação — Módulo Orçamento

- Situação: **aprovada pela Diretoria em 27/10/2026** (revisão 2); Entrega 1A construída
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
| `orcamento` | CentrosCusto | Centro de custo ligado a uma área do Núcleo (54 hoje, ex.: Apae Rural › Viveiro de mudas) | — |
| `orcamento_folha` | Cargos | Plano de cargos: grupo, cargo, requisitos, classe e carga horária de referência | — |
| `orcamento_folha` | TabelaSalarial | Valor de cada cargo por nível (A a K), com início de vigência | — |
| `orcamento_folha` | Postos | Um colaborador ativo **ou uma vaga prevista**: nº da ficha, colaborador, cargo, nível, carga horária, admissão ou mês de início, desligamento | colaborador: pessoal |
| `orcamento_folha` | Componentes | Valor mensal de cada componente do posto: salário base, adicional, hora atividade, ajuda de custo, bolsa estágio, insalubridade, periculosidade, gratificação de função, plano de saúde, bolsa estudo, locomoção, alimentação | valor: pessoal |
| `orcamento_folha` | Rateios | Percentual de cada posto em cada centro de custo, com início e fim de vigência | — |
| `orcamento_folha` | Parametros | Percentuais de provisões e encargos (férias, 1/3, 13º, FGTS e outros), percentual e mês do reajuste | — |

Na 1B e na 1C entram as abas Exercicios, FontesRecurso, GruposGasto,
ItensDespesa, ItensReceita, Lancamentos, RegrasRateio, FaixasReferencia,
Remanejamentos e MapeamentoImportacao, todas na planilha `orcamento`.

O colaborador é registrado pelo nome e pelo nº da ficha, só na planilha da
folha. A ligação com o Cadastro Único do Núcleo fica para depois. Assim, a
Entrega 1A não altera o Núcleo, exceto pelo perfil novo.

## Regras de negócio — Entrega 1A (Folha)

1. O custo mensal do posto é a soma dos componentes mais as provisões e encargos.
   As provisões são calculadas pelo app a partir dos percentuais da aba
   Parametros, aplicados sobre a base de cálculo que os próprios parâmetros
   definem. Nenhuma fórmula fica na planilha.
2. O salário base vem da tabela salarial (cargo × nível), proporcional à carga
   horária. Pode ser ajustado à mão, e o ajuste fica marcado como "valor diferente da tabela".
3. O rateio de cada posto soma **exatamente 100%**; o app não salva de outro jeito.
   Na planilha atual, 7 de 140 fichas somam 0%, 113%, 125% ou 150%, o que infla a
   folha distribuída em cerca de R$ 11,7 mil por mês.
4. Todo posto ativo tem rateio. Na planilha atual, 6 colaboradores não têm rateio.
   O app mostra esses postos num atalho "sem rateio" até serem corrigidos.
5. O valor mensal de um centro de custo é a soma, para cada posto, do custo do posto × o percentual do rateio.
6. Os percentuais aceitam até duas casas decimais. "Dividir igualmente" ajusta a
   última linha para fechar 100,00% (ex.: 3 centros = 33,33 + 33,33 + 33,34).
7. Um mesmo centro de custo não se repete no rateio de um posto.
8. Vagas previstas (contratações futuras) são postos sem colaborador, com o mês de início.
9. O reajuste vale a partir do mês definido nos parâmetros, sem alterar os meses anteriores.
10. Nada é apagado:
    - Um posto é encerrado com a data de desligamento.
    - Mudar o rateio ou os componentes grava linhas novas com "vale a partir de";
      as anteriores continuam guardadas e valem para os meses antes disso.
    - Assim fica o histórico de quanto cada centro recebeu em cada mês.
11. Os valores individuais só aparecem para quem tem `orcamento.folha.ver_individual`.
    Abrir a ficha de um posto registra uma auditoria de leitura. Os demais perfis veem só os totais.
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

1. **Postos da folha:**
   - Lista com filtros por cargo, área e centro de custo.
   - Atalhos "sem rateio", "rateio diferente de 100%" e "vagas previstas".
   - Mostra o custo total do mês e do ano.
2. **Ficha do posto:**
   - Colaborador (ou "vaga prevista"), cargo e nível da tabela salarial, carga horária e admissão.
   - Os componentes mensais, com o custo total calculado na hora.
3. **Grid de rateio por centro de custo**, dentro da ficha:
   - Uma linha por centro de custo, com as colunas Centro de custo, Percentual,
     Valor mensal e Valor anual. Os valores são calculados.
   - O rodapé mostra o total, com indicador verde só quando a soma é 100%.
   - Botões "adicionar centro de custo" e "dividir igualmente".
   - O botão Salvar fica bloqueado fora de 100%.
4. **Rateio geral:**
   - Grade postos × centros de custo, para revisar vários postos de uma vez.
   - Valem as mesmas validações.
5. **Resumo por centro de custo:**
   - Custo mensal e anual da folha por centro e por área.
   - É a tela que perfis sem acesso individual enxergam.
6. **Tabela salarial e parâmetros**, editados pelo Financeiro.
7. **Importar planilha da folha:**
   - Envio do arquivo .xlsx (Drive → Arquivo → Fazer download → Microsoft Excel).
   - Aproveita as abas Tabela Salarial, Estudo e Rateio, ligadas pelo nº da ficha.
   - Mostra um **relatório antes de gravar**: rateios fora de 100%, postos sem
     rateio, cargos não encontrados e diferenças de custo em relação à planilha.
   - A aba "Folha Pagto Anual 2027" está com fórmulas quebradas (#REF!). Ela é
     substituída pelo cálculo do app.

A importação dos dados reais é feita pela Diretoria, pelo Financeiro ou pelo
Departamento Pessoal, **dentro do app, em produção**. O agente desenvolve e
testa só com dados fictícios no mesmo formato (ADR-008).

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
