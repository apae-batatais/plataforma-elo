# Metodologia de desenvolvimento do Elo

Atualizado em 8 de novembro de 2026 · Diretoria da Apae Batatais · Decisão de arquitetura: ADR-019

O Elo é desenvolvido por agentes. A Diretoria é a dona do produto e participa só em três
momentos. Todo o resto anda sozinho pelo GitHub, que é o ponto de encontro de tudo: propostas,
especificações, código, prévias e publicação.

## Os três momentos da Diretoria

1. **Ideias**: conversa com o Product Owner, que registra cada proposta como issue.
2. **Aprovar a especificação**: botão "Approve" no PR de especificação.
3. **Aprovar a entrega**: conferir a prévia e clicar em "Approve" no PR de entrega.

Além disso, a Diretoria responde às perguntas que o Arquiteto deixar como comentário na issue. O
GitHub avisa por e-mail sempre que alguma coisa depende dela.

## Papéis

| Papel | Quem | O que faz | O que entrega |
| --- | --- | --- | --- |
| Diretoria | — | Dona do produto: decide, prioriza e aprova | Ideias, respostas e aprovações |
| Product Owner | Conversa "Product Owner" no Claude | Discute ideias com a Diretoria e registra a proposta, sem detalhe técnico | Issue com o modelo "Proposta" |
| Arquiteto de Soluções | Claude Code no GitHub, sozinho quando a issue é aberta | Lê a proposta, o código e os documentos; pergunta na issue o que não souber; escreve a especificação (e a ADR, se houver decisão de arquitetura); aponta melhorias | PR de especificação |
| Desenvolvedor | Claude Code no GitHub, sozinho quando a especificação é aprovada | Constrói seguindo o `CLAUDE.md`, com testes, verificação e prévia | PR de entrega |
| Automação | GitHub Actions | Move os cartões, faz o merge depois da aprovação e publica toda semana | — |

## Quadro (backlog)

O backlog é o quadro "Elo" no GitHub Projects. Cada cartão é uma issue (proposta). A ordem dentro
de cada coluna é a prioridade, decidida pela Diretoria.

| Coluna | Quando o cartão chega | Quem age |
| --- | --- | --- |
| Proposta | Issue aberta | Arquiteto (e a Diretoria, se houver pergunta na issue) |
| Especificação em aprovação | PR com "Especifica #n" aberto | **Diretoria** |
| Pronta para construir | Merge do PR de especificação | Desenvolvedor |
| Em construção | O Desenvolvedor começa a construir | Desenvolvedor (e a Diretoria, se houver pergunta na issue) |
| Entrega em aprovação | PR com "Entrega #n" aberto, já verificado; a prévia é publicada em seguida | **Diretoria** |
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
| Telas | Identidade visual, acessibilidade e componentes |
| Regras e dados | Camada de aplicação, planilhas, permissões, auditoria e testes |
| Infraestrutura | Netlify, GitHub Actions e Google |

Toda especificação diz quais **frentes** a entrega tem (telas, regras e dados, infraestrutura), e
o Desenvolvedor usa as habilidades dessas frentes. No GitHub, o Claude Code só enxerga o que está no
repositório: habilidades da conta da Diretoria no Claude não vão junto.

## Combinados

- **Uma proposta = uma issue.** Proposta grande é dividida pelo Arquiteto em entregas; cada entrega
  pode virar uma issue própria ligada à original.
- **No texto do PR**, sempre a referência à issue:
  - especificação: `Especifica #12`
  - construção: `Entrega #12`
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
> da Apae Batatais é a dona do produto e decide. Seu trabalho: discutir ideias de funcionalidades
> e de apps com a Diretoria, fazer perguntas antes de propor (uma por mensagem, com opções
> numeradas) e, quando a Diretoria aprovar a ideia, abrir uma issue com o modelo "Proposta"
> (problema, para quem, resultado esperado, app, observações) e a etiqueta do app. Sem detalhe
> técnico: a especificação é do Arquiteto. Antes de abrir, procure issues parecidas para não
> duplicar. Leia `docs/metodologia.md`. Converse só em português, sem formalidade.

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
