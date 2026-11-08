# Metodologia de desenvolvimento do Elo

Atualizado em 8 de novembro de 2026 · Diretoria da Apae Batatais

O Elo é desenvolvido por agentes (conversas no Claude e o Claude Code). A Diretoria é a dona do
produto e participa só em três momentos. Todo o resto anda sozinho e fica registrado no GitHub,
que é o ponto de encontro entre as conversas (elas não compartilham memória).

## Os três momentos da Diretoria

1. **Ideias**: conversa com o Product Owner sobre o que o Elo deve oferecer.
2. **Aprovar a especificação**: no PR de especificação.
3. **Aprovar a entrega**: no PR de código, depois de conferir na prévia.

A publicação oficial continua semanal, quando a Diretoria pedir (regras no `CLAUDE.md`).

## Papéis

| Papel | Onde | O que faz | O que entrega |
| --- | --- | --- | --- |
| Diretoria | — | Dona do produto: decide, prioriza e aprova | Ideias e aprovações |
| Product Owner | Conversa "Product Owner" | Discute ideias com a Diretoria e registra cada proposta, sem detalhe técnico | Issue com o modelo "Proposta" |
| Arquiteto de Soluções | Conversa "Arquiteto de Soluções" | Lê as propostas, levanta dúvidas com a Diretoria e escreve a especificação técnica (e a ADR, se houver decisão de arquitetura) | PR de especificação |
| Scrum Master | Conversa "Scrum Master" | Organiza a construção do que foi aprovado, aciona o Claude Code, acompanha verificação, prévia, aprovação e publicação; sugere melhorias nas especificações | PR de entrega, publicação |
| Desenvolvedor | Claude Code | Constrói seguindo o `CLAUDE.md` | Código, testes e prévia |

## Quadro (backlog)

O backlog é o quadro "Elo" no GitHub Projects. Cada cartão é uma issue (proposta). A ordem dentro
de cada coluna é a prioridade, decidida pela Diretoria.

| Coluna | Quando o cartão chega | Quem age |
| --- | --- | --- |
| Proposta | Issue aberta | Arquiteto |
| Especificação em aprovação | PR com "Especifica #n" aberto | **Diretoria** |
| Pronta para construir | Merge do PR de especificação | Scrum Master |
| Em construção | PR com "Entrega #n" aberto como rascunho | Desenvolvedor |
| Entrega em aprovação | PR de entrega pronto para revisão | **Diretoria** |
| Aprovada | Merge do PR de entrega (a issue é fechada) | fila da publicação |
| Publicada | Publicação oficial com sucesso | — |

As colunas em que a Diretoria age são a caixa de entrada dela. Os cartões andam sozinhos pela
automação `.github/workflows/fluxo.yml`: a etapa fica numa etiqueta `etapa: …` da issue e é
copiada para o quadro. Se o PR for fechado sem merge, o cartão volta uma coluna.

## Combinados

- **Uma proposta = uma issue.** Proposta grande é dividida pelo Arquiteto em várias entregas; cada
  entrega pode virar uma issue própria ligada à proposta original.
- **No texto do PR**, sempre a referência à issue:
  - especificação: `Especifica #12`
  - construção: `Entrega #12` (aberto como rascunho enquanto está em construção)
- **Etiquetas de app**: `app: orçamento`, `app: requisições`, `app: avaliação`,
  `app: comunicação`, `app: rede`, `app: plataforma`, `app: novo`. O Product Owner põe a do app.
- **Pendências da Diretoria** fora do código (por exemplo, definir o DPO) são issues com a
  etiqueta `pendência da Diretoria`; elas não entram no fluxo.
- **Ninguém mexe nas etiquetas `etapa: …` à mão**, exceto o Scrum Master para corrigir algo; a
  automação cuida delas.
- **Fontes únicas**: proposta na issue; regras do app na especificação (`src/modulos/<id>/
  especificacao.md`); decisões de arquitetura nas ADRs; o que fica para depois no
  `docs/roadmap.md`; andamento da construção no plano (`docs/superpowers/plans/`).

## Instruções para cada conversa

Cole o texto de cada papel como primeira mensagem da conversa (ou nas instruções dela). As três
precisam do GitHub conectado, com acesso ao repositório `apae-batatais/plataforma-elo`.

### Product Owner

> Você é o Product Owner assistente do Elo (repositório apae-batatais/plataforma-elo). A Diretoria
> da Apae Batatais é a dona do produto e decide. Seu trabalho: discutir ideias de funcionalidades
> e de apps com a Diretoria, fazer perguntas antes de propor (uma por mensagem, com opções
> numeradas) e, quando a Diretoria aprovar a ideia, abrir uma issue com o modelo "Proposta"
> (problema, para quem, resultado esperado, app, observações) e a etiqueta do app. Sem detalhe
> técnico. Antes de abrir, procure issues parecidas para não duplicar. Leia `docs/metodologia.md`.
> Converse só em português, sem formalidade.

### Arquiteto de Soluções

> Você é o Arquiteto de Soluções do Elo (repositório apae-batatais/plataforma-elo). Siga o
> `CLAUDE.md` e `docs/metodologia.md`. Pegue as issues da coluna Proposta, na ordem do quadro,
> leia o código e os documentos, levante as dúvidas com a Diretoria (uma pergunta por mensagem,
> com opções numeradas) e escreva a especificação técnica no lugar indicado pelo `CLAUDE.md`, com
> ADR quando houver decisão de arquitetura. Abra o PR de especificação com `Especifica #n` no
> texto. Não escreva código de produção.

### Scrum Master

> Você é o Scrum Master do Elo (repositório apae-batatais/plataforma-elo). Siga o `CLAUDE.md` e
> `docs/metodologia.md`. Pegue as issues da coluna "Pronta para construir", na ordem do quadro,
> organize as entregas, acione o Claude Code para construir (PR de entrega com `Entrega #n`,
> aberto como rascunho e marcado como pronto quando a verificação passar e a prévia estiver no
> ar), acompanhe até a aprovação da Diretoria e o merge, e avise quando houver entregas
> esperando a publicação semanal. Aponte melhorias nas especificações antes de construir.
> Converse só em português, sem formalidade.

A Diretoria ainda precisa testar se a conversa Scrum Master consegue acionar e acompanhar sessões
do Claude Code sozinha. Enquanto isso não for confirmado, ela entrega ao Claude Code o texto da
tarefa pronto para a Diretoria iniciar a sessão.

## Configuração única do quadro (pela Diretoria, no navegador)

As sessões do Claude só têm acesso ao repositório, não aos projetos da organização. Por isso o
quadro é criado uma vez pela Diretoria:

1. **Criar o projeto**: github.com/apae-batatais → Projects → New project → Board → nome "Elo".
   Anote o número que aparece no endereço (`.../projects/<número>`).
2. **Colunas**: no campo Status, deixe exatamente estas opções, nesta ordem: Proposta,
   Especificação em aprovação, Pronta para construir, Em construção, Entrega em aprovação,
   Aprovada, Publicada.
3. **Desligar as automações próprias do quadro**: menu ⋯ → Workflows → desligue "Item closed",
   "Pull request merged" e as demais que mudam o Status. Quem move os cartões é a automação do
   repositório.
4. **Chave de acesso**: github.com/settings/personal-access-tokens → Generate new token
   (fine-grained) → Resource owner: apae-batatais → Repository access: só plataforma-elo, com
   Issues em "Read" → Organization permissions: Projects em "Read and write". Se a organização não
   aparecer em Resource owner, a organização precisa permitir chaves desse tipo (Settings da
   organização → Personal access tokens).
5. **Cadastrar no repositório**: plataforma-elo → Settings → Secrets and variables → Actions:
   - aba Secrets: `QUADRO_TOKEN` com a chave do passo 4;
   - aba Variables: `QUADRO_NUMERO` com o número do passo 1.
6. **Sincronizar**: Actions → Fluxo → Run workflow. Todas as issues com etapa entram no quadro.

Sem os passos 4 e 5, a automação continua trocando as etiquetas `etapa: …`; só o quadro não
acompanha.

## Migração do `docs/backlog.md`

Depois que este fluxo for aprovado e as entregas em andamento na outra conversa terminarem, os
itens em aberto do `docs/backlog.md` viram issues (cada uma na etapa em que está) e o arquivo passa
a apontar para o quadro. Os itens concluídos ficam no histórico dos PRs.
