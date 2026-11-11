# Especificação — Módulo Parcerias

- Situação: revisão 2 (11/11/2026), ajustada aos planos de trabalho reais; aguardando aprovação da
  Diretoria. A revisão 1 (10/11/2026) foi aprovada no PR #92.
- Dono do produto: Diretoria
- Propostas de origem: issue #91 (parte B) e issue #95 (ajustes a partir dos termos reais).
  Arquitetura: ADR-011 e ADR-020 (revisão de 11/11/2026).

## Objetivo

Cadastrar os **termos de parceria** (MROSC) da OSC: quem é o parceiro, o que o termo cobre, por
quanto tempo, com quais **fontes** de recurso, como o dinheiro **chega mês a mês** e quais
**aportes** vieram ao longo da vigência. O Orçamento usa esse cadastro para ratear o custo entre as
fontes e mostrar quanto de cada uma já está comprometido. Vale para qualquer OSC que trabalhe com
termos: o cadastro cobre termo de colaboração, de fomento, de convênio e acordo de cooperação.

Para quem: Financeiro (cadastra), Diretoria e Leitura (consultam), coordenações (veem os termos
dos seus serviços).

## Usuários e permissões

| Perfil | Pode | Permissões |
| --- | --- | --- |
| Diretoria | Ver tudo | `parcerias.acessar`, `parcerias.termos.ver` |
| Financeiro | Ver e cadastrar termos, fontes, aportes, equipe e metas | `parcerias.acessar`, `parcerias.termos.ver`, `parcerias.termos.editar` |
| Coordenação de área | Ver os termos que atendem os serviços do seu escopo | `parcerias.acessar`, `parcerias.termos.ver` (escopo) |
| Leitura | Ver os termos | `parcerias.acessar`, `parcerias.termos.ver` |

Os valores dos termos não são dados pessoais. O número de atendidos por serviço é uma **contagem**
(sem nomes), lida do cadastro de pessoas do Núcleo; ninguém vê pessoa por este app. A equipe do
termo é por **função**, sem nome de pessoa.

## Entidades (planilha `parcerias`, sem dados pessoais)

| Aba | O que guarda |
| --- | --- |
| `Termos` | Parceiro, número, objeto, **tipo de instrumento** (**termo de colaboração, termo de fomento, termo de convênio, acordo de cooperação, outro**; com descrição quando "outro"), vigência (início e fim), situação (**em vigor, encerrado**), **unidade da meta** (ex.: usuários, alunos, pessoas, procedimentos), **recursos próprios previstos do termo** (opcional), **limite de ocupação** do alerta (padrão 85%), `ativo` |
| `TermoServicos` | Termo × Serviço (do Núcleo) atendido, com vigência, **vagas oferecidas** e **vagas custeadas pelo termo** (na unidade da meta) |
| `TermoFontes` | Fonte dentro do termo: termo, nome (ex.: Fundo Municipal), **forma do valor** (`global` ou `per_capita`), **valor inicial global** (forma global) **ou per capita** com **periodicidade** `mensal` ou `anual` (forma per capita), **modo do cronograma** (`iguais` ou `digitado`), **recursos próprios previstos da fonte** (opcional), **permite remanejar entre categorias** (sim/não), `ativo` |
| `TermoFonteParcelas` | Cronograma de desembolso: fonte do termo × mês (ano e mês) × valor da parcela, `ativo`. No modo `iguais` o Elo gera as linhas; no modo `digitado` a pessoa informa cada uma |
| `TermoFonteCategorias` | **Plano de aplicação**: fonte do termo × categoria de despesa (texto livre, com sugestões: pessoal, administrativas, utilidades públicas, material de consumo, serviços de terceiros) × valor previsto |
| `Aportes` | Termo, fonte do termo, tipo (**aditivo, emenda parlamentar, suplementação, outro**), data do registro, **vigência própria** (início e fim), valor (pode ser negativo para redução), **modo do cronograma** (`iguais` ou `digitado`), categoria de destino (opcional), descrição, `ativo` |
| `AporteParcelas` | Cronograma do aporte: aporte × mês × valor, `ativo` (mesmo funcionamento de `TermoFonteParcelas`) |
| `TermoEquipe` | Equipe prevista no plano: termo, **função** (sem nome de pessoa), número de pessoas, **horas semanais dedicadas ao termo** por pessoa (admite parcial, ex.: 10 h de administrativo) |
| `Metas` | Termo, serviço (opcional), descrição (ex.: modalidade), unidade, quantidade prevista (texto e número; só registro nesta fase) |

`TermoFonteMeses` (revisão 1) é substituída por `TermoFonteParcelas`: a escolha de meses vira o
modo "partes iguais" do cronograma.

A **conta vinculada** de cada fonte **não fica aqui**: a conta é da Tesouraria (Orçamento) e os
módulos não se conhecem. A ligação fonte do termo → conta é feita no Orçamento (Entrega R3, "Fontes
dos termos"; ADR-020, revisão de 11/11/2026).

## Regras de negócio (com teste)

1. Número do termo único por parceiro (sem diferença de acento ou maiúscula).
2. A vigência termina depois de começar; um termo atende ao menos um serviço; o tipo de
   instrumento é obrigatório (se "outro", a descrição também).
3. Todo termo tem ao menos uma fonte; nome de fonte único dentro do termo.
4. **Valor da fonte** = valor inicial + soma dos aportes ativos da fonte. **Valor global do termo**
   = soma dos valores das fontes. É sempre calculado pelo Elo, nunca digitado. O **valor inicial**
   depende da forma escolhida em cada fonte (regra 10).
5. Aporte tem **vigência própria** (início e fim) dentro da vigência do termo (ou da prorrogação,
   se o fim foi estendido antes), e a data do registro não pode ser futura. O aporte nunca deixa o
   valor da fonte negativo.
6. Nada é apagado: termo e fonte são encerrados (`ativo = FALSE`), aporte lançado errado é
   cancelado e relançado. Toda alteração é auditada com as colunas alteradas.
7. Só `parcerias.termos.editar` altera; coordenação vê apenas termos com serviço do seu escopo.
8. **Leitura para o Orçamento** (`termosParaOrcamento`): lista termos em vigor com tipo, serviços,
   fontes, valores atuais, **cronograma de desembolso por mês**, **plano de aplicação** (categorias
   e remanejamento), **recursos próprios previstos**, **equipe com horas** e meta; sem permissão
   própria, sem dados pessoais (ADR-013, exceção da ADR-020).
9. Parcerias não sabe onde o Orçamento usa cada fonte (módulos não se conhecem). Por isso a fonte
   encerrada deixa de aparecer para novos rateios, e os rateios já feitos continuam valendo.
10. **Duas formas de cadastrar o valor da fonte** (escolhida em cada fonte):
    - **Global:** a pessoa digita o valor inicial.
    - **Per capita:** a pessoa digita o per capita e diz se é **mensal** ou **anual**. O valor
      inicial = per capita × **quantidade custeada** × **fator de cobertura**, sendo:
      - quantidade custeada = soma das **vagas custeadas** dos serviços do termo (na unidade da meta);
      - meses de cobertura = meses da **vigência** do termo (ou da prorrogação);
      - per capita **mensal**: fator = meses de cobertura; per capita **anual**: fator = meses de
        cobertura ÷ 12 (vigência de 12 meses: per capita × quantidade).
    Aporte soma ao valor nas duas formas. Mudou vaga custeada ou vigência, o valor muda sozinho.
    Exemplo: per capita anual de R$ 1.000,00 × 100 alunos, vigência de 12 meses = R$ 100.000,00,
    pago em 4 parcelas ou em 12 (nunca R$ 33.333,33).
11. **Cobertura × recebimento:** a **cobertura** é a vigência (os meses que o valor cobre); o
    **recebimento** são as parcelas do cronograma (os meses em que o dinheiro entra). A fonte tem ao
    menos uma parcela, dentro da vigência do termo (ou da prorrogação). O número de parcelas
    **nunca entra no cálculo do valor** da fonte.
12. **Cronograma de desembolso** (fonte e aporte), em dois modos:
    - **Partes iguais:** a pessoa escolhe os meses (repasse trimestral, parcelas fora do calendário);
      o Elo divide o valor em partes iguais e põe os **centavos que sobrarem na última parcela**.
    - **Digitado mês a mês**, como no documento (parcelas diferentes, primeira maior por ser
      retroativa, última com ajuste).
    O **valor previsto a receber por mês** = parcelas da fonte + parcelas dos aportes ativos. O
    aporte tem cronograma próprio dentro da sua vigência (ex.: julho a dezembro, 6 parcelas, a
    primeira maior).
13. **Conferência da soma** (aviso, não bloqueia o salvamento): o cronograma da fonte deve somar o
    valor inicial da fonte, e o do aporte deve somar o valor do aporte. Se não somar, a ficha mostra,
    em texto e em destaque: "O cronograma soma R$ X; o valor da fonte é R$ Y (diferença R$ Z)", e a
    diferença entra nos **pontos de atenção** do termo. No modo partes iguais a soma é sempre exata.
    Também avisa: soma do plano de aplicação diferente do valor da fonte (regra 17), vigência de
    aporte fora da do termo e vagas custeadas acima das oferecidas. O aviso existe porque documentos
    reais trazem divergências (cabeçalho com valor diferente do cronograma).
14. **Recursos próprios previstos (contrapartida):** valor opcional por fonte e/ou por termo, como o
    plano declara. Não entra no valor do termo nem nas parcelas; é só o valor prometido, para o
    Orçamento comparar com o recurso próprio que ele ratear (Orçamento, R4).
15. **Meta e unidades:** o termo tem uma **unidade da meta**. Per capita, ocupação e alerta usam
    essa unidade. As `Metas` podem listar outras unidades e modalidades (ex.: procedimentos por
    modalidade na Saúde), só como registro. **Vagas oferecidas × vagas custeadas:** podem ser
    diferentes (a Educação oferece mais vagas do que o termo custeia). O valor do termo, o per
    capita e a ocupação usam as **custeadas**; as oferecidas aparecem ao lado, só como informação.
16. **Per capita por serviço, duas visões lado a lado** (mês a mês e no acumulado da vigência):
    - **contra a meta custeada:** valor previsto ÷ vagas custeadas do serviço;
    - **contra os atendidos reais:** valor previsto ÷ atendidos do serviço no mês.
    O valor do termo é atribuído ao serviço na proporção das vagas custeadas do serviço no termo.
17. **Plano de aplicação simples:** por fonte, categorias de despesa com valor previsto. A soma das
    categorias deve ser igual ao valor da fonte (aviso, regra 13). **Remanejar entre categorias** é
    uma escolha da fonte: permitido ou não. O aporte pode indicar a categoria a que se destina; sem
    categoria, entra só no valor total da fonte. Parcerias só guarda e mostra o plano; quem **avisa**
    quando uma despesa sai dele é o Orçamento (R3), que lê o plano pelo catálogo (regra 8).
18. **Atendidos reais** = pessoas com vínculo ativo no serviço no mês, contadas pelo cadastro de
    pessoas do Núcleo (sem digitação). Mês corrente conta até o dia da consulta. Como o Núcleo conta
    **pessoas**, só termos cuja unidade da meta é pessoa, usuário ou aluno têm atendidos reais; para
    **procedimentos** (ou outra unidade que não seja pessoa) aparece "sem contagem automática" e
    vale só o per capita contra a meta. Serviço sem vagas custeadas não tem ocupação nem per capita
    contra vagas ("sem vagas informadas").
19. **Ocupação** = atendidos reais ÷ vagas custeadas, por serviço e por mês.
20. **Alerta de vagas ociosas:** ocupação abaixo do **limite do termo** (padrão 85%, ajustável por
    quem edita) por 2 meses seguidos indica recurso "sobrando", com risco de devolução ou
    questionamento na prestação de contas. Mostra vagas ociosas e o valor mensal equivalente (vagas
    ociosas × per capita mensal). Só informa; não bloqueia nada.
21. **Equipe do termo:** função, número de pessoas e horas semanais por pessoa, **sem nomes**. Serve
    de referência para o rateio por horas no Orçamento (R4) e aparece na ficha do termo; a função
    pode ter horas parciais (ex.: administrativo 10 h).

## Telas

1. **Termos:** lista (parceiro, número, tipo de instrumento, vigência, valor global, serviços) com
   filtro por situação e por tipo.
2. **Ficha do termo:** dados, serviços atendidos (vagas oferecidas e custeadas), fontes (forma do
   valor, valor inicial, **cronograma** em tabela de mês e valor, **plano de aplicação**, recursos
   próprios previstos), aportes (com vigência e cronograma) e valor atual, equipe, metas, o quadro
   **Per capita e ocupação** por serviço e o quadro **Pontos de atenção** (soma que não bate, aporte
   fora da vigência, vagas custeadas acima das oferecidas). Botões: **Adicionar fonte**, **Registrar
   aporte**, **Encerrar termo**.
3. **Novo termo:** formulário em passos (dados e tipo → serviços e vagas → fontes: forma do valor,
   cronograma e plano de aplicação → equipe e metas). Na forma per capita, mostra na hora a conta
   ("R$ 1.000,00 por ano × 100 alunos × 12 ÷ 12 meses = R$ 100.000,00"). No cronograma, mostra a
   soma digitada e a diferença para o valor da fonte enquanto a pessoa digita; **Dividir em partes
   iguais** preenche as parcelas dos meses marcados.
4. Aviso na lista dos termos que terminam em até 90 dias.
5. **Quadro "Per capita e ocupação"** (ficha do termo, por serviço, mês a mês): vagas custeadas e
   oferecidas, atendidos reais, ocupação, per capita contra a meta e contra atendidos lado a lado,
   com "Ver os números". **Alerta de vagas ociosas** em destaque (texto, não só cor) e na lista.

**Melhoria de uso sugerida (não entra agora):** "Renovar termo", copiando o termo do ano anterior,
porque os planos de 2026 e 2027 são iguais; a vigência e os valores seriam só conferidos. Vai para
o roadmap.

## Fica de fora

- Prestação de contas por termo e conferência com a Tesouraria (roadmap), incluindo prazos de
  prestação parcial (antes de cada parcela), anual e final; regras do financiador que suspendem o
  pagamento (ex.: aluno sem frequência acima de 30 dias); gestores e fiscais da parceria.
- Receita do termo no Orçamento ligada à fonte do termo (roadmap).
- Anexos (arquivo do termo).
- Renovar termo copiando o anterior.
- Equipe por pessoa (nome) no termo: as horas por pessoa ficam na lotação da folha, no Orçamento.

## Frentes

`telas`, `regras e dados`, `infraestrutura` (planilha `parcerias` em `PLANILHAS`, perfis,
manifesto e `catalogos.ts`).

**Fora do módulo (precisa de aprovação):** Parcerias lê do Núcleo a **contagem** de vínculos ativos
por serviço e mês (`src/nucleo/pessoas`, função nova só de contagem, sem nomes). Parcerias não
importa outro módulo; o Núcleo é a base compartilhada.

## Critérios de pronto

- [ ] Regras 1 a 21 com testes, incluindo quem vê e quem altera
- [ ] Testes de cálculo: per capita mensal e anual (inclui anual pago em 4 parcelas, que dá o mesmo
      valor que em 12), partes iguais com centavos na última parcela, primeira parcela maior,
      conferência da soma (aviso), aporte com vigência de julho a dezembro, ocupação e alerta (inclui
      mês sem vagas, sem atendidos, unidade que não é pessoa e fonte com aporte)
- [ ] Os termos atuais da Diretoria, em versão fictícia com os mesmos formatos (termo com 3 fontes,
      termo federal com 2 fontes, aporte de 6 parcelas), cabem no cadastro sem adaptação
- [ ] Teste do catálogo `termosParaOrcamento` sem permissão e sem dados pessoais
- [ ] "Preparar estrutura" cria as abas e liga as permissões, dentro do limite de 10 segundos
- [ ] `npm run verificar` e `npm run build` verdes
- [ ] Diretoria confere na prévia, com termos fictícios
