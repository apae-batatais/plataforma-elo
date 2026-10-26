# ADR-008 · Agente sem acesso a dados de produção

- Situação: aceita
- Data: 2026-10-25

## Contexto
A plataforma guarda dados sensíveis de pessoas com deficiência, inclusive
crianças e adolescentes. O desenvolvimento é feito com um agente de IA.

## Decisão
- O agente trabalha só com dados fictícios (`npm run dados:ficticios`).
- O script de dados fictícios se recusa a rodar se `DATABASE_URL` estiver definida.
- Chaves e senhas de produção ficam apenas no Supabase, no Render e nos Secrets do GitHub, nunca no
  repositório nem na máquina de desenvolvimento.

## Consequências
- Problemas de produção são investigados por relatórios agregados e pela
  auditoria, não por cópia de dados.
