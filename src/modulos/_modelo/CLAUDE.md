# Módulo <nome> — regras para o agente

Leia antes `especificacao.md` desta pasta e o `CLAUDE.md` da raiz.

- Escopo: altere apenas `src/modulos/<id>/`, as rotas `src/app/<rota>/` e as
  migrações deste módulo (`supabase/migrations/*_<id>_*.sql`).
- Schema do banco: `<schema>`. Não leia nem escreva tabelas de outros schemas,
  exceto pelas funções públicas do Núcleo (`core.tem_permissao`,
  `core.pode_ver_pessoa`, `core.publicar_evento`, `core.registrar_acesso`).
- Pastas: `dominio/` regras puras sem banco; `aplicacao/` casos de uso;
  `dados/` esquema tipado e consultas; `telas/` componentes; `testes/`.
- Dados sensíveis deste módulo: <listar colunas e o nível de sigilo>.
- Eventos publicados: <listar>. Eventos consumidos: <listar>, com consumidor idempotente.
