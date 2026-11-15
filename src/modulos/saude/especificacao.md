# Especificação — Módulo Saúde (avaliação de evolução no CER)

- Situação: rascunho, aguardando aprovação da Diretoria (issue #68)
- Dono do produto: Diretoria
- Arquitetura: ADR-030 (usa o motor da ADR-026 e as regras das ADR-006 e ADR-007)
- Depende de: entrega 1 do motor de avaliação (issue #62, `src/capacidades/motor-avaliacao/`)
- Mesmo desenho do app Educação (issue #163, ADR-029): instrumento como dado, módulo próprio, planilha própria.
  Onde esta especificação diz "igual à Educação", vale o texto da Educação; aqui ele está repetido só no que muda.

## Decisões da Diretoria (issue #68)

1. A issue ficou só com Saúde/CER; a Educação foi para a #163 e entra primeiro.
2. O motor de avaliação compartilhado (ADR-006, #62) é reaproveitado, sem regras próprias por eixo.
3. O instrumento do CER já existe e foi validado (documento comentado na issue). Pode ser especificado sem esperar a Educação.
4. Apuração e classificação são **iguais aos demais instrumentos**: máximo 30 pontos; 21–30, 11–20, 0–10.
5. Como na Educação, o Elo calcula e mostra os **subtotais** de Evolução, Adequação e Barreira ao lado do total, e a
   **principal barreira** (desenho validado: `Pts_Evolução`, `Pts_Adequação`, `Pts_Barreira`, `Total_Pts`, `Classificação`,
   `Principal_Barreira`). Isso vale para o CER pelo mesmo motivo: o instrumento é "igual aos demais".

## Objetivo e para quem

A equipe do CER avalia cada atendido por **período** com o instrumento do CER e compara os períodos para ver se a
reabilitação está evoluindo. A Diretoria e a coordenação acompanham o resultado por serviço, sem identificar ninguém.

## O instrumento

Um instrumento: **Centro Especializado em Reabilitação (CER) — Saúde**. **10 itens**, escala **0 a 3**, máximo **30 pontos**.
Estruturado integralmente a partir da CIF (componentes b/s, d, e), em consonância com os protocolos SUS/PRONAS-PCD.
Itens 1 a 4 = **Evolução** (0 a 12); itens 5 e 6 = **Adequação** (0 a 6); itens 7 a 10 = **Barreira** (0 a 12). A etiqueta
CIF é informativa, aparece ao lado do item e não entra na conta.

Faixas do total: **21 a 30** Evoluindo adequadamente · **11 a 20** Evolução parcial / sinais de estagnação · **0 a 10**
Não evoluindo / serviço potencialmente inadequado. Legenda de encaminhamento por faixa, na tela, como nos outros eixos.

Item 7 é objetivo: **0** = menos de 40% · **1** = 40 a 59% · **2** = 60 a 79% · **3** = 80% ou mais.

| #   | Item                                                                               | Dimensão  | CIF   |
| --- | ---------------------------------------------------------------------------------- | --------- | ----- |
| 1   | Evolução da funcionalidade motora                                                  | Evolução  | b7/s7 |
| 2   | Evolução em atividades e participação (tarefas cotidianas da reabilitação)         | Evolução  | d2    |
| 3   | Evolução em habilidades de comunicação/cognição                                    | Evolução  | d3/b1 |
| 4   | Adesão e resposta terapêutica às intervenções                                      | Evolução  | d2/b1 |
| 5   | Adequação do plano terapêutico ao quadro clínico atual                             | Adequação | e5    |
| 6   | Adequação do nível de complexidade do CER (média/alta) ao estágio atual            | Adequação | e5    |
| 7   | Frequência e assiduidade às sessões terapêuticas                                   | Barreira  | e5    |
| 8   | Estabilidade clínica geral (intercorrências, comorbidades, hospitalizações)        | Barreira  | b/s   |
| 9   | Suporte familiar para continuidade do tratamento fora do CER                       | Barreira  | e3    |
| 10  | Barreiras de transporte/acesso geográfico                                          | Barreira  | e1    |

Campos de identificação (mesmo padrão dos outros instrumentos): serviço, pessoa (Cadastro Único), data de ingresso,
período avaliado, profissional responsável, função/categoria profissional, assinatura do profissional e "ciente" da
coordenação técnica.

## Usuários e permissões

Sem perfil novo. Escopo pelo **serviço** da área Saúde (hoje, o CER; na demonstração, `cer_reabilitacao`).

| Perfil                             | Pode                                                                                 | Permissão                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Diretoria                          | Aplicar, fechar, corrigir, comparar e imprimir em todos os serviços; painel de todos | `saude.acessar`, `saude.avaliar`, `saude.painel` (global)      |
| Coordenação de serviço             | O mesmo nos serviços do escopo; dá o "ciente"                                        | as três, no escopo                                             |
| Técnico avaliador                  | Aplicar, fechar, corrigir, comparar e imprimir nos serviços do escopo                | as três, no escopo                                             |
| Leitura (Conselho)                 | Só o painel (números agregados) e "Sobre o instrumento"                              | `saude.acessar`, `saude.painel`                                |
| Administração, Financeiro e demais | Nada neste módulo                                                                    | —                                                              |

A pessoa só aparece na escolha se `podeVerPessoa` permitir e tiver vínculo ativo com um serviço da área Saúde no escopo.

## Entidades (planilha própria `avaliacao_saude`, dados sensíveis separados — ADR-011)

Declaradas com `definirTabela` e registradas em "Preparar estrutura". Mesmas três abas da Educação:

| Aba          | O que guarda                                                                                                                                                                                                                        | Sigilo                                        |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Instrumentos | O instrumento do CER (código, versão, referenciais, itens com texto, dimensão e CIF, faixas e legendas); `ativo`; se já foi usado                                                                                                    | nenhum (sem dado de pessoa)                   |
| Aplicacoes   | `pessoa_id`, instrumento e versão, serviço, período avaliado (início e fim), data de ingresso, situação (aberta/fechada), `corrige`, profissional, função, data da assinatura, "ciente" (quem e quando), justificativa do enquadramento | pessoal: `pessoa_id`; sensível: justificativa |
| Respostas    | `aplicacao_id`, número do item, valor (0 a 3)                                                                                                                                                                                       | sensível                                      |

Total, subtotais, faixa e principal barreira **não são guardados**: são calculados a cada leitura, pelo motor.

## Regras de negócio (com teste)

1. O instrumento do CER entra como **dado** (versão 1), com texto, dimensão e CIF de cada item exatamente como na tabela. Depois de usado, não muda: alterar cria nova versão (ADR-007).
2. Cada aplicação guarda a versão usada; o comparativo só soma períodos da mesma versão e avisa quando diferem.
3. Resposta: inteiro de 0 a 3. A aplicação só fecha com os 10 itens respondidos.
4. **Total** = soma dos 10 itens. **Subtotais**: Evolução = itens 1 a 4 (0 a 12), Adequação = 5 e 6 (0 a 6), Barreira = 7 a 10 (0 a 12). Total = soma dos três.
4a. **Principal barreira**: dimensão de menor pontuação, comparada pelo **percentual do máximo** de cada dimensão (12, 6 e 12); em empate, mostram-se todas as empatadas. Calculada na leitura.
5. **Faixa** pelo total: 21–30, 11–20, 0–10 (limites incluídos). Fechar exige a justificativa do enquadramento (não vazia).
6. Item 7: se a pessoa informa o percentual de 0 a 100, o Elo sugere a nota (<40 → 0, 40–59 → 1, 60–79 → 2, ≥80 → 3); a pessoa pode ajustar. O percentual **não é guardado**, só a nota.
7. Período: início ≤ fim, fim não futuro; data de ingresso não futura. Profissional e função obrigatórios para fechar.
8. Aplicação **fechada não se edita**; a correção cria nova aplicação (`corrige`) e a anterior fica no histórico.
9. Uma pessoa não tem duas aplicações abertas do mesmo instrumento ao mesmo tempo.
10. `pessoa_id` precisa existir, estar ativo e ser visível a quem avalia (`Autorizador`); o serviço precisa estar no escopo de quem avalia e ser da área Saúde.
11. **Ciente**: só coordenação ou Diretoria com `saude.avaliar` no serviço, só em aplicação fechada; não altera as respostas.
12. Reavaliação: vence 12 meses depois da última aplicação fechada da pessoa no instrumento; "vence em breve" 30 dias antes (decisão técnica, ver "Decisões").
13. **Comparativo**: aplicações fechadas da pessoa, da mais antiga à mais recente; total, três subtotais e faixa de cada uma e a diferença entre a primeira e a última (total maior = melhorou).
14. Gravação com a versão lida (conflito → aviso, nada é sobrescrito).
15. Nada é apagado: aplicação aberta desistida fica `ativo = FALSE` com motivo; fechada só é corrigida.
16. Auditoria: inclusão e alteração (colunas, nunca valores); `leitura` ao abrir uma aplicação e o comparativo; `exportacao` ao abrir a ficha; fechamento, ciente e correção.
17. **Painel**: só números agregados, por serviço e período, **com 5 pessoas ou mais** (`numeroAgregado`); nunca iniciais nem nome. Cada pessoa conta uma vez, pela aplicação fechada mais recente do período.

Testes de acesso: técnico do serviço A não vê pessoa do serviço B; coordenação vê os serviços do escopo; Conselho só o painel;
Financeiro e Administração nada; Diretoria tudo. Testes do cálculo: total e subtotais, limites das faixas (10/11, 20/21),
as quatro faixas de frequência e a principal barreira (inclusive empate).

## Telas

Componentes de `src/ui/` já existentes; nenhuma mudança no Núcleo para as telas. Mesmas sete telas da Educação, com as rotas
sob `/saude` e textos do ponto de vista de quem usa; sem nome próprio de instituição, unidade ou cidade.

1. **Avaliações de Saúde** (`/saude`): quer ver quem precisa ser reavaliado. Primeira dobra: "Reavaliações atrasadas" e "Vencendo em 30 dias", depois a lista (pessoa, serviço, período, total, faixa, situação, próxima avaliação) com filtros de serviço, faixa e situação. Ação principal: **"Nova avaliação"**; por linha: Abrir, Comparar, Reavaliar. Vazio: "Nenhuma avaliação ainda. Use “Nova avaliação” para começar."
2. **Nova avaliação** (`/saude/nova`): (a) pessoa (busca por nome, só as visíveis) e serviço; (b) período, data de ingresso, profissional e função (preenchidos pelo usuário logado, editáveis); (c) os 10 itens por dimensão, botões de 0 a 3, legenda do nível sempre visível, CIF ao lado do item; no item 7, campo opcional "Frequência no período (%)". **Totais ao vivo** (total e três subtotais) fixos no alto. Botões **"Salvar rascunho"** e **"Concluir e assinar"**. Erro mantém o digitado.
3. **Aplicação** (`/saude/<id>`): total, três subtotais, faixa com a legenda de encaminhamento, principal barreira, respostas por dimensão, justificativa. Ações: **"Dar o ciente"**, **"Corrigir"**, **"Imprimir ficha"**, **"Comparar"**. Ação sem volta: **"Concluir e assinar"**; a confirmação explica que depois só dá para corrigir criando nova aplicação.
4. **Comparativo da pessoa** (`/saude/<id>/comparativo`): título em forma de conclusão ("Total subiu 6 pontos entre os períodos"); **barras agrupadas** com os três subtotais por período (3 séries, `src/ui/graficos.tsx`); "Ver os números" abre a tabela item a item; aviso de versões diferentes. Com uma só aplicação: "Só há uma avaliação. A comparação aparece a partir da segunda."
5. **Ficha para imprimir** (`/saude/<id>/ficha`): A4 com identificação, respostas, total, subtotais, faixa, assinaturas do profissional e do "ciente" da coordenação técnica e aviso de sigilo.
6. **Painel** (`/saude/painel`): filtros de serviço e período; cartões (pessoas avaliadas, total médio, % em cada faixa); **barras empilhadas 100% das faixas por serviço** e **barras do subtotal médio das três dimensões em % do máximo**; título em forma de conclusão e leitura ao lado ("Barreira está mais baixa: veja frequência e transporte"). Menos de 5 pessoas: "Poucos casos para mostrar sem identificar ninguém."
7. **Sobre o instrumento** (`/saude/sobre`): referenciais (CIF, SUS/PRONAS-PCD), o que mede cada dimensão, faixas, legenda e como o Elo calcula os subtotais.

Estados: gravando ("Salvando…"), gravou ("Salvo"), erro (português, sem perder o digitado), sem permissão ("Você não avalia neste serviço."). Celular: uma coluna, botões de 0 a 3 grandes; teclado: Tab pelos itens, setas escolhem a nota.

Sugestões de experiência (a Diretoria decide): a) lembrete de quem está para reavaliar; b) copiar profissional e função da última aplicação; c) mostrar no item a nota do período anterior.

## Eventos

Nenhum nesta entrega.

## Indicadores

| Código               | Cálculo                                                                  |
| -------------------- | ------------------------------------------------------------------------ |
| saude_total_medio    | Média do total (0 a 30) na aplicação fechada mais recente de cada pessoa |
| saude_pct_evoluindo  | % de pessoas na faixa 21–30 na aplicação fechada mais recente            |

(Só números agregados, com mínimo de 5 pessoas.)

## Fica de fora

- Texto de cada nível de nota por item e "não se aplica" (a equipe não trouxe; entra como nova versão).
- Prontuário, evolução clínica, agendamento de sessões e qualquer dado de saúde além do instrumento.
- Cadastro de turmas/equipes e escopo por equipe (o escopo é o serviço).
- Ligação com Projetos e Parcerias como indicador do serviço (onda posterior das ligações entre apps).
- Editor de instrumentos pela tela; busca por avaliações (dado sensível).
- Nenhum dado real é carregado; só os dados fictícios.

## Entregas (ordem de construção)

Três entregas, pequenas o bastante para ficar nesta issue (sem sub-issues).

1. **Aplicar e fechar** (depende do motor, #62 entrega 1): módulo `saude`, planilha `avaliacao_saude`, o instrumento como dado, telas Avaliações, Nova avaliação, Aplicação, ciente e Sobre o instrumento. Total, subtotais e faixa na tela.
2. **Comparativo e ficha**: comparativo, reavaliação (atrasadas e vencendo) e ficha para imprimir.
3. **Painel** por serviço e período, com indicadores.

Se a Educação (#163) for construída antes, o desenvolvedor **copia o desenho** dela, sem importar o módulo Educação
(regra de fronteiras). O que se repetir muito vira, só com pedido da Diretoria, uma peça comum em capacidade.

## Frentes

`regras e dados` (instrumento, abas, casos de uso, cálculo, auditoria, testes) e `telas` (inclui os gráficos). Sem `infraestrutura`.

## Decisões tomadas sozinho (custo se estiverem erradas)

1. **Módulo próprio `saude`**, e não um serviço dentro de Educação ou Avaliação. _Custo:_ se a Diretoria preferir um só app de avaliação por eixo, a fusão é refatoração de rotas e permissões.
2. **Sentido da escala em Barreira: nota alta é melhor** (3 = barreira ausente ou mínima), como na Educação, porque a frequência (≥80% = 3) mostra isso. _Custo:_ se for o contrário, subtotal de Barreira e faixas ficam invertidos até corrigir o instrumento (nova versão). **Peço confirmação.**
3. **Subtotais e principal barreira também no CER**, porque o instrumento é "igual aos demais". _Custo:_ nenhum dado gravado muda; só a tela.
4. **Legenda geral dos níveis** (0 = nenhuma evolução/adequação, 3 = plena; em Barreira, 0 = barreira severa, 3 = ausente), pois o documento não traz o texto por item. _Custo:_ texto próprio entra como nova versão.
5. **Reavaliação a cada 12 meses**. _Custo:_ se o CER avalia por semestre ou por ciclo de tratamento, muda só a regra 12.
6. **Ciente gravado no sistema**, sem assinatura digital; a assinatura fica na ficha impressa.
7. **Percentual de frequência não é guardado**, só a nota.
8. **"Menor pontuação" da principal barreira em % do máximo** da dimensão. _Custo:_ se for em pontos brutos, muda só o cálculo e os textos.
9. **Uma pessoa pode ter avaliação no CER e em outro eixo**; cada uma é independente, ligadas só por `pessoa_id`. _Custo:_ nenhum.
10. **Rota `/saude`**, permissões `saude.*`, nome do app "Saúde". _Custo:_ renomear depois mexe em rotas e permissões.

## Critérios de pronto

- [ ] Regras de negócio com testes (cálculo, faixas, principal barreira, ciclos, ciente, mínimo de 5 no painel)
- [ ] Testes de acesso (técnico do serviço, coordenação, Conselho, Financeiro, Administração, Diretoria)
- [ ] `npm run verificar` e `npm run build` verdes
- [ ] Conferido pela Diretoria na prévia, com dados fictícios: aplicar o instrumento, ver total e subtotais mudarem ao vivo, concluir, dar o ciente, comparar dois períodos e corrigir criando nova aplicação
