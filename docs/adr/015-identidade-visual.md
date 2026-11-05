# ADR-015 · Identidade visual do Elo: marca grafite, cor por app e dois temas

- Situação: aceita
- Data: 2026-11-04
- Referência: `docs/identidade-visual.md` (cópia do documento editável aprovado pela Diretoria)

## Contexto
O Elo vai atender várias organizações (ADR-012) e pode mudar de dono no futuro.
A interface usava o amarelo "margarida" e o azul como marca, uma barra lateral
escura fixa e só seguia o tema do computador, sem escolha.

## Decisão
- **Marca neutra em grafite.** O botão principal e o símbolo (os dois elos de
  corrente, agora em grafite) não carregam a cor de nenhuma organização.
- **Cor por app.** Cada app tem um par de cores (claro/escuro) declarado em
  `src/app/globals.css` sob `[data-app='<id do módulo>']`. A casca marca o app
  aberto pelo primeiro trecho do endereço (`src/ui/cor-do-app.ts`); o menu e os
  cartões do início marcam cada app. Fora dos apps o destaque é ardósia.
- **Dois temas.** Cada token tem o valor claro em `:root` e o escuro em blocos
  próprios (escolha da pessoa ou preferência do computador). O tema segue o
  computador; a pessoa pode escolher claro ou escuro no rodapé do menu. A escolha
  fica no navegador e é aplicada antes da pintura (`src/ui/tema-script.tsx`).
- **Alertas** só em verde, âmbar e vermelho. **Gráficos**: uma série na cor do
  app; várias séries e sobra/falta mantêm as cores testadas para daltonismo.
- **Fonte** Atkinson Hyperlegible Next, embutida (acessibilidade, sem internet).
- Cartões com cantos de 20 px; áreas de clique de pelo menos 44 px no menu.

## Consequências
- App novo precisa escolher a cor na identidade visual e declará-la no CSS;
  sem isso ele usa ardósia, o que não quebra nada.
- Não usamos `light-dark()` do CSS para não deixar de fora navegadores antigos
  (por exemplo, Chrome em Windows 7); por isso os valores escuros aparecem duas
  vezes no CSS (escolha da pessoa e preferência do computador).
- A tela inicial nova (pendências e grade de apps) e os efeitos de movimento
  ficam para a próxima entrega.
