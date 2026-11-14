# Agenda única e busca única · especificação

Issue #117 (onda 3 de 3 das ligações entre apps) · 14/11/2026 · ADR-023

Decisões da Diretoria (13/11/2026): a agenda **complementa** o calendário da Comunicação, que não muda;
a busca encontra **atendidos só para quem já os vê no Cadastro Único**, com auditoria; a primeira entrega
usa **o que existe hoje** (o bloco "Ligado a isto" e os feriados ficam para a segunda, depois das ondas 1 e 2).

## Objetivo e para quem

Ver numa tela só tudo o que vence e chegar a qualquer registro com uma busca, sem saber em que app ele está.
Para todas as pessoas que usam o Elo (Diretoria, coordenações, Financeiro, Comunicação, equipe).
Nada aparece que o perfil da pessoa não possa ver no app de origem.

## Usuários e permissões

- Não há permissão nova: **cada app decide** o que entra, com as regras que já tem (ADR-023). A agenda e a
  busca são abertas a qualquer pessoa que entrou; o resultado pode ser vazio.
- Quem não tem acesso a um app não vê itens dele nem o filtro dele.
- O filtro "serviço" só lista serviços que aparecem para a pessoa.
- Auditoria: ver regra 12. Agenda e busca não alteram nada.

## O que entra na agenda (só dados que existem hoje)

| App | Itens | Data | Quem vê (regra do app) | Leva a |
| --- | --- | --- | --- | --- |
| Parcerias | Fim da vigência do termo (em vigor) | `fim` | quem vê o termo | `/parcerias/[id]` |
| Parcerias | Parcela da fonte do termo (só "Parcela de <fonte>", sem valor) | mês (`TermoFonteParcelas.mes`) | quem vê o termo | `/parcerias/[id]` |
| Projetos | Início previsto e fim previsto | `inicio_previsto`, `fim_previsto` | quem vê o projeto (`podeVerProjeto`) | `/projetos/[id]` |
| Comunicação | Tema do calendário (período) | `inicio` a `fim` | quem vê o calendário | `/comunicacao/calendario` |
| Comunicação | Publicação agendada (número e título, sem solicitante) | `agendado_para` | quem vê o pedido | `/comunicacao/[id]` |
| Avaliação | Reavaliação anual a vencer (iniciais e serviço) | `reavaliacao.vence` | quem avalia naquele serviço | `/avaliacao/[id]` |
| Requisições | Prazo de aprovação ou de atendimento de requisição aberta | prazo do tipo, pelo expediente e feriados já cadastrados | quem vê a requisição | `/requisicoes/[id]` |

**Fora desta entrega:** Orçamento (hoje não tem prazo ou data de entrega; só `aprovado_em`, que já passou),
prazos de prestação de contas e gestores de parcerias (ainda não existem; estão no roadmap), feriados (#67),
portas de decisão de Projetos (não têm data; continuam nas pendências da tela inicial), avisos por e-mail (#63).

## Regras de negócio (com teste)

1. Cada módulo ativo exporta `itensDaAgenda(p, quem, periodo)` e `buscar(p, quem, termo)` no `index.ts`,
   no formato comum do Núcleo (ADR-023). Módulo não importa outro; `npm run fronteiras` confere.
2. A agenda só mostra o que o app de origem mostraria à mesma pessoa. Teste por app: perfil que vê, perfil
   que não vê, e escopo (coordenação só do seu serviço).
3. Registro encerrado (`ativo = FALSE`), cancelado, publicado, concluído ou termo encerrado não entra.
4. Item com data no passado e ainda em aberto é **vencido** e aparece na faixa "Vencidos", em qualquer mês.
   Item concluído nunca é vencido.
5. Item com só o mês (parcela) aparece na lista do mês, na faixa "Neste mês", e não numa célula de dia.
   Item com período (tema) aparece em cada dia do período no mês, e uma vez só na lista.
6. Ordem na lista: vencidos, depois por data, depois por app (ordem do menu); itens do mesmo app e dia
   por título.
7. Filtros combinam: app e serviço. Item sem serviço (tema, requisição) só aparece com "Todos os serviços".
   O filtro vale para o mês, a lista e a faixa de vencidos.
8. Falha de leitura de um app: a agenda e a busca mostram os demais e o `Aviso` "Não foi possível ler: <app>".
9. A busca ignora maiúsculas e acentos, exige **2 ou mais letras** e procura trechos do texto. Cada app devolve
   no máximo 20 resultados; a tela mostra 5 por app e "Mostrar todos os N" abre a lista do app na própria busca.
10. O que cada app busca: Projetos (código, título); Parcerias (número do termo, parceiro, objeto);
    Requisições (número, nome do tipo); Comunicação (número, título do pedido, tema do calendário);
    Pessoas (nome e nome social). Nada de `sigilo: sensivel` (Avaliação, anexos e detalhes de requisição
    não são buscados). Nome de solicitante não é buscado.
11. **Pessoas atendidas:** só aparecem as que `Autorizador.podeVerPessoa` permite. Quem não tem
    `core.pessoas.ver` em nenhum escopo não recebe o grupo "Pessoas", nem aviso de que ele existe.
12. **Auditoria:** busca que devolve ao menos uma pessoa grava `acao: 'leitura'`, `entidade: 'pessoas'`,
    `detalhes: { origem: 'busca', quantidade, pessoas: [ids] }`. **Nunca** o termo buscado (pode ser um nome).
    Agenda e busca nos outros apps não gravam auditoria (listas, como já são nos apps).
13. O termo da busca vai no endereço (`/busca?q=`); por isso nunca é registrado em log, auditoria nem na
    memória do navegador além do endereço da própria aba.
14. Datas valem no horário de Brasília (como no resto do Elo); o "hoje" vem de um relógio injetável nos testes.

## Telas

### Agenda (`/agenda`, item "Agenda" no menu, abaixo de "Início")

1. **Quem usa e o que quer:** qualquer pessoa, saber o que vence. Caminho mais curto: abrir "Agenda" (1 clique)
   e ver a faixa "Vencidos" e "Esta semana"; abrir o registro é 1 clique no item.
2. **Primeira dobra:** `CabecalhoPagina` "Agenda da instituição"; faixa **Vencidos** (só se houver, com `Aviso`
   e `Etiqueta` "Vencido"); controles: mês anterior/próximo e "Hoje", controle segmentado **Mês | Lista**, filtros
   em pílulas de app e seletor de serviço. Ação principal: abrir o item (cada item é um link; não há botão
   que grava). O padrão é **Lista** (cabe no celular); "Mês" fica a um clique.
3. **Componentes de `src/ui/`:** `CabecalhoPagina`, `Secao`, `Aviso`, `Etiqueta`, `EstadoVazio`, pílulas de
   filtro e controle segmentado como em `SeletorAno`. **Peças novas (mudança no Núcleo, a aprovar):**
   `GradeDoMes` (calendário em grade, em `src/ui/`; o calendário da Comunicação tem a sua e não muda),
   `IconeAgenda` e `IconeBusca` em `icones.tsx`. Item da agenda: cor do app (`data-app`) **sempre** com o
   ícone e o nome do app.
4. **Estados:** sem itens no mês ("Nada vence em novembro" + "Ver o mês seguinte"); sem itens com o filtro
   ("Nada com este filtro" + "Limpar filtros"); app que falhou (`Aviso`); sem permissão em nenhum app
   ("Você ainda não tem acesso a nenhum app" + quem procurar). Não há gravação, então nada de "gravou".
5. **Formulário:** só filtros, aplicados na hora pelo endereço (`?visao=&mes=AAAA-MM&app=&servico=`), para
   poder guardar ou compartilhar o link. Filtro inválido volta ao padrão sem erro.
6. **Ação sem volta:** nenhuma.
7. **Celular e teclado:** em largura de celular a grade vira lista por dia (a visão Mês some, o controle fica
   só com Lista). Ordem de tabulação: controles, faixa Vencidos, itens. Na grade, as setas movem entre os
   dias e Enter abre os itens do dia; o dia aberto é `?dia=AAAA-MM-DD`, com a lista do dia abaixo da grade.
   Dia com mais de 3 itens mostra "+N" na célula, que abre o dia.
8. **Gráficos:** nenhum. Números de destaque: só a contagem "N vencidos", com `NumeroQueConta` e a frase
   "vencidos esperando você", no cabeçalho da faixa.
9. **Sugestões de melhoria (não incluídas):** assinar a agenda no Google Agenda (arquivo iCal) e avisos por
   e-mail, ambos dependem do #63; contagem de vencidos no menu ao lado de "Agenda", como já tem o menu dos apps.

Textos: título do item sem rótulo técnico ("Fim do termo 12/2026", "Parcela de <fonte>", "Reavaliação de <iniciais>",
"Prazo de aprovação da REQ-2026-0001", "Publicação agendada: <título>", "Tema: <tema>", "Início previsto: <projeto>").

### Busca (campo na barra do topo e `/busca?q=`)

1. **Quem usa e o que quer:** achar um registro sem saber o app. Caminho: digitar na barra do topo e dar
   Enter (2 passos) e clicar no resultado; um resultado só no total **não** pula direto (a pessoa confere).
2. **Primeira dobra:** campo de busca (o mesmo da barra, já preenchido), resumo "N resultados para “termo”",
   grupos por app, cada um com ícone, nome do app e até 5 resultados. Cada resultado: título, linha de apoio
   (situação, serviço ou código) e leva ao registro. Ação principal: abrir o resultado.
3. **Componentes:** `Secao`, `Etiqueta`, `EstadoVazio`, `Aviso`, `Campo`. **Peça nova (Núcleo, a aprovar):**
   campo de busca na `Casca` (`src/ui/casca.tsx`), formulário de método GET para `/busca`, com rótulo
   acessível "Buscar no Elo" e dica "Projeto, termo, requisição, pedido ou pessoa". No celular, a busca fica
   num ícone da barra que abre o campo.
4. **Estados:** vazio, termo curto ("Digite ao menos 2 letras" no lugar do resultado, sem erro vermelho);
   sem resultado ("Nada encontrado para “termo”" + dicas: tente menos letras ou outra grafia; não diz se
   existem registros que a pessoa não pode ver); app que falhou (`Aviso`).
5. **Formulário:** um campo; o termo digitado volta preenchido sempre, também em erro.
6. **Ação sem volta:** nenhuma.
7. **Celular e teclado:** campo com área de 44 px; resultados são links em lista; "/" move o foco para a
   busca quando a pessoa não está digitando em outro campo (atalho anunciado na dica).
8. **Gráficos:** nenhum.
9. **Sugestões:** sugestões ao digitar e buscas recentes (descartadas por ora: o termo pode ser um nome de
   pessoa e não deve ficar guardado); filtro por app nos resultados.

Pessoa encontrada leva a `/nucleo/pessoas?busca=<termo>`, a tela que o Cadastro Único já tem.

## Entidades

Nenhuma aba nova nem coluna nova. Tudo é leitura das abas que já existem. A única gravação é a auditoria de
leitura de pessoas (aba `auditoria` do Núcleo, já existente).

## Fica de fora (vai para o `docs/roadmap.md`)

- **Segunda entrega (depende das ondas 1 e 2, #115 e #116):** bloco "Ligado a isto" em projeto, termo e
  serviço; serviços como resultado da busca (precisam da Ficha do serviço); feriados na agenda (#67);
  novas datas que as ondas 1 e 2 criarem.
- Datas do Orçamento, prazos de prestação de contas (Parcerias) e portas com prazo, quando existirem.
- Avisos por e-mail (#63) e assinatura da agenda no Google Agenda.
- Busca em Avaliação (dado sensível, sem pedido da Diretoria).

## Frentes

- **Regras e dados:** formato comum no Núcleo (`src/nucleo/modulos/agenda-busca.ts`), funções dos módulos,
  composição em `src/plataforma/agenda.ts` e `busca.ts`, busca de pessoas em `src/nucleo/pessoas/`, auditoria
  e testes (habilidade `regras-e-dados`).
- **Telas:** `/agenda`, `/busca`, campo na barra do topo, item no menu (habilidade `telas`).
- **Infraestrutura:** nenhuma (sem chave nova, sem planilha nova).
- **Mudanças fora de módulo (exigem aprovação deste PR):** Núcleo (tipos comuns, busca de pessoas), `src/ui/`
  (`GradeDoMes`, ícones, campo na `Casca`), `src/plataforma/` e o `index.ts` dos 5 apps que entram
  (Parcerias, Projetos, Comunicação, Avaliação, Requisições). O Orçamento não muda.

## Entregas

| # | Entrega | O que a Diretoria confere na prévia |
| --- | --- | --- |
| H1 | **Agenda** (formato comum, funções dos 5 apps, `/agenda` em lista e mês, filtros, vencidos) | Itens dos 5 apps com cor e ícone; perfil limitado vê menos |
| I1 | **Busca** (campo na barra, `/busca`, 5 apps e pessoas, auditoria) | Achar um projeto, um termo, um pedido e uma pessoa; perfil sem acesso não vê o grupo |
| H2/I2 | Segunda entrega (depois de #115 e #116) | "Ligado a isto", serviços na busca e feriados |

Sugestão: uma issue para H1 e outra para I1 (a I1 reaproveita o formato comum da H1).

## Decisões tomadas sozinho (com o custo se estiverem erradas)

1. **Orçamento fora da agenda** (não há data de entrega nele hoje). Custo: se a Diretoria esperava datas dele,
   entram quando houver o que datar; o formato comum já comporta.
2. **Parcelas de Parcerias entram só com o mês e sem valor.** Custo: se quiserem o valor, é uma linha por
   item, mas expõe dinheiro numa tela aberta a mais gente.
3. **Projetos entram por início e fim previstos** (portas não têm prazo). Custo: baixo; prazos de portas
   exigem regra nova em Projetos.
4. **Serviços ficam fora da busca nesta entrega** (sem Ficha do serviço, não haveria para onde levar).
   Custo: o pedido original pede serviços; entram na segunda entrega.
5. **Avaliação não é buscada, mas a reavaliação aparece na agenda** (já visível a quem avalia no serviço).
   Custo: se a Diretoria quiser buscar avaliações, é risco de dado sensível e vira nova decisão.
6. **O termo buscado não é gravado na auditoria** (só quem leu e quantas/quais pessoas). Custo: a auditoria
   não diz o que foi procurado; é o preço de não guardar nomes.
7. **Lista é a visão padrão da agenda** e a grade do mês some no celular. Custo: trocar o padrão é uma linha.
8. **Limite de 20 resultados por app, 5 mostrados.** Custo: busca ampla corta resultados; "Mostrar todos"
   cobre até 20 e a pessoa refina o termo.
9. **Busca percorre as abas na hora** (sem índice). Custo: pode ficar lenta com planilhas grandes; a entrega mede.

## Critérios de pronto (na prévia, com dados fictícios)

- [ ] Menu "Agenda": lista com itens dos 5 apps, cada um com ícone, nome e cor do app, e levando ao registro certo.
- [ ] Faixa "Vencidos" aparece com requisição atrasada e reavaliação atrasada fictícias, e some quando não há.
- [ ] Trocar para "Mês", navegar entre meses, abrir um dia; filtrar por app e por serviço; voltar com "Hoje".
- [ ] Entrar como coordenação de um serviço: não vê itens de outro serviço. Entrar como perfil sem acesso a
      Projetos: nenhum item nem filtro de Projetos.
- [ ] Barra do topo: buscar parte de um título de projeto, um número de termo, um número de requisição, um
      título de pedido e o nome de uma pessoa fictícia; cada um leva ao registro.
- [ ] Perfil sem permissão de pessoas busca um nome: não aparece grupo "Pessoas". Termo de 1 letra: pede 2 letras.
- [ ] Busca de pessoa grava uma leitura na auditoria, sem o termo.
- [ ] Tema claro e escuro, celular, teclado e "menos movimento" conferidos.
