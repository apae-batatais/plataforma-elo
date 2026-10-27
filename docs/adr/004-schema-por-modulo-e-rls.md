# ADR-004 · Schema por módulo e Row Level Security

- Situação: substituída pela ADR-011
- Data: 2026-10-25

## Contexto
Um erro em uma tela não pode expor dados de atendidos a quem não deve vê-los.

## Decisão
- Cada módulo tem seu schema (`core`, `orcamento`, `avaliacao`, ...).
- Todas as tabelas têm Row Level Security. As políticas usam
  `core.tem_permissao(permissao, escopo_tipo, escopo_id)` e
  `core.pode_ver_pessoa(pessoa_id)`.
- O servidor executa as consultas de usuários em `comoUsuario(...)`, que troca
  o papel para `authenticated` e informa o id do usuário ao banco.
- Não existem políticas de DELETE: nada é apagado.

## Consequências
- O controle de acesso vale mesmo que a tela esteja errada.
- Toda tabela nova precisa de teste de acesso (quem vê, quem altera).
