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
- Demonstração e prévias: dados na memória de cada cópia do servidor (a Netlify roda várias). Os
  dados fictícios usam ids previsíveis (`src/nucleo/armazenamento/ids-previsiveis.ts`), iguais em
  todas as cópias; o que se cadastra na demonstração pode sumir no clique seguinte.
- Desenvolvimento só na nuvem (ADR-010): a Diretoria não roda nada no computador.

## Workflows (`.github/workflows/`)

| Workflow | Para quê |
| --- | --- |
| `verificar.yml` | Tipos, lint, fronteiras, testes e build em todo PR e na main (também chamado pela Aprovação depois de cada merge) |
| `publicar.yml` | Prévia em todo PR; versão oficial agendada (sexta, 18h) ou à mão |
| `fluxo.yml` | Etapa da proposta (etiqueta `etapa: …`) e cartão no quadro |
| `claude-arquiteto.yml` | Claude Code especifica quando a proposta é aberta |
| `aprovacao.yml` | "Approve" da Diretoria: confere o tipo do PR, merge, cartão e chamada do Desenvolvedor; "Request changes": ajuste |
| `tipo-do-pr.yml` | Confere a etiqueta "PR: especificação" ou "PR: entrega" com a referência à issue |
| `claude-desenvolvedor.yml` | Claude Code constrói a proposta com especificação aprovada |
| `claude.yml` | Pedido livre com "@claude" num comentário |
| `fila.yml` | Fila de construção (ADR-031): no máximo 3 entregas em construção, sem repetir app quando há alternativa, na ordem do quadro; pausa com a etiqueta `cota: pausa` |
| `atualizar-pr.yml` | Depois de cada merge, confere os PRs de proposta abertos e une com a main os que ficaram em conflito (também à mão, com o número do PR) |
| `vencimentos.yml` | Aviso semanal de chave perto de vencer (`.github/chaves.json`) |

Cuidados:

- **Minutos do Actions** (plano gratuito: 2.000/mês em repositório privado; cada execução é cobrada
  arredondando para cima, no mínimo 1 minuto): job pulado por `if` não gasta; PR só de `.md` não roda
  Verificar nem prévia; no PR o build fica só na prévia; `node_modules` em cache. Ao criar workflow,
  filtre no `if` do job os eventos que não fazem nada.
- **Repositório público desde 17/11/2026 (ADR-032):** Actions sem cota; tudo no repositório,
  issues, PRs, comentários e anexos é público. Gatilho por issue, comentário ou revisão sempre
  confere o autor (`diretoria823` ou automação); PR de fork nunca recebe Secrets.
- **Cota acabou em 16/11/2026** (organização com limite de gasto US$ 0: tudo para até o dia 1º).
  Consumo estimado de 1º a 16/11: Verificar ~580 min, Publicar (prévias) ~390, Desenvolvedor ~350,
  Arquiteto ~150, Atualizar PR ~150; Tipo do PR e Fluxo ~1 min por execução, mas centenas de
  execuções. Regras desde então: trabalho curto filtra no `if` do job tudo o que não muda nada
  (etiqueta que não é de tipo, envio de código no Tipo do PR); agente só instala dependências e
  verifica quando o PR muda código (especificação é só `.md`). Ao criar workflow, estime as
  execuções por dia × 1 minuto antes de ligar; agendamento frequente (ex.: a cada 15 min) não cabe.
- **Raio-x de consumo** (ADR-031): `node .github/scripts/consumo.mjs execucoes.json` com as execuções do mês
  dá o gasto estimado por automação e a faixa (normal, aviso acima de 70%, pausa acima de 85%). Na
  pausa, abra uma "pendência da Diretoria" com a etiqueta `cota: pausa`; com o "pode seguir", feche-a
  e rode a Fila.
- Ações feitas com o `GITHUB_TOKEN` não disparam outros workflows (exceto `workflow_dispatch`).
  Quem precisa encadear passos chama o próximo direto (veja `aprovacao.yml`).
- Funções dos workflows ficam em `.github/scripts/` (`fluxo-quadro.mjs`, `vencimento-chaves.mjs`, `agentes.mjs`, `fila.mjs`, `consumo.mjs`), com teste em `tests/fluxo/`.
- **Falha de agente é assunto do DevOps, nunca da Diretoria.** Todo workflow que roda o Claude Code
  termina com o passo "Marcar a falha" (`if: failure()`), que põe a etiqueta "falha de agente" na
  issue ou no PR, sem comentar. Workflow de agente novo leva o mesmo passo. No raio-x, o DevOps
  procura essa etiqueta, lê o registro, roda de novo a execução que falhou (re-run dos jobs que
  falharam) ou corrige, e tira a etiqueta. Só leva à Diretoria o que for prioridade, escopo ou custo
  (ou falta de crédito, permissão ou chave, que só ela resolve).
- **Merge recusado depois do "Approve"** (conflito ou outro motivo técnico): a Aprovação chama a
  atualização ou marca "falha de agente"; o DevOps conclui o merge, porque a aprovação já foi dada.

## Secrets e variáveis (nomes; os valores você nunca recebe nem pede)

| Nome | Tipo | Para quê |
| --- | --- | --- |
| `QUADRO_TOKEN` | Secret | Quadro do GitHub Projects |
| `CLAUDE_CODE_OAUTH_TOKEN` | Secret | Claude Code no GitHub (token da assinatura; vale um ano) |
| `NETLIFY_AUTH_TOKEN` | Secret | Publicação na Netlify |
| `NETLIFY_SITE_ID` | Secret | Publicação na Netlify (identificador do site; não vence) |
| `ROTINA_URL` | Secret | Endereço do site oficial, para a rotina agendada chamar (ADR-027; não vence) |
| `ROTINA_TOKEN` | Secret | Chave da rotina agendada (ADR-027; a mesma também vale como variável de ambiente na Netlify) |
| `META_APP_SECRET` | Secret | Segredo do app da Meta, para o Instagram automático (ADR-028; variável de ambiente na Netlify) |
| `ELO_CHAVE_CREDENCIAIS` | Secret | Cifra as credenciais do Instagram por instituição (ADR-028; variável de ambiente na Netlify; trocar invalida as credenciais já guardadas) |
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
