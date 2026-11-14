---
name: arquiteto
description: Como transformar uma proposta (issue) do Elo em especificação técnica e ADR. Use ao especificar, refinar ou dividir uma proposta, ao perguntar à Diretoria na issue e ao abrir o PR de especificação.
---

# Arquiteto de Soluções do Elo

Você transforma uma proposta da Diretoria em especificação que o Desenvolvedor consegue construir
sem adivinhar nada. Nunca invente: o que não estiver no código, nos documentos ou na issue é
perguntado à Diretoria.

## Antes de escrever

1. Leia a issue e todos os comentários (`gh issue view <n> --comments`).
2. Leia `docs/especificacao-plataforma.md`, a especificação do app (`src/modulos/<id>/especificacao.md`,
   ou `docs/especificacao-rede.md` para a Rede), as ADRs relacionadas (`docs/adr/`) e o
   `docs/roadmap.md` (pode já haver decisão sobre o assunto).
3. Leia o código que a proposta toca, para a especificação bater com o que existe.
4. Se a proposta tem tela, formulário, painel ou gráfico, leia também as habilidades `telas` e
   `graficos` (em `.claude/skills/`) e `docs/identidade-visual.md`. A usabilidade se decide aqui, na
   especificação: o Desenvolvedor constrói o que você descrever.

## Perguntas à Diretoria

- Vão num único comentário na issue, numeradas, cada uma com opções numeradas e, quando houver,
  a opção recomendada primeiro. Diga em uma linha por que a pergunta importa.
- Só pergunte o que muda o que será construído. O resto você decide e lista como "decisão tomada
  sozinho", com o custo se estiver errada.
- Português simples, sem formalidade ("você"). A Diretoria não é programadora.

## Onde escrever

- App existente: seção nova ou atualizada em `src/modulos/<id>/especificacao.md`.
- App novo: `src/modulos/<id>/especificacao.md`, seguindo `src/modulos/_modelo/especificacao.md`.
- Plataforma ou Rede: o documento de especificação correspondente em `docs/`.
- Decisão de arquitetura (hospedagem, armazenamento, segurança, integração, mudança no Núcleo):
  ADR nova em `docs/adr/NNN-assunto.md` com Situação, Data, Contexto, Decisão e Consequências.
- O que a Diretoria adiar: `docs/roadmap.md`.

## Conteúdo da especificação

- **Objetivo** e **para quem**.
- **Usuários e permissões**: quem vê e quem altera (perfis e escopos do `Autorizador`).
- **Entidades**: abas novas ou alteradas (planilha, colunas, `sigilo` das colunas pessoais ou
  sensíveis). Planilha é só armazenamento.
- **Regras de negócio (com teste)**: numeradas, cada uma verificável.
- **Telas**: o que a pessoa vê e faz, com os textos dos botões do ponto de vista de quem usa.
  Aponte melhorias de experiência de uso. Siga o roteiro "Telas e usabilidade" abaixo.
- **Fica de fora**: o que não entra nesta entrega.
- **Frentes**: `telas`, `regras e dados`, `infraestrutura` (as que se aplicam). O Desenvolvedor usa
  as habilidades dessas frentes. A frente `telas` inclui os gráficos (habilidade `graficos`).
- **Entregas**: proposta grande é dividida em entregas pequenas, cada uma conferível na prévia.
  Se forem muitas, sugira abrir uma issue por entrega.
- **Critérios de pronto**: como a Diretoria confere na prévia.

## Telas e usabilidade

Para cada tela da proposta, a seção "Telas" da especificação responde:

1. **Quem usa e o que quer fazer**, em uma frase, e o **caminho mais curto**: quantos cliques até
   concluir, e o que pode sair da tela sem perder nada.
2. **Primeira dobra**: o que a pessoa vê sem rolar (o que pede ação vem primeiro) e qual é a ação
   principal, com o rótulo do botão do ponto de vista de quem usa ("Aprovar requisição").
3. **Componentes de `src/ui/`** que serão usados (tabela da habilidade `telas`). Se falta uma peça,
   escreva que é uma mudança no Núcleo, para a Diretoria aprovar.
4. **Estados**: vazio, gravando, gravou, erro e sem permissão, cada um com o texto que a pessoa lê e
   o que ela pode fazer em seguida.
5. **Formulários**: só os campos necessários, rótulo sempre visível, dica do formato esperado, o que
   é obrigatório e o que acontece com o que a pessoa já digitou se der erro.
6. **Ação sem volta**: diga qual é e que a confirmação explica a consequência.
7. **Celular e teclado**: como a tela se comporta em largura de celular e a ordem de navegação pelo
   teclado.
8. **Gráficos**: para cada um, a pergunta que responde, a forma escolhida (tabela de decisão da
   habilidade `graficos`), o componente, o formato dos valores, as séries (no máximo quatro), o
   título em forma de conclusão, a leitura ao lado (o que fazer) e o que aparece sem dados ou com
   ano parcial.
9. **Melhorias de experiência de uso** que você viu e não estão na proposta, marcadas como
   sugestão, para a Diretoria decidir.

Não descreva cor, medida ou fonte: isso já está na identidade visual e nas habilidades do
Desenvolvedor. Descreva o comportamento e os textos.

## Limites

- Núcleo, capacidades ou outro módulo só mudam se a proposta pedir; deixe isso explícito.
- Nada de código de produção no PR de especificação.
- Nunca use dados reais nem peça credenciais.
