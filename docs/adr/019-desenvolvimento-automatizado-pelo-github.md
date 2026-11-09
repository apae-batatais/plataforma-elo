# ADR-019 · Desenvolvimento automatizado pelo GitHub, com a Diretoria em três momentos

- Situação: aceita
- Data: 2026-11-08
- Complementa: ADR-010 (desenvolvimento só na nuvem)

## Contexto

A Diretoria quer aplicar uma metodologia ágil ao desenvolvimento do Elo e atuar só em três
momentos: discutir ideias, aprovar especificações e aprovar entregas. Avaliou ter conversas
separadas para Product Owner, Arquiteto de Soluções e Scrum Master e concluiu que a automação
substitui o Scrum Master. As sessões do Claude só têm acesso ao repositório, não aos projetos
(quadros) da organização no GitHub.

## Decisão

- **Propostas são issues** (modelo "Proposta"), abertas pela conversa Product Owner.
- **Backlog é o quadro "Elo"** no GitHub Projects. A etapa de cada issue fica numa etiqueta
  `etapa: …`, trocada pela automação `Fluxo` a partir dos PRs (`Especifica #n`, `Entrega #n`) e da
  publicação; com a chave `QUADRO_TOKEN`, a automação copia a etapa para o quadro.
- **Arquiteto e Desenvolvedor são o Claude Code rodando no GitHub Actions**: o Arquiteto começa
  quando a issue é aberta e o Desenvolvedor quando a especificação é aprovada. Perguntas à
  Diretoria são feitas como comentário na issue.
- **Autenticação do Claude Code no GitHub pelo token da assinatura do Claude** (decisão da
  Diretoria, 08/11/2026), sem custo por uso além do plano.
- **Aprovar = "Approve" no PR**; a automação faz o merge.
- **Publicação oficial semanal e agendada**, no lugar do pedido "publicar".
- **Habilidades do Claude Code no repositório** (`.claude/skills/`): Arquiteto, Telas, Regras e
  dados, Infraestrutura. A especificação diz as frentes da entrega.
- O papel de Scrum Master não existe; a tarefa de apontar melhorias na especificação fica com o
  Arquiteto.

## Consequências

- A Diretoria recebe por e-mail só o que depende dela (perguntas e aprovações).
- O token da assinatura é gerado uma vez num computador com o Claude Code (exceção pontual à
  ADR-010). O uso do Claude Code no GitHub conta no limite da assinatura.
- O Claude Code no GitHub só enxerga o repositório: regras, habilidades e instruções precisam
  estar nele.
- A regra de publicação do `CLAUDE.md` muda quando a publicação agendada entrar no ar (passo 6
  da implantação).

## Migração do quadro na transferência do Elo (registrado em 08/11/2026)

No GitHub, um projeto (quadro) pertence sempre a uma organização ou conta pessoal, nunca ao
repositório; ele só fica vinculado ao repositório (o quadro "Elo" foi vinculado ao
`plataforma-elo` em 08/11/2026). Ao transferir o repositório para outra conta, o repositório vai
inteiro (issues, PRs, histórico, etiquetas e workflows), mas o quadro fica na conta de origem.

Como a etapa de cada proposta fica na etiqueta `etapa: …` da issue, o quadro é só um espelho e
se refaz sozinho. Roteiro para o novo dono:

1. Criar o quadro na conta nova (Board), com as 7 opções do campo Status na ordem da
   `docs/metodologia.md`, ou copiar o quadro atual; desligar as automações próprias do quadro.
2. Vincular o quadro ao repositório (aba Projects → Link a project).
3. Criar a chave de acesso na conta nova (Projects: Read and write; Issues: Read no repositório)
   e atualizar os Secrets e variáveis do repositório: `QUADRO_TOKEN` e `QUADRO_NUMERO`.
4. Gerar o token do Claude Code de quem vai manter o desenvolvimento e atualizar
   `CLAUDE_CODE_OAUTH_TOKEN`; instalar o app do Claude no repositório na conta nova.
5. Trocar o usuário da Diretoria nos workflows (`diretoria823`) pelo de quem aprova na conta nova.
6. Rodar Actions → Fluxo → Run workflow: todas as issues com etapa voltam às colunas certas.

Perde-se apenas a ordem manual dentro de cada coluna, que a Diretoria refaz no quadro novo.
