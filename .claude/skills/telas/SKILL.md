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
- Reaproveite os componentes de `src/ui/` (tabela abaixo). Componente novo só se nenhum servir, e
  fica em `src/ui/` se for geral; isso mexe no Núcleo e precisa estar na especificação.
- A cor do app vem de `src/ui/cor-do-app.ts`. O botão principal é sempre grafite.

## Peças prontas (`src/ui/`)

| Situação | Use |
| --- | --- |
| Cabeçalho da página: trilha, título, descrição e ações à direita | `CabecalhoPagina`, `Secao` (`pagina.tsx`) |
| Lista ou área sem nada ainda | `EstadoVazio` (`pagina.tsx`), com a frase do que fazer e a ação |
| Situação de um registro (aprovado, vencido…) | `Etiqueta` (`pagina.tsx`), com texto, nunca só cor |
| Formulário | `Campo` (`campo.tsx`): rótulo sempre visível, dica abaixo, marca de obrigatório |
| Botão que grava | `BotaoEnviar` (`botao-enviar.tsx`): mostra que está gravando |
| Escolha que salva sozinha | `SelecaoAutomatica` (`selecao-automatica.tsx`) |
| Editar em janela | `Janela` (`janela.tsx`) |
| Ação sem volta (desativar, retirar, desligar) | `FormularioConfirmado` (`confirmar.tsx`), explicando a consequência |
| Confirmação de que gravou | `?ok=` no endereço, que `Notificacao` (`notificacao.tsx`) mostra em verde e some sozinha; erro (`?erro=`) fica até a pessoa agir |
| Aviso dentro da página | `Aviso` (`aviso.tsx`): ícone e texto do que aconteceu e do que fazer |
| Tabela grande, com filtro e classificação | `TabelaDados` (`tabela-dados.tsx`) |
| Registros encerrados, com "Reativar" | `Excluidos` (`excluidos.tsx`) |
| Ano (exercício) | `SeletorAno` (`seletor-ano.tsx`), controle segmentado igual em todas as telas |
| Gráficos e números de destaque | `graficos.tsx` (veja "Gráficos") |
| Ícones | `icones.tsx`, em SVG; ícone novo entra lá, com o mesmo traço |

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

## Gráficos

- Use `graficos.tsx` (`Linhas`, `BarrasAgrupadas`, `BarrasHorizontais`, `Barras100`,
  `Indicadores`, `ResultadoMensal`), preenchendo `descricao` (o que o gráfico mostra, para leitor de
  tela) onde o componente aceita, e o formato dos valores.
- Uma série só: na cor do app (`naCorDoApp`). Várias séries: as quatro cores fixas testadas para
  daltonismo, sempre com legenda. Sobra e falta: azul e vermelho, com a situação escrita.
- Nas análises, o título do cartão já é a conclusão ("Folha passou do previsto em março"), com o
  gráfico à esquerda e a leitura à direita: o número grande e o que fazer.

## Movimento

O movimento mostra o que importa, nunca enfeita. Tudo entre 0,2 e 0,6 segundo; com "menos
movimento" no computador, nada anima (a regra já está em `src/app/globals.css`).

| Momento | Efeito (`docs/identidade-visual.md`, "Efeitos de acabamento") |
| --- | --- |
| Abrir a tela | Números grandes sobem de zero até o valor |
| Tela inicial | Cartões dos apps entram em sequência; app com pendência vencida ganha anel que pulsa devagar |
| Passar o mouse | Cartão ganha brilho leve na borda, na cor do app; ícones e botões mostram dica com o nome da ação |
| Entrar num app, trocar de tema | Cores esmaecem em vez de piscar (já pronto em `globals.css`) |
| Janela de detalhe | Desliza por cima, com o fundo escurecido e desfocado |
| Gravou | Confirmação em verde (`Notificacao`) e o que mudou pisca uma vez |
| Trocar de aba ou filtro | Conteúdo esmaece; pontos do gráfico vão até a nova posição |

Peças prontas em `src/ui/` (proposta #109): **`NumeroQueConta`** (número grande que sobe; passe o texto
já formatado, com `chave` para também piscar ao gravar), **`PiscaOndeMudou`** (envolva o que uma
gravação altera, com `chave` estável = id do registro, nunca nome; `TabelaDados` já pisca as linhas),
classe **`cartao-brilho`** (cartão clicável como um todo) e classe **`anel-pulsante`** (só o cartão de
app da tela inicial com pendência vencida, sempre com a `Etiqueta` de texto). Não crie versão própria
dentro do app. Número que muda a cada tecla (índice ao vivo de formulário) não conta. Ainda sem peça:
grade que acende em sequência, janela que desliza com fundo desfocado, esmaecer ao trocar aba ou
filtro e dicas em ícones; avise no PR de entrega se a tela precisar de um deles.

## Textos

- Português, curtos, do ponto de vista de quem usa: "Aprovar requisição", não "Enviar".
- Frases em caixa normal; nada de rótulo em caixa alta.
- Números grandes só para o que pede ação, sempre com a frase do que significam.
- Listas longas mostram as primeiras linhas e "Mostrar todas". Filtros em pílulas (a escolhida na
  cor do app); abas em controle segmentado.
- Lista vazia não fica em branco: `EstadoVazio` diz por que está vazia e o que fazer.

## Sem internet

Nada de fonte, biblioteca ou ícone de CDN. Ícones e gráficos em SVG no próprio código.

## Conferir

Antes do PR, confira (na demonstração, `npm run dev`, e no código):

- [ ] Tema claro e escuro, só com as variáveis do tema (nenhuma cor solta).
- [ ] Tudo pelo teclado, com o foco visível; áreas de clique com 44 px de altura.
- [ ] Largura de celular: nada corta nem passa da largura da tela.
- [ ] Toda cor de alerta ou de app vem com ícone ou texto.
- [ ] Estados: vazio (`EstadoVazio`), gravando (`BotaoEnviar`), gravou (`?ok=`) e erro (`?erro=` ou `Aviso`).
- [ ] Movimento dentro de 0,2 a 0,6 s e nada animado com "menos movimento".
- [ ] Textos do ponto de vista de quem usa, sem caixa alta e sem nome próprio (o teste
      `tests/nucleo/sem-nomes-proprios.test.ts` confere).

No PR, descreva o roteiro de conferência na prévia: onde clicar e o que a Diretoria deve ver.

## Sem nomes próprios (decisão da Diretoria, 11/11/2026)

Textos de tela, dicas, exemplos, mensagens, dados fictícios, manual e comentários de código nunca citam nome
de instituição, unidade, marca ou cidade reais. Use "instituição", "nome da instituição", "OSC", "Sede".
O teste `tests/nucleo/sem-nomes-proprios.test.ts` barra "Apae", "Batatais", "Franca" e "Rural" em `src/`.
