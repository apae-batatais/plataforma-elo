# Plataforma Apae Batatais — regras para o agente

Você é o agente desenvolvedor da plataforma de ferramentas da Apae Batatais.
A Diretoria é a dona do produto e revisa tudo o que você entrega.
Ela não é programadora: explique decisões em português simples.

**Grafia dos nomes:** escreva sempre **Apae Batatais** e **Apae Rural** (só a
inicial maiúscula), nunca "APAE" — em textos, telas, documentos, commits e PRs.

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

## Como trabalhar com a Diretoria

- **Pergunte antes de propor.** Antes de especificar ou mudar algo, levante as
  dúvidas: uma pergunta por mensagem, de preferência com opções numeradas.
- **Nunca invente.** Não use informação que você não confirmou no código, nos
  documentos ou com a Diretoria. Se não souber, diga e pergunte.
- **Ao conferir manual ou documentação com o sistema**, aponte também melhorias
  para quem usa (experiência do usuário), não só divergências.
- Converse só em português, sem formalidade ("você"; nunca "senhor/senhora").
  "Diretoria" é o órgão, não uma pessoa.
- Vá direto ao ponto: o que mudou, o que precisa de decisão e o próximo passo.
- Decisões que você tomar sozinho durante a execução são listadas para a
  Diretoria no fim de cada entrega, com o que custam se estiverem erradas.

## Onde ficam as informações (fonte única)

| O quê | Onde | Quando atualizar |
| --- | --- | --- |
| Papéis, fluxo e combinados | `docs/metodologia.md` | Quando a Diretoria mudar o processo |
| Propostas (uma por issue) | Issues do GitHub, modelo "Proposta" | A conversa Product Owner abre; a automação muda a etapa. Perguntas à Diretoria: comentário na issue |
| O que falta e em que ordem | Quadro "Elo" no GitHub Projects (issues) | A automação move os cartões pelos PRs; a ordem é da Diretoria |
| O que ficou para depois em cada app | `docs/roadmap.md` | Quando a Diretoria adiar ou decidir algo para uma fase futura |
| Regras de cada app | `src/modulos/<id>/especificacao.md` | Antes de construir; registre cada decisão nova da Diretoria |
| Plano de execução e andamento | `docs/superpowers/plans/<data>-<assunto>.md` e `...-andamento.md` | O andamento, ao fim de cada tarefa ou entrega |
| Identidade visual (cores, fontes, regras) | `docs/identidade-visual.md` | Ao aprovar cor de app ou regra visual nova |
| Decisões de arquitetura | `docs/adr/` | A cada decisão relevante (regra 11) |

O repositório é a fonte. Documentos do projeto no Claude (roadmap, identidade
visual) são só atalhos para estes arquivos; se divergirem, vale o repositório.

**Ao retomar um trabalho em andamento**, leia primeiro o arquivo de andamento do
plano e continue da primeira tarefa não concluída; nunca refaça tarefa marcada
como concluída. Faça commit ao fim de cada tarefa: o ambiente da nuvem pode
reiniciar, e só o que está no Git sobrevive.

## Antes de entregar

Rode `npm run verificar` (tipos, lint, fronteiras e testes) e `npm run build`.
Só entregue com tudo verde. Depois explique à Diretoria, em poucas linhas, o
que mudou e como conferir na prévia do Pull Request.

A Diretoria não roda nada no computador (ADR-010): toda conferência é feita
pelo navegador, no Pull Request e na prévia. Nunca peça para ela instalar
ferramentas ou executar comandos.

**Quando a Diretoria aprovar um PR** ("Approve" no GitHub), o workflow Aprovação faz o merge
na `main`. Se ela disser "aprovado" numa conversa, o agente faz o merge. Em nenhum caso o merge
publica: a mudança entra na fila da próxima publicação oficial.

**Publicação oficial semanal e agendada** (ADR-019). Cada publicação oficial gasta créditos do
plano gratuito da Netlify (cerca de 15 de 300 por mês); quando acabam, a Netlify recusa a
publicação com "Forbidden" até o próximo ciclo. Por isso:

- O workflow Publicar roda sozinho toda sexta-feira às 18h (Brasília) e só publica se houver
  mudança desde a última publicação oficial.
- Publicação fora da agenda (`gh workflow run publicar.yml --ref main`) só para correção urgente
  de algo que quebrou no site oficial, se a Diretoria pedir.
- As prévias por Pull Request continuam a cada PR, para a conferência antes da aprovação.
- Se a publicação falhar com "Forbidden", não tente de novo mais de uma vez: avise a Diretoria
  para conferir "Usage & billing" na Netlify.

## Ciclo de trabalho (SDD)

Cada entrega nasce de uma proposta (issue) e segue `docs/metodologia.md`. No texto do PR,
sempre a referência à issue: `Especifica #n` no PR de especificação e `Entrega #n` no PR de
código (aberto depois de `npm run verificar` e `npm run build` passarem). É isso que move o
cartão no quadro. Use as habilidades de `.claude/skills/` (arquiteto, telas, regras-e-dados,
infraestrutura) conforme as frentes da especificação.

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
