# ADR-009 · Migrações em SQL; Drizzle só para consultas tipadas

- Situação: substituída pela ADR-011
- Data: 2026-10-25
- Ajusta a especificação v1, que previa migrações geradas pelo Drizzle.

## Contexto
Boa parte da segurança mora no banco: políticas de RLS, funções de permissão,
gatilhos de auditoria e de eventos. Isso só se expressa em SQL.

## Decisão
- `supabase/migrations/*.sql` é a fonte da verdade do banco, aplicada pela CLI
  do Supabase em produção e automaticamente no modo local e nos testes.
- `src/nucleo/db/schema.ts` (e o equivalente de cada módulo) espelha as tabelas
  para dar tipos às consultas.
- O teste `schema-espelho` falha se o espelho divergir do banco.

## Consequências
- Toda mudança de banco é um arquivo SQL legível e revisável.
- Quem muda uma migração atualiza o espelho no mesmo commit.
