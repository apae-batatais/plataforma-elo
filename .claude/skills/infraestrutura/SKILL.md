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
| `aprovacao.yml` | "Approve" da Diretoria: confere o tipo do PR, merge, cartão e chamada do Desenvolvedor; "Request changes": ajuste |
| `tipo-do-pr.yml` | Confere a etiqueta "PR: especificação" ou "PR: entrega" com a referência à issue |
| `claude-desenvolvedor.yml` | Claude Code constrói a proposta com especificação aprovada |
| `claude.yml` | Pedido livre com "@claude" num comentário |
| `vencimentos.yml` | Aviso semanal de chave perto de vencer (`.github/chaves.json`) |

Cuidados:

- Ações feitas com o `GITHUB_TOKEN` não disparam outros workflows (exceto `workflow_dispatch`).
  Quem precisa encadear passos chama o próximo direto (veja `aprovacao.yml`).
- Funções dos workflows ficam em `.github/scripts/` (`fluxo-quadro.mjs`, `vencimento-chaves.mjs`), com teste em `tests/fluxo/`.

## Secrets e variáveis (nomes; os valores você nunca recebe nem pede)

| Nome | Tipo | Para quê |
| --- | --- | --- |
| `QUADRO_TOKEN` | Secret | Quadro do GitHub Projects |
| `CLAUDE_CODE_OAUTH_TOKEN` | Secret | Claude Code no GitHub (token da assinatura; vale um ano) |
| `NETLIFY_AUTH_TOKEN` | Secret | Publicação na Netlify |
| `NETLIFY_SITE_ID` | Secret | Publicação na Netlify (identificador do site; não vence) |
| `QUADRO_NUMERO` | Variable | Número do quadro "Elo" (não vence) |

- Credenciais do Google: só na Netlify.
- **Vencimentos: `.github/chaves.json`** (fonte única; datas informadas pela Diretoria, nunca
  valores). Toda segunda às 9h o workflow `vencimentos.yml` abre uma issue "pendência da
  Diretoria" para cada chave que vence em até 30 dias. Ao renovar, atualize a data no arquivo.
- Chave vencida faz o workflow falhar por falta de acesso: não rode de novo, peça a renovação.

## Regras

- Mudança de hospedagem, armazenamento, segurança ou integração é ADR nova.
- Mudança em workflow é testada no que der (função pura com teste) e explicada no PR com o
  risco se der errado.
- Nunca enfraqueça verificação, publicação ou permissões para "fazer passar".
