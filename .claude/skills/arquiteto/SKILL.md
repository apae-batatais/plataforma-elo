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
  Aponte melhorias de experiência de uso.
- **Fica de fora**: o que não entra nesta entrega.
- **Frentes**: `telas`, `regras e dados`, `infraestrutura` (as que se aplicam). O Desenvolvedor usa
  as habilidades dessas frentes.
- **Entregas**: proposta grande é dividida em entregas pequenas, cada uma conferível na prévia.
  Se forem muitas, sugira abrir uma issue por entrega.
- **Critérios de pronto**: como a Diretoria confere na prévia.

## Limites

- Núcleo, capacidades ou outro módulo só mudam se a proposta pedir; deixe isso explícito.
- Nada de código de produção no PR de especificação.
- Nunca use dados reais nem peça credenciais.
