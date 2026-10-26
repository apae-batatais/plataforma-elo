# Plataforma APAE Batatais — regras para o agente

Você é o agente desenvolvedor da plataforma de ferramentas da APAE Batatais.
A Diretoria é a dona do produto e revisa tudo o que você entrega.
Ela não é programadora: explique decisões em português simples.

Leia `docs/especificacao-plataforma.md` antes da primeira tarefa da sessão.

## Arquitetura em uma frase

Monólito modular: um app Next.js, um banco Postgres (Supabase), e módulos
(apps por departamento) com fronteiras rígidas sobre um Núcleo comum.

```
src/app/          rotas e telas (portal + rotas dos módulos)
src/nucleo/       identidade, pessoas, organização, auditoria, eventos, db
src/capacidades/  motor de avaliação, indicadores (usados por vários módulos)
src/modulos/<id>/ um app por pasta; copie src/modulos/_modelo para começar
src/plataforma/   composição: a lista de módulos ativos
src/ui/           componentes visuais genéricos
supabase/migrations/  fonte da verdade do banco (SQL)
```

## Regras obrigatórias

1. **Leia a especificação do módulo** (`src/modulos/<id>/especificacao.md`) e o
   `CLAUDE.md` dele antes de alterar qualquer arquivo do módulo.
2. **Altere só a pasta do módulo da tarefa.** Mudança no Núcleo, em
   capacidades ou em outro módulo exige pedido explícito da Diretoria.
3. **Um módulo nunca importa outro módulo.** Use eventos de domínio
   (`core.publicar_evento`) ou a interface do Núcleo. `npm run fronteiras` verifica.
4. **Todo módulo tem schema próprio no banco** e não lê tabelas de outro módulo.
5. **Toda tabela nova** tem Row Level Security ligada, políticas de leitura e
   escrita usando `core.tem_permissao(...)`, carimbos (`criado_em`, `criado_por`,
   `atualizado_em`, `atualizado_por`), gatilhos `carimbo` e `auditar`, e cada
   coluna pessoal ou sensível comentada com `sigilo:pessoal` ou `sigilo:sensivel`.
6. **Nada é apagado.** Não crie política de DELETE; registros são encerrados
   (`fim`, `saida`, `ativo = false`) com data e motivo.
7. **Consultas para usuários rodam em `comoUsuario(...)`**, nunca direto no banco.
   `comoSistema(...)` é só para rotinas internas.
8. **Leitura individual de dado sensível** chama `core.registrar_acesso('leitura', ...)`.
9. **Nunca use dados reais.** Use `npm run dados:ficticios`. Você nunca recebe
   chaves, senhas ou acesso ao banco de produção, e não deve pedir.
10. **Toda regra de negócio nova vem com teste.** Teste de acesso (quem vê,
    quem altera) é obrigatório para toda tabela nova.
11. **Migração nova = arquivo novo** em `supabase/migrations/` com prefixo de
    data e hora. Nunca edite uma migração que já foi para produção.
    Atualize o esquema tipado e rode `npm run migracoes:gerar` no mesmo commit
    (os testes `schema-espelho` e `demonstracao` conferem).
12. **Decisão de arquitetura relevante = nova ADR** em `docs/adr/`.

## Antes de entregar

Rode `npm run verificar` (tipos, lint, fronteiras e testes). Só entregue com
tudo verde. Depois explique à Diretoria, em poucas linhas, o que mudou e como
conferir na prévia.

A Diretoria não roda nada no computador (ADR-010): toda conferência é feita
pelo navegador, no Pull Request e na prévia. Nunca peça para ela instalar
ferramentas ou executar comandos.

## Ciclo de trabalho (SDD)

1. Especificar: escreva ou atualize a especificação da funcionalidade e peça aprovação.
2. Planejar: liste arquivos, tabelas, permissões e testes afetados.
3. Implementar em um ramo próprio (`feat/<modulo>-<assunto>`), com testes.
4. Verificar: `npm run verificar`.
5. Abrir Pull Request com resumo em português e roteiro de conferência na prévia.

## Comandos

| Comando | Para quê |
| --- | --- |
| `npm run dados:ficticios` | Recria o banco local com dados fictícios |
| `npm run dev` | Abre a plataforma em http://localhost:3000 |
| `npm run verificar` | Tipos, lint, fronteiras e testes |
| `npm run test` | Só os testes |
| `npm run fronteiras` | Só as regras de fronteira |
| `npm run migracoes:gerar` | Copia as migrações para o código (obrigatório após mudar uma migração) |
| `npm run demonstracao:preparar` | Aplica migrações e dados fictícios no banco de demonstração (roda no GitHub Actions) |
