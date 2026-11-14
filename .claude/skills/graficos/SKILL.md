---
name: graficos
description: Como escolher e montar gráficos, indicadores e números de destaque no Elo, com os componentes de src/ui/graficos.tsx. Use ao especificar ou construir qualquer gráfico, painel de análise ou indicador.
---

# Gráficos do Elo

Gráfico serve para a pessoa decidir ou agir, não para enfeitar. Cada gráfico responde a **uma
pergunta**, escrita como conclusão no título do cartão ("Folha passou do previsto em março").
Regras visuais gerais: habilidade `telas` e `docs/identidade-visual.md` (seção "Gráficos"). Aqui
ficam a escolha da forma e o uso dos componentes de `src/ui/graficos.tsx`.

## 1. Escolha a forma antes de pensar em cor

| O dado é… | Use | Não use |
| --- | --- | --- |
| Um valor só (o total, o saldo, "quantos vencidos") | Número grande (`NumeroQueConta`) com a frase do que significa | Gráfico de uma barra só |
| Um percentual contra um limite ou meta | `Indicadores` (barra de 0 a 100% com a referência tracejada) | Rosca ou ponteiro |
| Evolução ao longo do tempo (meses, anos) | `Linhas` | Barras, se são muitos pontos |
| Comparar poucos períodos ou grupos lado a lado | `BarrasAgrupadas` | Linhas, se são poucos pontos |
| Ordenar ou comparar categorias com nomes longos (serviços, fontes, áreas) | `BarrasHorizontais`, maior primeiro (categoria com ordem natural, como faixa etária, mantém a ordem) | Pizza ou rosca |
| Como um todo se divide, por categoria | `Barras100` | Pizza ou rosca |
| Sobra e falta de cada mês (receita menos despesa) | `ResultadoMensal` | Barras comuns com cor de alerta |
| Mais de uns 7 grupos que importam, ou o leitor precisa do número exato | Tabela (`TabelaDados`), com ou sem gráfico | Mais cores |

Pizza e rosca não existem no Elo: comparar fatias é mais difícil que comparar barras de mesma
base. Se a Diretoria pedir uma, entregue `BarrasHorizontais` ou `Barras100` e explique por quê.

## 2. Componentes (`src/ui/graficos.tsx`)

Todos desenham no próprio código (sem biblioteca, sem internet). Os gráficos de linhas, barras e
`ResultadoMensal` mostram o valor ao passar o mouse ou tocar e trazem "Ver os números", uma tabela
com os mesmos dados. O `Indicadores` escreve nome, valor e situação na própria tela.

| Componente | Recebe | Observações |
| --- | --- | --- |
| `Linhas` | `categorias`, `series`, `formato`, `descricao` | `referencias` desenha linhas de referência com rótulo; `minimo` e `maximo` fixam o eixo; `rotuloCategoria` padrão é "Mês" |
| `BarrasAgrupadas` | `categorias`, `series`, `formato`, `descricao` | `rotuloCategoria` padrão é "Ano"; barras sempre partem do zero |
| `BarrasHorizontais` | `categorias`, `series`, `formato`, `rotuloCategoria`, `descricao` | `notas`: observação curta embaixo do nome de cada categoria |
| `Barras100` | `categorias`, `series`, `rotuloCategoria`, `descricao` | Recebe os valores em reais e calcula a proporção de cada categoria; a tabela mostra em reais |
| `Indicadores` | `itens` (`nome`, `valor` de 0 a 100 ou `null`, `explicacao`, `referencia`, `anteriores`) | `referencia.sentido`: `'ate'` (bom é ficar abaixo) ou `'desde'` (bom é ficar acima); a situação vem escrita ("Dentro" ou "Fora da referência") |
| `ResultadoMensal` | `categorias`, `receita`, `despesa`, `descricao` | Sobra para cima, falta para baixo; saldo acumulado na dica e na tabela |

- `formato` é `'moeda'`, `'pct'` ou `'numero'`; use `formatarValor` para qualquer número que
  apareça fora do gráfico (na leitura ao lado, por exemplo), para ficar igual.
- `descricao` diz o que o gráfico mostra, em uma frase, para leitor de tela. Sempre preencha.
- Valor que ainda não existe é `null` no `Indicadores` (mostra "—"), nunca zero.

## 3. Cor

- **Uma série só:** a cor do app (`naCorDoApp` já faz isso; `cor: 'destaque'`).
- **Várias séries:** `cor` de 1 a 4, nesta ordem, sempre com legenda (os componentes já a
  desenham). **No máximo 4 séries**: o componente trava a cor em 1 a 4, então uma quinta série
  repetiria a cor da quarta e a pessoa não saberia qual é qual. Com mais grupos: junte a cauda em
  "Outros", divida em mais de um gráfico ou use tabela.
- **A cor segue a entidade, nunca a posição.** Se um filtro tira uma série, as que ficam mantêm a
  cor que tinham (passe o número da cor junto com a série, não use o índice do laço).
- **Anos de exercício:** `'ano-1'` (mais antigo) a `'ano-3'` (atual), do claro ao escuro.
- **Sobra e falta:** azul (`--positivo`) e vermelho (`--negativo`), com a situação escrita.
- **Referência ou limite:** `--referencia`, tracejado, com rótulo.
- Verde, vermelho e âmbar de alerta não servem para identificar série. Cor solta (hexadecimal) no
  gráfico nunca; só as variáveis de `src/app/globals.css`.
- Nenhuma informação só por cor: legenda, rótulo ou texto sempre.

## 4. Leitura e acessibilidade

- Gráfico de análise: título do cartão = conclusão; gráfico à esquerda, leitura à direita (número
  grande e o que fazer). Número só em destaque quando pede ação.
- Rótulo de valor só onde ajuda (o último ponto, o maior, o que importa); número em todo ponto
  vira poluição. O resto fica na dica e em "Ver os números".
- Dica de mouse nunca é o único caminho: todo valor também está em "Ver os números" (ou escrito
  na tela, como no `Indicadores`).
- Texto do gráfico em 14 px no mínimo. Um eixo só: nunca dois eixos de escalas diferentes no mesmo
  gráfico; duas grandezas viram dois gráficos ou duas séries comparadas na mesma unidade.
- Ano parcial (em andamento) aparece avisado no texto, para não parecer queda.
- Sem dados: `EstadoVazio` explica por que e o que fazer; nunca gráfico em branco.
- Movimento (pronto nos componentes, 0,4 s): ao abrir, barras crescem e linhas se desenham; ao trocar ano, aba ou filtro, vão até a nova posição. Por isso **não ponha `key` com o ano ou filtro no gráfico**: o mesmo componente precisa receber os dados novos. A escala usa os valores finais; "Ver os números" e a dica mostram sempre o valor final.
- Movimento: o que está em `Movimento` na habilidade `telas` (0,2 a 0,6 s; nada com "menos
  movimento").
- Dado de exemplo e texto sem nome de instituição, unidade, marca ou cidade reais.

## 5. Se nenhum componente serve

Gráfico novo mexe no Núcleo (`src/ui/`), então precisa estar na especificação (e o Arquiteto diz
isso). Nunca crie versão própria dentro de um app. Ao construir:

1. Mesmas regras: SVG no código, variáveis de cor, `descricao`, "Ver os números", dica sem depender
   do mouse, 14 px, tema claro e escuro.
2. Cálculos (escala, proporção, formatação) em função pura, com teste.
3. Exporte pelo mesmo arquivo e inclua o componente na tabela da seção 2 desta habilidade.

## Conferir

- [ ] Cada gráfico responde a uma pergunta e o título dela é a conclusão.
- [ ] A forma segue a seção 1 (sem pizza, sem gráfico de uma barra só).
- [ ] Até 4 séries, cores fixas por série, legenda quando há mais de uma.
- [ ] `descricao` preenchida, `formato` certo e "Ver os números" funcionando.
- [ ] Vazio, `null` e ano parcial tratados e escritos.
- [ ] Tema claro e escuro, largura de celular e nenhuma cor solta.
