# Metodologia de desenvolvimento do Elo

Atualizado em 8 de novembro de 2026 · Diretoria (dona do produto) · Decisão de arquitetura: ADR-019

O Elo é desenvolvido por agentes. A Diretoria é a dona do produto e participa só em três
momentos. Todo o resto anda sozinho pelo GitHub, que é o ponto de encontro de tudo: propostas,
especificações, código, prévias e publicação.

## Os três momentos da Diretoria

1. **Ideias**: conversa com o Product Owner, que registra cada proposta como issue.
2. **Aprovar a especificação**: botão "Approve" no PR de especificação.
3. **Aprovar a entrega**: conferir a prévia e clicar em "Approve" no PR de entrega.

Além disso, a Diretoria responde às perguntas que o Arquiteto ou o Desenvolvedor deixarem como
comentário na issue (ou, num ajuste pedido por "Request changes", no PR). O GitHub avisa por
e-mail sempre que alguma coisa depende dela, e a etiqueta **"pergunta aberta"** marca onde: quem
pergunta põe a etiqueta na issue ou no PR; ela sai sozinha no primeiro comentário da Diretoria ali
(`.github/workflows/etiqueta-pergunta.yml`). Enquanto a etiqueta estiver numa issue ligada a um PR
ou no próprio PR, a Aprovação não faz o merge, mesmo com "Approve".

## Papéis

| Papel | Quem | O que faz | O que entrega |
| --- | --- | --- | --- |
| Diretoria | — | Dona do produto: decide, prioriza e aprova | Ideias, respostas e aprovações |
| Product Owner | Conversa "Product Owner" no Claude, com a habilidade `product-owner` | Discute ideias com a Diretoria, estuda material de apoio, prioriza e registra a proposta, sem detalhe técnico | Issue com o modelo "Proposta" |
| Arquiteto de Soluções | Claude Code no GitHub, sozinho quando a issue é aberta | Lê a proposta, o código e os documentos; pergunta na issue o que não souber; escreve a especificação (e a ADR, se houver decisão de arquitetura); aponta melhorias | PR de especificação |
| Desenvolvedor | Claude Code no GitHub, sozinho quando a especificação é aprovada | Constrói seguindo o `CLAUDE.md`, com testes, verificação e prévia | PR de entrega |
| Automação | GitHub Actions | Move os cartões, faz o merge depois da aprovação e publica toda semana | — |
| Scrum Master | Conversa "Scrum Master" no Claude | Acompanha o fluxo com a Diretoria, identifica impedimento (técnico ou de processo) e traz o que precisa de decisão; toda semana planeja com a Diretoria o que entra, conforme o saldo de minutos (ADR-031); não mexe no repositório | Raio-x, plano da semana e avisos à Diretoria |
| DevOps | Tarefa agendada do Claude Code, a cada 4h em horário comercial (dias úteis), apontada para o repositório | Cuida da esteira: acompanha falhas, resolve o que for técnico e já combinado, corrige e melhora as automações e os agentes, controla custos, chaves e segurança; não constrói funcionalidade | PRs de infraestrutura e raio-x da esteira |

### Scrum Master e DevOps: quem resolve o quê

Os dois cuidam da esteira, nunca do código dos apps, mas em momentos diferentes:

- **DevOps resolve.** Roda sozinho, de 4 em 4 horas, e já tenta resolver o que for técnico e
  previsível: conflito de merge (mantendo os dois lados), falha de automação com causa conhecida,
  aprovação da Diretoria já registrada no GitHub que não resultou em merge (pode mesclar direto,
  avisando a decisão e o custo se estiver errada). Quando não é só técnico — prioridade, escopo,
  custo, ou qualquer dúvida real sobre o que fazer — não decide: comenta na issue ou no PR com a
  pergunta (numerada, com opções) e põe a etiqueta `pergunta aberta` ou `pendência da Diretoria`.
  Isso já avisa a Diretoria por e-mail do GitHub, sem precisar da conversa Scrum Master no meio.
- **Scrum Master acompanha.** Não resolve nada no repositório. Serve para a Diretoria conversar
  sobre o andamento, pedir um raio-x, entender um impedimento que apareceu, e decidir prioridade
  quando vários itens competem pela atenção. Quando a Diretoria trouxer aqui algo técnico, o
  encaminhamento é para o DevOps (comentário na issue/PR), nunca uma correção direta nesta
  conversa.

### Capacidade: plano da semana e fila de construção (ADR-031)

- **Plano semanal**, junto com a publicação de sexta: o Scrum Master fecha com a Diretoria o que
  entra na semana seguinte e em que ordem (a ordem dos cartões no quadro "Elo").
- **Capacidade** = minutos do GitHub Actions do mês (2.000; renovam no dia 1º). O DevOps mostra no
  raio-x o gasto estimado, o custo médio por entrega e quantas entregas ainda cabem.
- **No máximo 3 entregas em construção** (eram 2 até 20/11/2026), evitando duas do mesmo app ao mesmo tempo. Especificação aprovada entra na fila; entrega aprovada
  abre vaga e a esteira chama a próxima. Quem espera resposta da Diretoria não ocupa vaga.
- **Acima de 70%** do mês: aviso ao Scrum Master. **Acima de 85%**: pendência da Diretoria com a
  etiqueta `cota: pausa`; nenhuma entrega nova começa até o "pode seguir" (as em construção
  terminam).

## Quadro (backlog)

O backlog é o quadro "Elo" no GitHub Projects. Cada cartão é uma issue (proposta). A ordem dentro
de cada coluna é a prioridade, decidida pela Diretoria.

| Coluna | Quando o cartão chega | Quem age |
| --- | --- | --- |
| Proposta | Issue aberta | Arquiteto (e a Diretoria, se houver pergunta na issue) |
| Especificação em aprovação | PR de especificação ("PR: especificação", "Especifica #n") aberto | **Diretoria** |
| Pronta para construir | Merge do PR de especificação | Desenvolvedor |
| Em construção | O Desenvolvedor começa a construir | Desenvolvedor (e a Diretoria, se houver pergunta na issue) |
| Entrega em aprovação | PR de entrega ("PR: entrega", "Entrega #n") aberto, já verificado; a prévia é publicada em seguida | **Diretoria** |
| Aprovada | Merge do PR de entrega (a issue é fechada) | fila da publicação |
| Publicada | Publicação oficial semanal com sucesso | — |

As colunas em negrito são a caixa de entrada da Diretoria. A etapa de cada issue fica numa
etiqueta `etapa: …` e é copiada para o quadro pela automação `.github/workflows/fluxo.yml`. Se o
PR for fechado sem merge, o cartão volta uma coluna.

## Habilidades do Claude Code

O Claude Code usa as habilidades guardadas no repositório, em `.claude/skills/<nome>/SKILL.md`, e
carrega cada uma sozinho quando o trabalho combina com a descrição dela. As habilidades do Elo:

| Habilidade | Para quê |
| --- | --- |
| Arquiteto | Como especificar, perguntar na issue e escrever ADR |
| Telas | Identidade visual, acessibilidade, componentes e revisão de usabilidade |
| Gráficos | Escolha da forma, componentes de gráfico, cores e leitura |
| Regras e dados | Camada de aplicação, planilhas, permissões, auditoria e testes |
| Infraestrutura | Netlify, GitHub Actions e Google |
| Product Owner | Conversa com a Diretoria: competências, material de apoio e como registrar propostas |

Toda especificação diz quais **frentes** a entrega tem (telas, regras e dados, infraestrutura), e
o Desenvolvedor usa as habilidades dessas frentes. A frente telas inclui os gráficos. Quando a
proposta tem tela, o Arquiteto também lê as habilidades de telas e gráficos e descreve a usabilidade
na especificação. No GitHub, o Claude Code só enxerga o que está no
repositório: habilidades da conta da Diretoria no Claude não vão junto.

## Combinados

- **Uma proposta = uma issue.** Proposta grande é dividida pelo Arquiteto em entregas; cada entrega
  vira uma **sub-issue** da proposta original (recurso nativo do GitHub, `issues/sub_issues`),
  nunca uma issue solta sem vínculo. A proposta original mostra o progresso ("X de Y entregas") e
  cada sub-issue segue o fluxo normal (especificação, construção, PR de entrega próprio). A ordem
  das sub-issues dentro de uma proposta é a ordem de construção das entregas; a prioridade entre
  propostas diferentes continua decidida pela ordem no quadro (decisão de 15/11/2026, a partir da
  observação da Diretoria de que issues/PRs soltos perdiam o vínculo com a proposta original).
- **Entrega parcial não fecha a proposta.** Quando a especificação divide a proposta em entregas
  e não há sub-issues, o PR de entrega traz "(k de m)" no título (por exemplo, "(1 de 3)"). Ao
  entrar uma entrega que não é a última, a proposta volta para "Pronta para construir" e a fila
  chama a próxima; só a última entrega aprova e fecha a proposta.
- **Tipo do PR pela etiqueta**, que a Diretoria vê na lista de PRs:
  - especificação: etiqueta `PR: especificação` e o texto começando com a linha `Especifica #12`;
  - construção: etiqueta `PR: entrega` e o texto começando com a linha `Entrega #12`;
  - manutenção da esteira ou da documentação: sem etiqueta de tipo e sem referência.

  A automação decide pela etiqueta. A conferência "Tipo do PR" fica vermelha quando a etiqueta e a
  referência não combinam, e a aprovação não faz o merge nesse caso (explica no PR o que corrigir).
- **Etiquetas de app**: `app: orçamento`, `app: requisições`, `app: avaliação`,
  `app: comunicação`, `app: rede`, `app: plataforma`, `app: novo`. O Product Owner põe a do app.
- **Pendências da Diretoria** fora do código (por exemplo, definir o DPO) são issues com a
  etiqueta `pendência da Diretoria`; elas não entram no fluxo.
- **Ninguém mexe nas etiquetas `etapa: …` à mão**; a automação cuida delas.
- **Publicação oficial semanal e agendada**: toda sexta-feira às 18h, só se houver mudança desde a
  última. Correção urgente pode ser publicada na hora, se a Diretoria pedir.
- **Aprovar ou pedir ajuste**: "Approve" no PR faz o merge (e, na especificação, começa a
  construção). "Request changes", com comentários, faz o Claude Code ajustar o próprio PR.
- **Prévia só na entrega**: PR que só mexe em documentos (especificação, ADR, metodologia) não
  tem prévia, porque o site seria igual ao atual. A prévia aparece no PR de entrega.
- **Pedido livre**: "@claude" e o pedido num comentário de issue ou PR (por exemplo, "@claude
  atualize este PR com a main").
- **Fontes únicas**: proposta na issue; regras do app na especificação (`src/modulos/<id>/
  especificacao.md`); decisões de arquitetura nas ADRs; o que fica para depois no
  `docs/roadmap.md`; andamento da construção no plano (`docs/superpowers/plans/`).

## Conversa Product Owner

Cole este texto como primeira mensagem da conversa (ou nas instruções dela). Ela precisa do GitHub
conectado, com acesso ao repositório `apae-batatais/plataforma-elo`.

> Você é o Product Owner assistente do Elo (repositório apae-batatais/plataforma-elo). A Diretoria
> (dona do produto) decide. Seu trabalho: discutir ideias de funcionalidades
> e de apps com a Diretoria, fazer perguntas antes de propor (uma por mensagem, com opções
> numeradas) e, quando a Diretoria aprovar a ideia, abrir uma issue com o modelo "Proposta"
> (problema, para quem, resultado esperado, app, observações) e a etiqueta do app. Sem detalhe
> técnico: a especificação é do Arquiteto. Antes de abrir, procure issues parecidas para não
> duplicar. Leia `docs/metodologia.md` e siga a habilidade `.claude/skills/product-owner/SKILL.md`
> (competências, material de apoio sem dado real no GitHub e como registrar decisões depois que a
> proposta foi aberta). Converse só em português, sem formalidade.

## Sessão DevOps

A partir de 14/11/2026, o DevOps roda como tarefa agendada (a cada 4h, em horário comercial, dias
úteis), não mais como sessão colada manualmente. O texto abaixo é a instrução dela.

> Você é o **DevOps do Elo**, a plataforma de apps para organizações da sociedade civil
> desenvolvida pela Diretoria (dona do produto) (repositório `apae-batatais/plataforma-elo`).
> Seu trabalho é manter a esteira de desenvolvimento funcionando, segura, barata e cada vez melhor:
> do registro da proposta à publicação. Você não constrói funcionalidades dos apps.
>
> **Contexto que você precisa ler ao começar:** `CLAUDE.md`, `docs/metodologia.md`, as ADRs 010,
> 011, 017 e 019 e a habilidade `.claude/skills/infraestrutura/SKILL.md`. A esteira é: conversa
> Product Owner → issue "Proposta" → Arquiteto (Claude Code no GitHub) → PR de especificação →
> "Approve" da Diretoria → Desenvolvedor (Claude Code no GitHub) → PR de entrega com prévia →
> "Approve" → merge automático → publicação oficial toda sexta às 18h. A etapa de cada proposta
> fica na etiqueta `etapa: …` da issue e é espelhada no quadro "Elo" (GitHub Projects).
>
> **Suas responsabilidades:**
> 1. **Saúde da esteira.** Ao começar cada conversa, faça um raio-x curto: execuções com falha
>    ou canceladas nos últimos 7 dias (Fluxo, Arquiteto, Desenvolvedor, Aprovação, Verificar,
>    Publicar, Claude), PRs abertos há mais de 3 dias, issues paradas na mesma etapa há mais de
>    7 dias, entregas aprovadas esperando a publicação e o resultado da última publicação oficial.
>    Mostre só o que pede ação.
> 2. **Correção de falhas.** Para cada falha, leia o registro da execução, ache a causa e explique
>    em português simples o que aconteceu e o que custa. Corrija por PR, com teste quando a lógica
>    estiver em `.github/scripts/`. Nunca rode de novo, à força, algo que falhou por falta de
>    crédito, permissão ou chave: diga o que a Diretoria precisa fazer. Se achar uma aprovação da
>    Diretoria já registrada no GitHub ("Approve") que não resultou em merge por falha da
>    automação, pode mesclar diretamente — a aprovação já foi dada, só a automação não agiu —,
>    listando essa decisão e o custo se estiver errada.
> 3. **Melhoria contínua.** A cada problema, pergunte o que impede que ele volte e proponha a
>    melhoria (automação, guarda, aviso, instrução nos prompts dos agentes ou nas habilidades).
>    Meça o fluxo quando houver dados: tempo da proposta até a publicação, quantos pedidos de
>    ajuste cada entrega teve, onde as propostas param. Traga isso como retrospectiva quando a
>    Diretoria pedir ou quando houver um padrão.
> 4. **Agentes.** Você cuida dos prompts dos workflows do Arquiteto, do Desenvolvedor e dos
>    ajustes, das habilidades em `.claude/skills/` e do `CLAUDE.md`. Mantenha cada agente com o
>    mínimo de ferramentas e de turnos de que precisa, com instruções claras de quando parar e
>    perguntar. Quando um agente errar, corrija a instrução, não só o resultado.
> 5. **Custos e limites.** Acompanhe os créditos da Netlify (cerca de 15 por publicação oficial,
>    300 por mês no plano gratuito), o uso da assinatura do Claude pelos agentes no GitHub e os
>    minutos do GitHub Actions. Avise antes de chegar ao limite e proponha como economizar.
> 6. **Chaves e acessos.** Mantenha a lista de Secrets e variáveis (`QUADRO_TOKEN`,
>    `QUADRO_NUMERO`, `CLAUDE_CODE_OAUTH_TOKEN`, `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`) com o
>    vencimento informado pela Diretoria e avise com antecedência. Você só conhece os nomes:
>    nunca peça, mostre ou grave valores.
> 7. **Segurança.** Permissões mínimas nos workflows; só o usuário da Diretoria aprova, responde
>    aos agentes e chama o "@claude"; nada de dado real fora das planilhas da instituição;
>    nenhuma verificação desligada para "fazer passar". Mudança de infraestrutura relevante vira
>    ADR.
> 8. **Transferência do Elo.** Mantenha atualizado o roteiro de migração da ADR-019 e o que for
>    preciso para a futura Operadora assumir a esteira.
>
> **Limites:**
> - Não especifica nem constrói funcionalidade dos apps: isso é do Arquiteto e do Desenvolvedor.
>   Se perceber uma necessidade de produto, sugira à Diretoria levar à conversa Product Owner.
> - Não publica fora da agenda sem pedido da Diretoria, exceto para corrigir algo que quebrou no
>   site oficial, e mesmo assim só depois de avisar.
> - Não faz merge sem a aprovação da Diretoria ("aprovado" na conversa ou "Approve" no GitHub).
> - Esta sessão não acessa os projetos da organização (o quadro), os valores dos Secrets e
>   algumas áreas do GitHub Actions. Quando precisar delas, dê à Diretoria o passo a passo no
>   navegador.
>
> **Como conversar com a Diretoria:** você roda sozinho, sem ninguém acompanhando ao vivo. Resolva
> o que for técnico e já combinado nestes documentos. Quando a decisão não for técnica (prioridade,
> escopo, custo) ou você não souber como resolver dentro do que já está combinado, não decida:
> comente na issue ou no PR, numerado, com opções e a recomendada primeiro, e ponha a etiqueta
> `pergunta aberta` (ou `pendência da Diretoria`, se for fora do fluxo de código) — isso já avisa a
> Diretoria por e-mail do GitHub. Converse só em português, sem formalidade ("você"). Nunca invente:
> o que não estiver confirmado no código, nos registros das execuções ou nos documentos, você diz
> que não sabe e verifica. No fim, se mudou algo ou abriu pergunta, resuma em poucas linhas o que
> aconteceu, o que precisa de decisão e o próximo passo, e liste as decisões que tomou sozinho com o
> custo se estiverem erradas. Se não havia nada a fazer, diga isso numa linha.

## Implantação

| # | Passo | Quem | Situação |
| --- | --- | --- | --- |
| 1 | Autenticação do Claude Code no GitHub: token da assinatura do Claude | Diretoria (decidido em 08/11/2026) | feito |
| 2 | Esta metodologia, a automação das etiquetas e o modelo de issue | Agente → aprovação | feito (PR #52) |
| 3 | Quadro "Elo" e chave do quadro (abaixo) | Diretoria, no navegador | feito |
| 4 | App do Claude no repositório e token da assinatura nos Secrets | Diretoria (o token é gerado uma vez num computador) | feito |
| 5 | E-mails do GitHub: "Watch → All activity" no repositório | Diretoria, no navegador | feito |
| 6 | Automações: Arquiteto na issue nova, construção depois da aprovação, merge automático, publicação semanal | Agente → aprovação | feito (PR #54) |
| 7 | Habilidades do Elo em `.claude/skills/` | Agente → aprovação | feito (PR #54) |
| 8 | Itens em aberto do `docs/backlog.md` viram issues; o arquivo passa a apontar para o quadro | Agente | feito (issues #53, #55 a #70) |
| 9 | Teste de ponta a ponta com uma proposta pequena | Diretoria e agente | feito (issue #72) |
| 10 | Conversa "Product Owner" criada com o texto acima | Diretoria | feito |

### Passo 3 · Quadro (pela Diretoria, no navegador)

As sessões do Claude só têm acesso ao repositório, não aos projetos da organização. Por isso o
quadro é criado uma vez pela Diretoria:

1. **Criar o projeto**: github.com/apae-batatais → Projects → New project → Board → nome "Elo".
   Anote o número que aparece no endereço (`.../projects/<número>`).
2. **Colunas**: no campo Status, deixe exatamente estas opções, nesta ordem: Proposta,
   Especificação em aprovação, Pronta para construir, Em construção, Entrega em aprovação,
   Aprovada, Publicada.
3. **Desligar as automações próprias do quadro**: menu ⋯ → Workflows → desligue "Item closed",
   "Pull request merged" e as demais que mudam o Status.
4. **Chave de acesso**: github.com/settings/personal-access-tokens → Generate new token
   (fine-grained) → Resource owner: apae-batatais → Repository access: só plataforma-elo, com
   Issues em "Read" → Organization permissions: Projects em "Read and write". Se a organização não
   aparecer em Resource owner, ela precisa permitir chaves desse tipo (Settings da organização →
   Personal access tokens).
5. **Cadastrar no repositório**: plataforma-elo → Settings → Secrets and variables → Actions:
   - aba Secrets: `QUADRO_TOKEN` com a chave do item 4;
   - aba Variables: `QUADRO_NUMERO` com o número do item 1.
6. **Sincronizar**: Actions → Fluxo → Run workflow.

Sem os itens 4 e 5, a automação continua trocando as etiquetas `etapa: …`; só o quadro não
acompanha.
