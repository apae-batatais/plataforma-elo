# ADR-003 · Supabase gerenciado em região no Brasil

- Situação: aceita
- Data: 2026-10-25

## Contexto
Não há equipe de TI para administrar servidores, backups e atualizações.
Os dados incluem informações sensíveis de saúde e deficiência (LGPD).

## Decisão
Banco Postgres, login e armazenamento de arquivos no Supabase, em região no
Brasil, com conta em nome da instituição e dois administradores.
Antes de entrar dado real de atendidos, contratar plano com backups diários.

## Consequências
- Nenhum servidor para administrar.
- Row Level Security, login e Storage prontos.
- Enquanto a conta não existe, a plataforma roda em modo local com um
  Postgres embutido (PGlite) e dados fictícios.
