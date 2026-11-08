---
name: infraestrutura
description: Hospedagem, publicação, automações do GitHub e integrações com o Google no Elo. Use ao mexer em workflows, publicação na Netlify, Secrets, permissões do Google ou em qualquer decisão de infraestrutura.
---

# Infraestrutura do Elo

## Onde roda

- Next.js na Netlify (ADR-011, ADR-017). Plano gratuito: cerca de 15 de 300 créditos por
  publicação oficial; por isso a publicação oficial é semanal e agendada (ADR-019).
- Dados no Google Planilhas e anexos no Google Drive, por conta de serviço (ADR-011, ADR-014,
  ADR-018). Migração para Postgres só depois de cerca de 5 clientes (ADR-017).
- Desenvolvimento só na nuvem (ADR-010): a Diretoria não roda nada no computador.

## Workflows (`.github/workflows/`)

| Workflow | Para quê |
| --- | --- |
| `verificar.yml` | Tipos, lint, fronteiras, testes e build em todo PR e na main |
| `publicar.yml` | Prévia em todo PR; versão oficial agendada (sexta, 18h) ou à mão |
| `fluxo.yml` | Etapa da proposta (etiqueta `etapa: …`) e cartão no quadro |
| `claude-arquiteto.yml` | Claude Code especifica quando a proposta é aberta |
| `aprovacao.yml` | "Approve" da Diretoria: merge, cartão e chamada do Desenvolvedor; "Request changes": ajuste |
| `claude-desenvolvedor.yml` | Claude Code constrói a proposta com especificação aprovada |
| `claude.yml` | Pedido livre com "@claude" num comentário |

Cuidados:

- Ações feitas com o `GITHUB_TOKEN` não disparam outros workflows (exceto `workflow_dispatch`).
  Quem precisa encadear passos chama o próximo direto (veja `aprovacao.yml`).
- Funções do fluxo ficam em `.github/scripts/fluxo-quadro.mjs`, com teste em `tests/fluxo/`.

## Secrets e variáveis (nomes; os valores você nunca recebe nem pede)

- `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`: publicação.
- `QUADRO_TOKEN` (Secret) e `QUADRO_NUMERO` (Variable): quadro do GitHub Projects.
- `CLAUDE_CODE_OAUTH_TOKEN`: Claude Code no GitHub (token da assinatura).
- Credenciais do Google: só na Netlify.

## Regras

- Mudança de hospedagem, armazenamento, segurança ou integração é ADR nova.
- Mudança em workflow é testada no que der (função pura com teste) e explicada no PR com o
  risco se der errado.
- Nunca enfraqueça verificação, publicação ou permissões para "fazer passar".
