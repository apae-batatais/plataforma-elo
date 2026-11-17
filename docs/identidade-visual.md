# Identidade visual · Elo

Versão de 4 de novembro de 2026, revisada na aplicação ao código · Diretoria (dona do produto)
Documento editável: https://claude.ai/artifact/WnRmuEPtZNBagyMgZTHn98 (esta é uma cópia; a versão editável é a referência)

## Conceito

O Elo é uma marca neutra em grafite: quem dá cor à tela é o app que está aberto. A plataforma reúne vários apps para organizações da sociedade civil (Orçamento, Requisições, Questionários, Avaliação de Serviços Sociais) e vai atender organizações diferentes, então não carrega a cor de nenhuma delas.

O Elo mostra o que precisa de ação, não planilhas. A tela inicial reúne as pendências de todos os apps e dá acesso a cada um deles.

Tem tema claro e tema escuro, com o mesmo desenho e as mesmas regras. Deve parecer um produto de verdade: vivo, com movimento suave e nunca poluído.

## Estrutura

Toda tela tem menu lateral, barra no topo e conteúdo em cartões. A tela inicial tem pendências no topo e a grade de apps logo abaixo.

- **Menu lateral** à esquerda, um tom acima do fundo. Só aparecem os apps e as telas que existem e a que a pessoa tem acesso. Três níveis, distintos por recuo, peso e espaço (nunca só por cor): o **app** (ícone na cor do app e nome em peso forte; só o app aberto vem expandido), o **grupo** (cabeçalho recolhível com seta; o grupo da tela atual vem aberto, os outros recolhidos, e a escolha da pessoa fica lembrada) e a **tela** (recuada, com linha guia; a atual com o traço na cor do app). Nenhum grupo repete o nome do app. O rodapé tem uma linha só (iniciais e nome) e abre o menu do usuário (nome e perfis, tema, versão e "Sair da plataforma"). O menu pode ser recolhido para mostrar só os ícones.
- **Barra no topo:** busca à esquerda; nome da organização e de quem entrou à direita. Dentro de um app, o nome do app aparece ao lado da busca.
- **Cartões** de cantos bem arredondados (20 px), um tom acima do fundo, com uma borda fina.
- **Números do topo** em cartões: um círculo com ícone, a frase do que o número significa e o número bem grande.

### Tela inicial

1. **Pendências:** cartões com o que pede ação em todos os apps (requisições para aprovar, orçamento perto do limite, avaliações vencendo). Cada cartão leva o ícone e a cor do app de onde veio e abre direto no item.
2. **Grade de apps:** um cartão por app, com ícone grande na cor do app, nome, uma frase do que ele faz e o número de pendências. É o elemento marcante do Elo; nenhum outro elemento compete com ela.

Sem pendências, a faixa do topo mostra uma confirmação curta em verde ("Tudo em dia") e a grade sobe.

## Cores

A marca é grafite; o destaque de cada tela é a cor do app aberto. Todas as cores abaixo passam no contraste mínimo de acessibilidade (WCAG AA, 4,5:1) sobre o fundo e os cartões do seu tema.

### Base

| Nome | Claro | Escuro | Uso |
| --- | --- | --- | --- |
| Fundo | #F6F7FB | #101521 | fundo das páginas |
| Cartão | #FFFFFF | #171D2B | cartões e menu |
| Cartão alto | #FFFFFF com sombra suave | #1F2738 | o que fica por cima: janelas, menus abertos, dicas |
| Linha | #DDE2EC | #2A3346 | bordas e divisórias |
| Texto | #1A1F2C | #F1F4FA | texto principal |
| Texto suave | #5B6478 | #A4AEC2 | textos de apoio |
| Elo (grafite) | #2B3445, texto branco | #E6EAF2, texto #101521 | botões principais e logotipo |
| Ardósia | #44597D | #AEBEDA | destaque fora dos apps (início e administração): links, item atual, filtros |

### Alertas

| Nome | Claro | Escuro | Uso |
| --- | --- | --- | --- |
| Verde | #0B7A53 | #3DDC97 | concluído, aprovado, confirmação |
| Vermelho | #D12D4A | #FF5470 | o que já venceu, foi recusado ou passou do limite |
| Âmbar | #9A6700 | #FFC23D | o que vence em breve ou está perto do limite |

### Cores por app

| App | Cor | Claro | Escuro |
| --- | --- | --- | --- |
| Orçamento | Petróleo | #0E7C86 | #3CC8C8 |
| Requisições | Índigo | #3730A3 | #8F8CFF |
| Questionários | Magenta | #A8197F | #F27ACF |
| Avaliação de Serviços Sociais (antes Avaliação Diagnóstica) | Cobre | #8C4A2F | #E0A07E |
| Comunicação | Azul-celeste | #0369A1 | #5CC8F5 |
| Parcerias | Lilás (decisão de 13/11/2026, proposta #118) | #7E3F98 | #D2A2EA |
| Saúde | Framboesa (escolhida pelo Desenvolvedor na entrega #68, aguarda a Diretoria; rosada, longe do vermelho de alerta: conferir sempre com nome e ícone) | #A32A52 | #F09AB4 |
| Projetos | Oliva (decisão de 13/11/2026, proposta #118; esverdeado: conferir sempre com nome e ícone, longe dos alertas) | #5F6B12 | #B8C65A |
| Educação (escolhida pelo Desenvolvedor na entrega #163, a Diretoria confirma ou troca; dourado: conferir sempre com nome e ícone, longe do aviso âmbar) | Ocre | #8A6D00 | #E6C85A |

Cada app tem também ícone próprio (o mesmo no menu, no cartão do início e nas pendências), definido em `src/plataforma/icones-dos-apps.ts`. Dentro do app, a cor dele marca o item atual do menu, os filtros escolhidos, os links, o ícone e os gráficos de uma série só. O botão principal continua grafite em todos os apps.

### Gráficos

- Gráfico de uma série só usa a cor do app.
- Gráfico de várias séries usa quatro cores fixas, testadas para daltonismo, sempre com legenda.
- Sobra e falta usam azul e vermelho, também testados para daltonismo; a situação vem sempre escrita.

### Regras

- Verde, vermelho e âmbar são só para alertas, nunca para decoração nem para identificar um app.
- A cor do app identifica, mas nunca sozinha: vem sempre com o nome ou o ícone.
- Um app novo só ganha cor depois de testada nos dois temas e comparada com as cores dos apps existentes e dos alertas.
- Nenhuma organização atendida empresta sua cor ao Elo.

## Efeitos de acabamento

O movimento mostra o que importa, nunca enfeita. Tudo é rápido: entre 0,2 e 0,6 segundo.

- **Números que contam:** ao abrir a tela, os números grandes sobem de zero até o valor.
- **Grade que acende:** os cartões dos apps entram em sequência. O app com pendência vencida ganha um anel que pulsa devagar, com um brilho suave na cor do alerta.
- **Passar o mouse:** o cartão ganha um brilho leve na borda, na cor do app. Ícones e botões mostram uma dica com o nome da ação.
- **Entrar num app:** a cor de destaque troca para a do app com um esmaecer rápido.
- **Janela de detalhe:** desliza por cima da tela, com o fundo escurecido e desfocado.
- **Gravou:** a confirmação aparece em verde, e o que mudou na tela pisca uma vez para mostrar onde mudou.
- **Gráficos:** ao entrar na tela, barras crescem da base, linhas se desenham da esquerda para a direita e as barras de percentual se preenchem (0,4 s). Ao trocar ano, aba ou filtro, barras, linhas e pontos se movem da posição antiga até a nova, no mesmo gráfico (sem recriá-lo). "Ver os números" e a leitura ao lado já mostram o valor final.
- **Trocar de aba ou de filtro:** o conteúdo troca com um esmaecer rápido; os pontos do gráfico se movem até a nova posição.
- **Trocar de tema:** claro e escuro trocam com um esmaecer rápido, sem piscar.
- Quem pediu ao computador menos movimento vê tudo sem animação.

## Tipografia

O Elo usa a Atkinson Hyperlegible Next em tudo, uma fonte desenhada para pessoas com baixa visão. Ela vai embutida no próprio sistema (não vem da internet), então funciona em qualquer computador; se faltar, entram system-ui, "Segoe UI" e sans-serif.

- Títulos com peso forte; números grandes bem pesados e em algarismos tabulares.
- Corpo em 16 px e textos de gráfico em 14 px no mínimo, para leitura confortável por qualquer pessoa e em telas projetadas.
- Frases em caixa normal. Nada de rótulo em caixa alta.

## Princípios

- O elemento marcante é a grade de apps na tela inicial. Nenhum outro elemento compete com ela.
- Nas análises, o título do cartão já é a conclusão: o gráfico à esquerda e a leitura à direita, com o número grande e o que fazer.
- Números grandes só para o que pede ação. Ao lado de cada número, uma frase que diga o que ele significa.
- Listas longas mostram as primeiras linhas e um botão "Mostrar todas".
- Filtros em pílulas; a escolhida fica na cor do app. Abas em controle segmentado.
- Sem dependência de internet: nada de fonte ou biblioteca de CDN. Ícones e gráficos em SVG no próprio código.
- Textos curtos, em português, do ponto de vista de quem usa ("Aprovar requisição", não "Enviar").
- A identidade é só a aparência: não muda nenhuma regra nem nenhum número dos apps.

### Acessibilidade

- Contraste mínimo de 4,5:1 para texto e 3:1 para ícones e bordas de controles, nos dois temas.
- Nenhuma informação depende só de cor: alerta tem ícone e texto; app tem nome e ícone.
- Tudo funciona pelo teclado, com o foco sempre visível.
- Áreas de clique com pelo menos 44 px de altura.
- O tema segue a preferência do computador da pessoa, que pode trocar a qualquer momento.

## Origem e decisões

Este documento usa a estrutura de um material de curso (identidade visual de um sistema fictício) e adapta o conteúdo ao Elo.

| Ponto | Decisão |
| --- | --- |
| Cor da marca | Grafite neutro; o destaque vem da cor do app |
| Tema | Claro e escuro, com o claro como padrão quando o computador não indicar preferência |
| Tela inicial | Pendências no topo e grade de apps abaixo |
| Cores | Uma por app; sem cor por área da organização, porque cada OSC tem áreas diferentes |
| Azul de status da referência | Retirado; o Elo usa só verde, vermelho e âmbar para alertas |
| Tamanho mínimo de texto | Mantido, agora como regra de acessibilidade |
| Fonte | Atkinson Hyperlegible Next, embutida no sistema (acessibilidade), no lugar da fonte do sistema da referência |
| Símbolo | Os dois elos de corrente continuam, em grafite, até o logotipo definitivo |
| Gráficos | Misto: uma série na cor do app; várias séries e sobra/falta com as cores testadas para daltonismo |
| Destaque fora dos apps | Ardósia, um grafite azulado, para links e item atual no início e na administração |

### Em aberto

- [ ] Validar se o tema claro deve ser o padrão
- [ ] Validar as quatro cores por app com quem vai usar
- [ ] Desenhar o logotipo definitivo do Elo (por enquanto, os dois elos de corrente em grafite)
- [ ] Definir o conjunto de ícones de cada app
