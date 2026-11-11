---
name: telas
description: Regras de interface do Elo (identidade visual, acessibilidade, componentes e textos). Use ao criar ou alterar qualquer tela, componente, gráfico ou texto que a pessoa vê.
---

# Telas do Elo

A fonte das regras visuais é `docs/identidade-visual.md`. Leia antes de mexer em tela. Resumo do
que mais pesa:

## Estrutura

- Toda tela tem menu lateral, barra no topo e conteúdo em cartões (`src/ui/casca.tsx`,
  `src/ui/pagina.tsx`). Telas dos apps ficam em `src/modulos/<id>/telas/` e as rotas em
  `src/app/(elo)/`.
- Reaproveite os componentes de `src/ui/` (botão, campo, aviso, janela, confirmar, tabela de dados,
  gráficos, ícones, notificação). Componente novo só se nenhum servir, e fica em `src/ui/` se for
  geral.
- A cor do app vem de `src/ui/cor-do-app.ts`. O botão principal é sempre grafite.

## Cores e temas

- Tema claro e escuro, com as mesmas regras. Use as variáveis de `src/app/globals.css`; nada de cor
  solta no componente.
- Verde, vermelho e âmbar são só para alertas. A cor do app nunca aparece sozinha: sempre com nome
  ou ícone.

## Acessibilidade (obrigatório)

- Fonte Atkinson Hyperlegible Next, embutida. Corpo em 16 px; textos de gráfico em 14 px no mínimo.
- Contraste de 4,5:1 para texto e 3:1 para ícones e bordas, nos dois temas.
- Nenhuma informação só por cor: alerta tem ícone e texto.
- Tudo funciona pelo teclado, com o foco visível. Áreas de clique com pelo menos 44 px de altura.
- Quem pediu menos movimento vê tudo sem animação.

## Textos

- Português, curtos, do ponto de vista de quem usa: "Aprovar requisição", não "Enviar".
- Frases em caixa normal; nada de rótulo em caixa alta.
- Números grandes só para o que pede ação, sempre com a frase do que significam.
- Listas longas mostram as primeiras linhas e "Mostrar todas". Filtros em pílulas.

## Sem internet

Nada de fonte, biblioteca ou ícone de CDN. Ícones e gráficos em SVG no próprio código.

## Conferir

Rode a demonstração (`npm run dev`) e confira a tela nos dois temas, pelo teclado e em largura de
celular. No PR, descreva o roteiro de conferência na prévia.

## Sem nomes próprios (decisão da Diretoria, 11/11/2026)

Textos de tela, dicas, exemplos, mensagens, dados fictícios, manual e comentários de código nunca citam nome
de instituição, unidade, marca ou cidade reais. Use "instituição", "nome da instituição", "OSC", "Sede".
O teste `tests/nucleo/sem-nomes-proprios.test.ts` barra "Apae", "Batatais", "Franca" e "Rural" em `src/`.
