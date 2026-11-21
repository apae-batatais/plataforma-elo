# Especificação — Módulo Educação (avaliação de evolução)

- Situação: aprovada; as 3 entregas construídas (aplicar e fechar, comparativo e ficha, painel) (issue #163)
- Dono do produto: Diretoria
- Arquitetura: ADR-029 (usa o motor da ADR-026 e as regras das ADR-006 e ADR-007)
- Depende de: entrega 1 do motor de avaliação (issue #62, `src/capacidades/motor-avaliacao/`)

## Decisões da Diretoria (issue #163)

1. A primeira entrega avalia os atendidos com um instrumento (escala), em ciclos, usando o motor compartilhado.
2. Educadores veem e registram só as suas turmas; a coordenação vê todas.
3. Os atendidos são os do Cadastro Único existente; o app só acrescenta dados de Educação.
4. O instrumento já existe e foi validado: são três formulários, um por serviço do eixo.
5. (15/11/2026) Além do total de 0 a 30, o Elo mostra **subtotais por dimensão** (Evolução, Adequação, Barreira).
   É cálculo do Elo: não muda o instrumento nem as faixas de corte.
6. (15/11/2026) Os subtotais já fazem parte do desenho validado do instrumento ("Base de Dados Consolidada": `Pts_Evolução`,
   `Pts_Adequação`, `Pts_Barreira`, `Total_Pts`, `Classificação` e `Principal_Barreira`). O Elo só calcula e mostra esses campos;
   não é funcionalidade nova.

## Objetivo e para quem

A equipe de Educação avalia cada atendido por **período** com o instrumento do serviço dele, e compara os períodos para ver se
há evolução. A Diretoria e as coordenações acompanham o resultado por serviço, sem identificar ninguém.

## Os três instrumentos

Um instrumento por serviço, todos com **10 itens** e escala **0 a 3**, máximo de **30 pontos**. Os itens 1 a 4 são a dimensão
**Evolução** (0 a 12), os itens 5 e 6 a **Adequação** (0 a 6) e os itens 7 a 10 a **Barreira** (0 a 12). Cada item tem uma
etiqueta de domínio **CIF** (só informativa, mostrada ao lado do item; não entra na conta).

Faixas do total (iguais nos três): **21 a 30** Evoluindo adequadamente · **11 a 20** Evolução parcial / sinais de estagnação ·
**0 a 10** Não evoluindo / serviço potencialmente inadequado. Legenda de encaminhamento por faixa, na tela, como no instrumento
já usado nos outros eixos.

Item 7 (frequência e assiduidade) é objetivo, igual nos três: **0** = menos de 40% · **1** = 40 a 59% · **2** = 60 a 79% ·
**3** = 80% ou mais.

### Educação Infantil

Referenciais: Guia Portage (Motor, Cognição, Linguagem, Autocuidados, Socialização) + BNCC/Currículo Paulista (Campos de
Experiência) + CIF.

| #   | Item                                                   | Dimensão  | CIF   |
| --- | ------------------------------------------------------ | --------- | ----- |
| 1   | Desenvolvimento motor                                  | Evolução  | d4/b7 |
| 2   | Desenvolvimento da linguagem e comunicação             | Evolução  | d3    |
| 3   | Desenvolvimento socioafetivo                           | Evolução  | d7    |
| 4   | Habilidades cognitivas básicas                         | Evolução  | d1    |
| 5   | Adequação do PEI ao perfil atual                       | Adequação | e5    |
| 6   | Adequação de turma, turno e recursos de acessibilidade | Adequação | e1/e5 |
| 7   | Frequência e assiduidade                               | Barreira  | e5    |
| 8   | Impacto de condições de saúde na participação          | Barreira  | b/s   |
| 9   | Engajamento da família                                 | Barreira  | e3    |
| 10  | Comportamentos que dificultam a permanência em sala    | Barreira  | b1    |

### Ensino Fundamental

Referenciais: CFN (Inventário Ecológico, ambientes naturais, generalização) + BNCC/Currículo Paulista (Linguagens, Matemática) + CIF.

| #   | Item                                                                       | Dimensão  | CIF   |
| --- | -------------------------------------------------------------------------- | --------- | ----- |
| 1   | Comunicação funcional em situações reais                                   | Evolução  | d3    |
| 2   | Independência em atividades de vida diária, em ambientes naturais          | Evolução  | d5    |
| 3   | Habilidades acadêmicas funcionais (leitura, escrita, matemática aplicadas) | Evolução  | d1    |
| 4   | Generalização das habilidades para ambientes naturais                      | Evolução  | d9    |
| 5   | Adequação do PEI construído a partir do Inventário Ecológico               | Adequação | e5    |
| 6   | Adequação dos ambientes de ensino e idade cronológica                      | Adequação | e1/e5 |
| 7   | Frequência e assiduidade                                                   | Barreira  | e5    |
| 8   | Impacto de condições de saúde                                              | Barreira  | b/s   |
| 9   | Engajamento da família na generalização das habilidades                    | Barreira  | e3    |
| 10  | Comportamentos que dificultam a participação nos ambientes naturais        | Barreira  | b1    |

### Educação para o Trabalho

Referenciais: CFN + itinerários formativos BNCC/Currículo Paulista + CIF.

| #   | Item                                                               | Dimensão  | CIF   |
| --- | ------------------------------------------------------------------ | --------- | ----- |
| 1   | Aquisição de habilidades técnicas/operacionais em ambientes reais  | Evolução  | d8    |
| 2   | Habilidades socioprofissionais (pontualidade, equipe, comunicação) | Evolução  | d7/d8 |
| 3   | Autonomia na execução de tarefas e rotinas laborais                | Evolução  | d2    |
| 4   | Avanço em direção a metas de inserção produtiva                    | Evolução  | d8    |
| 5   | Adequação do percurso formativo/itinerário ao perfil vocacional    | Adequação | e5    |
| 6   | Adequação do Plano Individual de Atendimento/Capacitação           | Adequação | e5    |
| 7   | Frequência e assiduidade                                           | Barreira  | e5    |
| 8   | Impacto de condições de saúde                                      | Barreira  | b/s   |
| 9   | Suporte familiar e barreiras de transporte/deslocamento            | Barreira  | e3/e1 |
| 10  | Comportamentos/aspectos socioemocionais que dificultam a inserção  | Barreira  | b1    |

Campos de identificação da aplicação (iguais nos três): serviço, pessoa (Cadastro Único), data de ingresso, período avaliado,
profissional responsável, função/categoria profissional, assinatura do profissional e "ciente" da coordenação técnica.

## Usuários e permissões

Sem perfil novo. Quem avalia é quem já tem os perfis existentes, no escopo do serviço.

| Perfil                             | Pode                                                                                 | Permissão                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Diretoria                          | Aplicar, fechar, corrigir, comparar e imprimir em todos os serviços; painel de todos | `educacao.acessar`, `educacao.avaliar`, `educacao.painel` (global) |
| Coordenação de serviço             | O mesmo nos serviços do escopo; dá o "ciente"                                        | as três, no escopo                                                 |
| Técnico avaliador (educador)       | Aplicar, fechar, corrigir, comparar e imprimir nos serviços do escopo                | as três, no escopo                                                 |
| Leitura (Conselho)                 | Só o painel (números agregados) e "Sobre o instrumento"                              | `educacao.acessar`, `educacao.painel`                              |
| Administração, Financeiro e demais | Nada neste módulo                                                                    | —                                                                  |

**"Turma" = serviço.** O Núcleo não tem turma como cadastro; o escopo mais fino que existe é o **serviço**. Hoje, "as suas
turmas" do educador vale como "os serviços em que ele tem perfil" (Educação Infantil, Ensino Fundamental, Educação para o
Trabalho). A pessoa só aparece na escolha se `podeVerPessoa` permitir e tiver vínculo ativo com um serviço do escopo.

## Entidades (planilha própria `avaliacao_educacao`, dados sensíveis separados — ADR-011)

Declaradas com `definirTabela` e registradas em "Preparar estrutura".

| Aba          | O que guarda                                                                                                                                                                                                                                                         | Sigilo                                        |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Instrumentos | Os três instrumentos (código, versão, serviço-modalidade, referenciais, itens com texto, dimensão e CIF, faixas e legendas); `ativo`; se já foi usado                                                                                                                | nenhum (sem dado de pessoa)                   |
| Aplicacoes   | `pessoa_id`, instrumento e versão, serviço, período avaliado (início e fim), data de ingresso, situação (aberta/fechada), `corrige` (id anterior), profissional, função, data da assinatura, "ciente" da coordenação (quem e quando), justificativa do enquadramento | pessoal: `pessoa_id`; sensível: justificativa |
| Respostas    | `aplicacao_id`, número do item, valor (0 a 3)                                                                                                                                                                                                                        | sensível                                      |

Total, subtotais e faixa **não são guardados**: a camada de aplicação calcula a cada leitura, com o motor. O **ciente** da
coordenação é gravado como coluna da aplicação (quem deu e quando).

## Regras de negócio (com teste)

1. Os três instrumentos entram como **dados** (versão 1) com o texto, a dimensão e a CIF de cada item exatamente como acima. Depois de usado, um instrumento não muda: alterar cria nova versão (ADR-007).
2. Cada aplicação guarda a versão usada. O comparativo só soma períodos da mesma versão e avisa quando diferem.
3. Resposta: inteiro de 0 a 3. A aplicação só fecha com os 10 itens respondidos (não há "não se aplica" nesta entrega).
4. **Total** = soma dos 10 itens (0 a 30). **Subtotais**: Evolução = itens 1 a 4 (0 a 12), Adequação = 5 e 6 (0 a 6), Barreira = 7 a 10 (0 a 12). Total = soma dos três subtotais.
4a. **Principal barreira** (campo `Principal_Barreira` do desenho validado): a dimensão de **menor pontuação**. Como as dimensões têm máximos diferentes (12, 6 e 12), a comparação é pelo **percentual do máximo** de cada uma; em empate, mostram-se todas as empatadas. É calculada na leitura, como o total, e aparece na aplicação, no comparativo e no painel (quantas pessoas têm cada dimensão como principal). Classificação e subtotais seguem as regras 4 e 5.
5. **Faixa** pelo total: 21–30, 11–20, 0–10 (limites incluídos). Fechar exige a justificativa do enquadramento (não vazia), como no motor.
6. Item 7 (frequência): se a pessoa informa o percentual de 0 a 100, o Elo sugere a nota pelas faixas (<40 → 0, 40–59 → 1, 60–79 → 2, ≥80 → 3); a pessoa pode ajustar. O percentual **não é guardado**, só a nota.
7. Período avaliado: início anterior ou igual ao fim, fim não futuro; data de ingresso não futura. Profissional e função são obrigatórios para fechar.
8. Aplicação **fechada não se edita**; a correção cria nova aplicação (`corrige`) e a anterior fica no histórico (ADR-007).
9. Uma pessoa não tem duas aplicações abertas do mesmo instrumento ao mesmo tempo.
10. `pessoa_id` precisa existir, estar ativo e ser visível a quem avalia (`Autorizador`); o serviço da aplicação precisa estar no escopo de quem avalia e ser um serviço da área Educação.
11. O instrumento é escolhido por quem aplica; a tela sugere o do serviço da pessoa, mas não impede outro dentro do escopo.
12. **Ciente**: só quem tem `educacao.avaliar` com perfil de coordenação ou Diretoria no serviço dá o ciente, e só em aplicação fechada. O ciente não altera as respostas.
13. Reavaliação: vence 12 meses depois da última aplicação fechada da pessoa naquele instrumento; "vence em breve" 30 dias antes (regra 9 do módulo Avaliação). Decisão técnica da instituição, ver "Decisões".
14. **Comparativo**: aplicações fechadas da pessoa no mesmo instrumento, da mais antiga para a mais recente; mostra total, os três subtotais e a faixa de cada uma e a diferença entre a primeira e a última (total maior = melhorou).
15. Gravação com a versão lida (outra pessoa alterou → aviso, nada é sobrescrito).
16. Nada é apagado: aplicação aberta desistida fica com `ativo = FALSE` e motivo; fechada só é corrigida (regra 8).
17. Auditoria: inclusão e alteração (colunas, nunca valores); `leitura` ao abrir uma aplicação e o comparativo; `exportacao` ao abrir a ficha para imprimir; fechamento, ciente e correção.
18. **Painel**: só números agregados, por serviço e período, **com 5 pessoas ou mais** (`numeroAgregado`); nunca iniciais nem nome. Cada pessoa conta uma vez, pela aplicação fechada mais recente do período.

Testes de acesso: educador do serviço A não vê pessoa do serviço B; coordenação vê todos os serviços da área; Conselho só vê o painel; Financeiro e Administração não veem nada; Diretoria vê tudo. Testes do cálculo: totais e subtotais de cada um dos três instrumentos, limites das faixas (10/11, 20/21) e as quatro faixas de frequência.

## Telas

Componentes de `src/ui/` já existentes; nenhuma mudança no Núcleo para as telas. Sem nomes próprios de instituição, unidade ou cidade nos textos.

1. **Avaliações de Educação** (`/educacao`) — educador/coordenação: quer ver quem precisa ser avaliado. Primeira dobra: cartões "Reavaliações atrasadas" e "Vencendo em 30 dias", depois a lista (pessoa, serviço, período, total, faixa, situação, próxima avaliação) com filtros de serviço, faixa e situação. Ação principal: **"Nova avaliação"**; por linha: Abrir, Comparar, Reavaliar. Vazio: "Nenhuma avaliação ainda. Use “Nova avaliação” para começar."
2. **Nova avaliação** (`/educacao/nova`): 3 passos curtos em uma tela. (a) escolher a pessoa (busca por nome; só as visíveis) e o serviço; o instrumento vem sugerido; (b) período, data de ingresso, profissional e função (profissional e função vêm preenchidos pelo usuário logado, editáveis); (c) os 10 itens, agrupados por dimensão, com os botões de 0 a 3 e a legenda do nível sempre visível; a etiqueta CIF ao lado do item; no item 7 um campo opcional "Frequência no período (%)" que sugere a nota. **Totais ao vivo** (total e três subtotais) no alto, fixos ao rolar. Botões: **"Salvar rascunho"** e **"Concluir e assinar"**. Erro mantém tudo o que foi digitado. Caminho mais curto: 3 cliques até começar os itens; rascunho pode sair sem perder nada.
3. **Aplicação** (`/educacao/<id>`): total, os três subtotais (cartões), a faixa com a legenda de encaminhamento, respostas por dimensão, justificativa. Ações: **"Dar o ciente"** (coordenação), **"Corrigir"** (cria nova aplicação), **"Imprimir ficha"**, **"Comparar"**. Ação sem volta: **"Concluir e assinar"**, cuja confirmação explica que depois só dá para corrigir criando nova aplicação.
4. **Comparativo da pessoa** (`/educacao/<id>/comparativo`): título em forma de conclusão ("Total subiu 6 pontos entre os períodos"); gráfico de **barras agrupadas** do total por período com os três subtotais como séries (no máximo 4 séries, componente de `src/ui/graficos.tsx`); "Ver os números" abre a tabela item a item; aviso de versões diferentes. Pergunta que responde: "qual dimensão está puxando o resultado?". Com uma só aplicação: "Só há uma avaliação. A comparação aparece a partir da segunda."
5. **Ficha para imprimir** (`/educacao/<id>/ficha`): folha A4 com identificação, respostas, total, subtotais, faixa, campo de assinatura do profissional e do "ciente" da coordenação técnica e aviso de sigilo.
6. **Painel** (`/educacao/painel`): filtros de serviço e período; cartões (pessoas avaliadas, total médio, % em cada faixa); **barras empilhadas 100% das faixas por serviço** e **barras do subtotal médio das três dimensões, em % do máximo** (para comparar 12, 6 e 12 na mesma régua). Título em forma de conclusão e leitura ao lado ("A dimensão Barreira está mais baixa: veja frequência e saúde"). Com menos de 5 pessoas: "Poucos casos para mostrar sem identificar ninguém." Período parcial é indicado no título.
7. **Sobre o instrumento** (`/educacao/sobre`): referenciais de cada serviço, o que mede cada dimensão, faixas, legenda de encaminhamento e como o Elo calcula os subtotais.

Estados em todas: gravando ("Salvando…"), gravou ("Salvo"), erro (texto em português, sem perder o digitado) e sem permissão ("Você não avalia neste serviço."). No celular: uma coluna, botões de 0 a 3 grandes; teclado: Tab pelos itens e setas escolhem a nota.

Sugestões de experiência (não pedidas, a Diretoria decide): a) lembrete na lista de quem está para reavaliar; b) copiar o profissional e a função da última aplicação; c) mostrar, no item, a nota do período anterior para a pessoa se situar.

## Eventos

Nenhum nesta entrega.

## Indicadores

| Código                 | Cálculo                                                                  | Referência |
| ---------------------- | ------------------------------------------------------------------------ | ---------- |
| educacao_total_medio   | Média do total (0 a 30) na aplicação fechada mais recente de cada pessoa | —          |
| educacao_pct_evoluindo | % de pessoas na faixa 21–30 na aplicação fechada mais recente            | —          |

(Só números agregados, com mínimo de 5 pessoas.)

## Fica de fora

- Cadastro de turmas e escopo por turma (ver decisão 1 abaixo).
- Os campos escritos de cada nível de nota por item (ver decisão 2) e "não se aplica".
- Revisão do instrumento (item 6 da Educação Infantil e uniformizar "progresso"/"avanço"): anotadas pela Diretoria, para quando a equipe revisar; mexer nelas cria nova versão.
- Ligação com Projetos e Parcerias como indicador de serviço (onda posterior das ligações entre apps).
- Editor de instrumentos pela tela; Saúde/CER; busca por avaliações (dado sensível).
- Converter respostas de outros eixos; nenhum dado real é carregado (só os dados fictícios).

## Entregas (ordem de construção)

Três entregas, pequenas o bastante para ficar nesta issue (sem sub-issues; a Diretoria pode pedir).

1. **Aplicar e fechar** (depende do motor, #62 entrega 1): módulo `educacao`, planilha `avaliacao_educacao`, os três instrumentos como dados, telas Avaliações, Nova avaliação, Aplicação, ciente e Sobre o instrumento. Total, subtotais e faixa já na tela.
2. **Comparativo e ficha**: comparativo da pessoa, reavaliação (atrasadas e vencendo) e ficha para imprimir.
3. **Painel** por serviço e período, com indicadores.

## Frentes

`regras e dados` (instrumentos, abas, casos de uso, cálculo, auditoria, testes), `telas` (inclui os gráficos). Sem `infraestrutura`.

## Decisões tomadas sozinho (custo se estiverem erradas)

1. **Turma = serviço.** _Custo:_ se a equipe tem várias turmas dentro de um serviço e quer que cada educador veja só a dele, é preciso um cadastro de turmas no Núcleo (mudança maior, nova ADR) e as aplicações já gravadas ganham a turma depois.
2. **Sentido da escala nos itens de Barreira.** O texto da proposta diz "3 = plena" e "0 = ausência de barreira", mas as faixas e a frequência (≥80% = 3) mostram que **nota alta é sempre melhor**. Adotei: em Barreira, **3 = barreira ausente ou mínima**, 0 = barreira severa. _Custo:_ se for o contrário, os subtotais de Barreira ficam invertidos e as faixas erradas até corrigir os dados do instrumento (nova versão).
3. **Legenda por nível.** A proposta não traz o texto de cada nota por item; a tela usa a legenda geral (0 = nenhuma evolução/adequação, 3 = plena; em Barreira, 0 = barreira severa, 3 = ausente) e, no item 7, as faixas de frequência. _Custo:_ se a equipe usa texto próprio por item, entra como nova versão do instrumento, sem mudar o que foi gravado.
4. **Os três instrumentos são dados do módulo**, não código do motor; o motor só ganha, se faltar, o campo de **etiqueta** do item (CIF). Mudança na capacidade, só com aprovação da Diretoria (ver ADR-029). _Custo:_ sem a etiqueta no motor, a CIF fica guardada no texto do item.
5. **Dimensão = domínio do motor**, e a CIF é só etiqueta. _Custo:_ nenhum visível; se a Diretoria quiser subtotal por CIF, é nova entrega.
6. **Reavaliação a cada 12 meses**, como na Assistência Social. A proposta não fala de periodicidade. _Custo:_ se Educação avalia por semestre ou bimestre, muda só a regra 13.
7. **Percentual de frequência não é guardado**, só a nota do item 7 (menos dado sensível guardado).
8. **Ciente da coordenação** é gravado na aplicação, sem exigir assinatura digital; a assinatura continua na ficha impressa.
9. **"Menor pontuação" da principal barreira medida em % do máximo da dimensão**, não em pontos brutos, porque Adequação só vai a 6 e perderia sempre. _Custo:_ se a equipe quer pontos brutos, muda só essa regra de cálculo e os textos do painel; nada gravado muda, pois o campo não é guardado.
10. **Rota `/educacao`** e permissões `educacao.*`; o app nasce com o nome "Educação".
11. **Permissão `educacao.ciente`** (entrega 1). A regra 12 pede "perfil de coordenação ou Diretoria", mas o `Autorizador` só conhece permissões, não perfis. Criei a permissão `educacao.ciente` (Diretoria e coordenação de serviço), no escopo do serviço. _Custo:_ se a Diretoria quiser outro desenho, muda só o manifesto.
12. **Instrumentos entram na aba na primeira vez que o app é usado** (idempotente, auditados como "sistema"), porque "Preparar estrutura" não grava dados. _Custo:_ nenhum visível; se preferir carga manual, vira uma ação da administração.
13. **Legenda de encaminhamento por faixa**: o documento passado traz só o nome das três faixas; não inventei o texto de encaminhamento. A tela mostra a faixa e os pontos. _Custo:_ quando a Diretoria enviar os textos, entram como nova versão do instrumento.
14. **Cor do app Educação: ocre** (#8A6D00 claro, #E6C85A escuro), escolhida por mim; o magenta continua reservado para Questionários. Dourado fica perto do aviso âmbar, por isso vem sempre com nome e ícone. _Custo:_ trocar só em `globals.css` e `docs/identidade-visual.md`.
15. **Instrumento sugerido pelo nome do serviço** (contém "infantil", "fundamental" ou "trabalho"); se não bater, a pessoa escolhe. _Custo:_ se os serviços tiverem outros nomes, a sugestão não aparece, mas nada quebra.
16. **Corrigir**: a aplicação corrigida continua na lista com a etiqueta "Corrigida" (o comparativo da entrega 2 usa só a vigente).

## Critérios de pronto

- [ ] Regras de negócio com testes (cálculo dos três instrumentos, faixas, ciclos, ciente, mínimo de 5 no painel)
- [ ] Testes de acesso (educador do serviço, coordenação, Conselho, Financeiro, Administração, Diretoria)
- [ ] `npm run verificar` e `npm run build` verdes
- [ ] Conferido pela Diretoria na prévia, com dados fictícios: aplicar um instrumento, ver total e subtotais mudarem ao vivo, concluir, ver o ciente, comparar dois períodos e corrigir criando nova aplicação

## Instrumentos e cabeçalho "Quem e quando" (proposta #223)

Texto completo em `docs/especificacao-plataforma.md` (seção "Família Avaliações no menu e formulários uniformes") e ADR-037.
Neste app: nova tela `/educacao/instrumentos` (os três instrumentos, com "Aplicar a uma pessoa" para `/educacao/nova?instrumento=<código>`),
item "Instrumentos" no menu em Avaliar, e o formulário com a seção "Quem e quando" no leiaute da Saúde. "Sobre o instrumento" não muda.
