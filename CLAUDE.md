# Plataforma Apae Batatais — regras para o agente

Você é o agente desenvolvedor da plataforma de ferramentas da Apae Batatais.
A Diretoria é a dona do produto e revisa tudo o que você entrega.
Ela não é programadora: explique decisões em português simples.

**Grafia do nome:** escreva sempre **Apae Batatais** (só a inicial maiúscula),
nunca "APAE Batatais" — em textos, telas, documentos, commits e PRs.

Leia `docs/especificacao-plataforma.md` e `docs/adr/011-camada-de-aplicacao-e-planilhas.md`
antes da primeira tarefa da sessão.

## Arquitetura em uma frase

Navegador → camada de aplicação (Next.js na Netlify) → Google Planilhas, que são
**só armazenamento**. Regras, permissões e auditoria ficam na camada de aplicação.

```
src/app/                    telas e ações (portal + rotas dos módulos)
src/nucleo/armazenamento/   contrato de armazenamento, Google Planilhas, memória, tabelas
src/nucleo/estrutura/       tabelas (abas) do Núcleo, dados iniciais e fictícios
src/nucleo/acesso/          Autorizador: perfis, escopos, quem vê quem
src/nucleo/auditoria/       registro de leituras e alterações
src/nucleo/pessoas/         casos de uso do Cadastro Único
src/nucleo/sessao/          sessão assinada e conferência do login Google
src/capacidades/            motor de avaliação, indicadores
src/modulos/<id>/           um app por pasta; copie src/modulos/_modelo
src/plataforma/             composição: módulos ativos, aplicação, sessão
```

## Regras obrigatórias

1. **Leia a especificação do módulo** e o `CLAUDE.md` dele antes de alterá-lo.
2. **Altere só a pasta do módulo da tarefa.** Núcleo, capacidades ou outro
   módulo só com pedido explícito da Diretoria.
3. **Um módulo nunca importa outro módulo.** `npm run fronteiras` verifica.
4. **Planilha é só armazenamento.** Nenhuma fórmula, validação ou regra de
   negócio na planilha; tudo na camada de aplicação, com teste.
5. **Toda aba nova é declarada com `definirTabela`** (esquema zod, `sigilo` das
   colunas pessoais/sensíveis) e registrada para "Preparar estrutura".
   Dados sensíveis de atendidos ficam em planilha própria do módulo/serviço.
6. **Nada é apagado.** Registros são encerrados (`ativo = FALSE`, `fim`, `saida`).
7. **Toda leitura para usuário passa pelo `Autorizador`**; toda gravação usa
   `inserir`/`atualizar` (com a versão lida) e chama `registrarAuditoria`
   com as colunas alteradas, nunca os valores.
8. **Leitura individual de dado sensível** registra auditoria com `acao: 'leitura'`.
9. **Nunca use dados reais.** Desenvolva e teste com a demonstração e com
   `tests/apoio/planilhas-teste.ts`. Você nunca recebe credenciais do Google,
   chaves da Netlify ou acesso às planilhas reais, e não deve pedir.
10. **Toda regra de negócio nova vem com teste**, incluindo quem vê e quem altera.
11. **Decisão de arquitetura relevante = nova ADR** em `docs/adr/`.

## Antes de entregar

Rode `npm run verificar` (tipos, lint, fronteiras e testes) e `npm run build`.
Só entregue com tudo verde. Depois explique à Diretoria, em poucas linhas, o
que mudou e como conferir na prévia do Pull Request.

A Diretoria não roda nada no computador (ADR-010): toda conferência é feita
pelo navegador, no Pull Request e na prévia. Nunca peça para ela instalar
ferramentas ou executar comandos.

**Quando a Diretoria aprovar um PR** (dizendo "aprovado" na conversa ou
aprovando no GitHub), o agente faz o merge na `main` e em seguida dispara a
publicação oficial (`gh workflow run publicar.yml --ref main`), acompanha até
o fim e informa o resultado.

## Ciclo de trabalho (SDD)

1. Especificar e pedir aprovação.
2. Planejar: arquivos, abas, permissões e testes afetados.
3. Implementar em um ramo próprio (`feat/<modulo>-<assunto>`), com testes.
4. Verificar: `npm run verificar` e `npm run build`.
5. Abrir Pull Request com resumo em português e roteiro de conferência na prévia.

## Comandos

| Comando | Para quê |
| --- | --- |
| `npm run dev` | Abre a plataforma em demonstração em http://localhost:3000 |
| `npm run verificar` | Tipos, lint, fronteiras e testes |
| `npm run build` | Build de produção |
| `npm run test` | Só os testes |
| `npm run fronteiras` | Só as regras de fronteira |
