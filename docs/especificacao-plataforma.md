# Especificação da Plataforma — v1 (resumo para o repositório)

Documento completo, com diagramas: https://claude.ai/artifact/FuL5TfpJoxSZJA7NBo6t34
Este arquivo é o resumo que acompanha o código. Em caso de conflito, as ADRs
em `docs/adr/` valem sobre este resumo. A ADR-011 mudou a arquitetura:
camada de aplicação na Netlify e armazenamento em Google Planilhas.

## Objetivo
Reunir em um só lugar os apps de cada departamento da Apae Batatais, sobre um
Núcleo comum de pessoas, acesso e auditoria. Primeiros apps: Orçamento (Fase 1)
e Avaliação de Serviços Sociais da Assistência Social (Fase 2).

## Princípios
1. Simples antes de elegante: uma linguagem, um banco, um app, um deploy.
2. Nenhum servidor para administrar.
3. Um dado, um dono: cada pessoa é cadastrada uma única vez.
4. Apps independentes.
5. LGPD por padrão: proteção no banco, não só na tela.
6. Tudo escrito no repositório.
7. Entregas pequenas e reversíveis, revisadas em prévia.

## Camadas
| Camada | Pasta | Conteúdo |
| --- | --- | --- |
| Portal | `src/app` | Login, menu por perfil, layout |
| Módulos | `src/modulos/<id>` | Um app por departamento |
| Capacidades | `src/capacidades` | Motor de avaliação, Indicadores |
| Núcleo | `src/nucleo` + planilhas `nucleo` e `auditoria` | Armazenamento, acesso, pessoas, organização, auditoria, sessão |

## Núcleo (planilha `nucleo`, uma aba por tabela)
Abas: Unidades, Areas, Servicos, Pessoas, Papeis, VinculosFamiliares,
VinculosServico, Usuarios, Perfis, PerfilPermissoes, Atribuicoes.
Planilha `auditoria`, aba Registros (somente inclusão).
Definições em `src/nucleo/estrutura/tabelas.ts`.

## Perfis iniciais
| Perfil | Vê | Altera |
| --- | --- | --- |
| Administrador da plataforma | Configuração, usuários, auditoria | Organização e acessos; não vê atendidos |
| Diretoria | Todas as pessoas, auditoria, indicadores | Aprovações |
| Financeiro | Orçamento | Previsão e lançamentos |
| Coordenação de serviço | Atendidos do seu escopo e familiares | Cadastro e vínculos do escopo |
| Técnico avaliador | Atendidos do seu escopo | Avaliações que conduz |
| Leitura | Painéis agregados | Nada |

Escopo de atribuição: global, unidade, área ou serviço. Escopo de unidade ou
área cobre os serviços daquela unidade ou área.

## Eventos do Núcleo
| Evento | Quando |
| --- | --- |
| `PessoaVinculadaAServico` | Novo vínculo ativo com serviço |
| `PessoaDesligadaDeServico` | Vínculo encerrado (com motivo) |

## Roteiro
| Fase | Entrega | Para avançar |
| --- | --- | --- |
| 0 · Fundação | Camada de aplicação, armazenamento em planilhas, acesso, auditoria, demonstração, CI | Google Cloud, Drive e Netlify configurados; login Google institucional |
| 1 · Orçamento | Importação 2026/2027, previsão, folha e rateio, lançamentos, painel | Execução confere com a planilha; DPO definido |
| 2 · Avaliação | Motor + módulo da Assistência, primeiro ciclo da UR | Ciclo fechado, enquadramentos justificados |

Fase 2, entrega 1 (06/11/2026): módulo Avaliação de Serviços Sociais, com avaliação inicial e anual, comparativo da mesma pessoa, painel por serviço atual e fundamento legal do instrumento (ADR-016). O motor de avaliação fica para as próximas entregas.
| 3 · Expansão | Educação, Saúde/CER, novos módulos | — |

## Situação da Fase 0
- [x] Camada de aplicação (Next.js) com módulos e regras de fronteira
- [x] Armazenamento em Google Planilhas pela conta de serviço, com controle de versão (ADR-011)
- [x] Acesso por perfil e escopo e auditoria na camada de aplicação
- [x] Login Google institucional (conferido no servidor) e demonstração com dados fictícios
- [x] Publicação na Netlify pelo GitHub (oficial manual, prévia por PR)
- [x] Google Cloud: conta de serviço e ID do cliente OAuth
- [x] Planilhas Núcleo e Auditoria criadas e compartilhadas com a conta de serviço
- [ ] Capacidade de Indicadores (cálculo e painel): especificação em `docs/especificacao-indicadores.md` (#57)
- [ ] Cadastro de pessoa e vínculo com serviço: especificação em `docs/especificacao-pessoas-e-vinculos.md` (#198)

## Textos e demonstração sem nomes próprios (proposta #97)

**Objetivo**: o Elo atende várias OSCs; nenhum texto visto por quem usa, nem dado fictício, cita
instituição, unidade, marca ou cidade reais. **Para quem**: todas as pessoas que usam o Elo, a
Operadora da rede e quem confere as prévias. **Frentes**: telas (textos) e regras e dados (dados
fictícios e configuração inicial do Núcleo, a pedido da proposta). Fora os textos e dados
fictícios listados abaixo, nenhum módulo muda.

### Regra permanente (decisão da Diretoria, 11/11/2026)
Textos de tela, dicas, exemplos, mensagens, dados fictícios e manual **nunca citam nome próprio**
de instituição, unidade, marca ou cidade. Termos genéricos: "instituição", "nome da instituição",
"OSC", "Sede". Fica de fora a documentação interna (especificações, ADRs, metodologia, regras do
agente), que quem usa o Elo não vê. A regra já está no `CLAUDE.md` (neste PR). O Desenvolvedor
repete a regra nas habilidades `telas` e `regras-e-dados` na entrega.

### O que muda
1. **Nomes da demonstração** (`src/nucleo/config.ts`): instituição `exemplo` passa a
   "Instituição Exemplo A" (por extenso: "Instituição Exemplo A (fictícia)"); `modelo` passa a
   "Instituição Exemplo B" ("Instituição Exemplo B (fictícia)"). Códigos, domínios e unidades não
   mudam. "Instituição Operadora da Plataforma" continua como a Administração da rede, sem perfis
   dos apps. A tabela da seção "Demonstração" de `docs/especificacao-rede.md` já foi atualizada
   neste PR; atualizar `tests/nucleo/instituicoes.test.ts`.
2. **Textos da Rede**: cadastro da instituição (`formulario-instituicao.tsx`: dicas, placeholder e
   exemplo de unidades) e as 4 mensagens de erro de `src/nucleo/rede/rede.ts` usam exemplos
   genéricos: "Instituição Exemplo", `instituicao-exemplo`, `instituicao.org.br`,
   `elo.instituicao.org.br`, `sede=Sede`. Descrição da página: "As instituições que usam o Elo".
   Passo a passo do endereço de acesso: endereço genérico.
3. **Outros textos**: Orçamento (dica do Total CEBAS: "o que a instituição efetivamente
   desembolsa"); Tesouraria › Contas ("As contas da instituição onde o dinheiro fica guardado…");
   Requisições (dica "Onde é o serviço": "Ex.: Sede, banheiro do pátio"); exemplo do cadastro de
   serviços em lote (`cadastro-em-lote.tsx`), que cita a área "Rural" e a unidade "Filial"
   (trocar por área e unidade iniciais, como "Educação" e "Sede").
4. **Dados fictícios**: requisição com local "Sede, banheiro do pátio"; departamento "Apae Rural"
   → "Produção (exemplo)"; receitas "Vendas Vem da Rural (exemplo)" e "Vendas da Rural (exemplo)"
   → "Vendas da produção (exemplo)" e "Venda de mudas (exemplo)" (nomes distintos); pauta
   "Bastidores da horta da Apae Rural" → "Bastidores da horta da instituição"; cidade dos atendidos
   fictícios → "Cidade Exemplo"; unidade fictícia "Unidade Rural (Filial)" → "Unidade Filial
   (exemplo)".
5. **Área "Rural"** (pergunta da Diretoria ao Arquiteto; decisão tomada sozinho, no PR): sai de
   `AREAS_INICIAIS` (`src/nucleo/estrutura/dados-iniciais.ts`); instituição nova nasce com 7 áreas
   e cadastra as suas. Instituições já cadastradas não perdem a área (nada é apagado; "Preparar
   estrutura" só semeia abas vazias). Na demonstração, a área e a unidade fictícias do viveiro
   passam a `producao` ("Produção (exemplo)") e `filial` ("Unidade Filial (exemplo)"), criadas
   pelos dados fictícios, não pela configuração inicial. `rural_viveiro` vira `producao_viveiro`
   e `rural` vira `producao`/`filial` nos dados fictícios e nos testes que os usam.
6. **Manual**: título "Manual do Elo" (Ajuda, `docs/manual/README.md`, documento no Claude Docs);
   a Ajuda e o PDF (`public/manual/manual-elo.pdf`) são atualizados no mesmo PR de entrega.
7. **Comentários internos do código** com exemplos de Apae Franca/Batatais viram genéricos
   (`config.ts`, `rede/tabelas.ts`, `dados-iniciais.ts`, `preparar.ts`, `plataforma/instituicao.ts`).

### Regras de negócio (com teste)
1. A demonstração lista "Instituição Exemplo A" e "Instituição Exemplo B"; uma continua sem ver
   os dados da outra (testes de isolamento existentes seguem verdes).
2. `AREAS_INICIAIS` não contém "Rural"; "Preparar estrutura" numa instituição nova cria 7 áreas.
3. Teste de guarda: nenhum arquivo de `src/` (exceto testes e a lista de e-mails de setor em
   `src/ui/saudacao.ts`), incluindo os dados fictícios, contém "Apae", "Batatais", "Franca" ou
   "Rural" como nome próprio. A palavra "apae" em `saudacao.ts` fica (não é exibida; evita tratar
   e-mail institucional como nome de pessoa).
4. Mensagens de erro do cadastro de instituição continuam validando as mesmas regras, só com
   exemplos genéricos.

### Fica de fora
Dados das instituições reais; especificações, ADRs, metodologia e regras do agente; a lista de
e-mails de setor da saudação.

### Entregas
Uma só (cabe num PR): textos, dados fictícios, nomes da demonstração e manual.

### Critérios de pronto (na prévia)
- A tela de entrada mostra "Instituição Exemplo A" e "Instituição Exemplo B".
- Rede › Nova instituição: dicas, placeholders e erros sem nomes próprios.
- Orçamento, Tesouraria › Contas, Requisições, Comunicação e atendidos fictícios sem nomes
  próprios; o teste de guarda passa.
- Ajuda e manual chamam-se "Manual do Elo".

## Efeitos de acabamento (proposta #109)

**Objetivo**: criar como peças reutilizáveis em `src/ui/` os quatro efeitos de "Efeitos de
acabamento" da identidade visual (`docs/identidade-visual.md`) que hoje não existem, e aplicá-los
em todos os apps de uma vez (decisão da Diretoria, 12/11/2026). **Para quem**: todas as pessoas que
usam o Elo e a Diretoria, que confere nas prévias. **Frentes**: telas. Mexe em `src/ui/`, no
`globals.css` e nas telas dos apps só para trocar elementos existentes pelas peças; nenhuma regra,
aba, permissão ou número muda (a identidade é só a aparência). Sem ADR: não há decisão de
arquitetura, e as peças seguem a regra "sem biblioteca de fora".

### O que já existe (conferido no código)
- Regra global de "menos movimento" (`prefers-reduced-motion` em `globals.css`): reduz a duração
  das animações e transições para 0,01 ms. Ela **não** impede que um contador JavaScript conte; as
  peças novas precisam tratar isso por conta própria (regra 2).
- Entrada da notificação (`entrar-de-cima`, 0,2 s), giro do `BotaoEnviar`, esmaecer de cor na
  troca de tema e de app, e o brilho simples do cartão de app da tela inicial (borda e sombra
  `destaque-suave` ao passar o mouse, em `src/app/(elo)/page.tsx`).
- **Não existem**: números que contam, anel que pulsa, brilho padronizado em todos os cartões
  clicáveis, pisca onde mudou. Também não existem (e ficam fora desta proposta): grade que acende
  em sequência, janela que desliza com fundo desfocado (a `Janela` só escurece o fundo), esmaecer
  ao trocar de aba ou filtro, dicas em ícones e botões. O Arquiteto sugere à Diretoria uma
  próxima proposta com estes.

### As quatro peças (`src/ui/`)
1. **`NumeroQueConta`** (cliente): recebe o valor já formatado pelo servidor mais o número e o
   formato (`moeda`, `pct`, `numero`, de `formatarValor` em `graficos.tsx`). Ao aparecer na tela,
   sobe de 0 até o valor em 0,6 s, com desaceleração; usa algarismos tabulares e largura fixa
   para o texto não "pular". Se o valor for nulo, texto ("—") ou negativo, mostra direto o valor,
   sem contar. Quando o valor muda depois (nova gravação), não recomeça do zero: vai do número
   atual ao novo em 0,3 s.
2. **`AnelPulsante`** (CSS em `globals.css` + classe usada pelo cartão): anel de 2 px na cor de
   alerta (`--negativo`/aviso do tema) com brilho suave que respira em 2,4 s, sem fim enquanto a
   pendência existir. É decoração: o alerta continua com ícone e texto dentro do cartão (regra 4).
3. **`CartaoBrilho`** (classe/peça): ao passar o mouse **ou receber foco pelo teclado**, a borda do
   cartão ganha brilho leve na cor do app (`--destaque`), em 0,2 s. Substitui o brilho avulso do
   cartão da tela inicial e vale para todo cartão que é clicável como um todo.
4. **`PiscaOndeMudou`** (cliente): envolve o trecho da tela que uma gravação pode alterar
   (um número, uma linha de tabela, um cartão) e recebe uma `chave` estável. Depois de uma
   gravação, se o conteúdo desse trecho for diferente do que a pessoa tinha visto, ele recebe um
   fundo `destaque-suave` que some em 0,6 s, uma vez só. Não pisca na primeira abertura da tela,
   nem ao voltar mais tarde sem ter gravado, nem para o que não mudou.

### Regras de negócio (com teste)
1. **Contagem**: `NumeroQueConta` termina sempre exatamente no valor recebido (nunca arredondado
   diferente de `formatarValor`); a conta é uma função pura testável (valor, progresso → texto).
2. **Menos movimento**: com `prefers-reduced-motion: reduce`, o número já aparece no valor final
   (sem contar), o anel não pulsa e fica como anel fixo, o brilho aparece sem transição e o
   "pisca" vira destaque fixo e discreto que some depois de 3 s, sem animação. Nada se perde.
3. **Leitor de tela e impressão**: o texto final do número está no HTML desde o servidor (o
   leitor de tela lê o valor final, não os números intermediários, que ficam `aria-hidden`), e na
   impressão os números saem no valor final. Nenhum efeito retira o foco, atrasa clique ou muda o
   tamanho do elemento.
4. **Alerta nunca só pelo efeito**: o app com pendência vencida tem, além do anel, um
   `Etiqueta` com ícone e texto ("Pendência vencida") no próprio cartão.
5. **Duração**: todo efeito dura entre 0,2 e 0,6 s (exceto o anel, que repete devagar), sem
   dependência de internet e sem biblioteca de fora.
6. **Pisca só depois de gravar e só onde mudou**: a peça guarda o último conteúdo visto de cada
   `chave` por página e só pisca quando a tela chega após uma gravação (a mesma marca `?ok=` que a
   `Notificacao` já usa; a marca precisa ser lida de um modo que não dependa da ordem em que a
   `Notificacao` limpa o endereço). Sem `?ok=`, nunca pisca.
7. **Pendência vencida na tela inicial**: o cartão do app ganha o anel quando a pessoa tem, nesse
   app, pendência com prazo vencido. Conta como vencida: requisição atrasada (além do prazo
   combinado do app) e avaliação atrasada. A tela inicial lê isso pelos mesmos casos de uso que
   os painéis do app já usam, sempre pelo `Autorizador`: quem não vê o app ou o dado não vê o
   anel. Teste de quem vê: perfil sem acesso ao app não recebe o anel; perfil com acesso recebe
   só pelos itens que pode ver.
8. **Sem mudança de dados**: nenhuma peça lê ou grava planilha; as peças só recebem valores já
   calculados e autorizados pela tela.

### Telas (onde se aplica; "todas as telas de todos os apps")
- **Números que contam**: todo número grande (`text-2xl` ou maior em `dd`, `p` ou `span` de
  painel e cartão de topo) de Orçamento (painel, previsão, previsão geral, importações), Requisições
  (painel), Avaliação (início, painel, ficha, formulário), Parcerias, Rede e os valores de
  `Indicadores` em `graficos.tsx`. O Desenvolvedor faz a lista completa com
  `grep -rn "tabular-nums"` e registra no PR o que ficou de fora e por quê (por exemplo, número
  dentro de formulário que muda a cada tecla, como o índice ao vivo do formulário de avaliação:
  ali não conta).
- **Brilho**: cartão de app e atalhos da tela inicial, cartões de topo clicáveis dos apps e
  qualquer cartão que seja um link inteiro. Cartão que não é clicável não ganha brilho (brilho
  promete clique).
- **Anel**: só no cartão de app da tela inicial (as seções de pendência listam o texto, sem
  anel). Cartões de Núcleo (Pessoas, Acessos, Áreas, Serviços) nunca recebem anel.
- **Pisca onde mudou**: depois de salvar, o trecho que mudou: o valor do cartão e do painel afetados,
  a linha da tabela alterada (folha, lotação, itens da previsão, lançamentos, pedidos,
  requisições, avaliações, acessos), o item de lista. O Desenvolvedor passa por todas as ações que
  terminam em `?ok=` (`grep -rn "ok=" src`) e envolve o que cada uma altera; a `chave` é o id do
  registro (nunca nome de pessoa na chave guardada) e o conteúdo comparado é só texto da tela, que
  fica no navegador da própria pessoa (`sessionStorage`, some ao fechar a aba).
- Melhoria apontada: a tela inicial mostra pendências só como lista; com o anel, o app que
  concentra o problema fica visível sem ler a lista.

### Fica de fora
- Grade que acende em sequência, janela que desliza, esmaecer ao trocar aba ou filtro, pontos de
  gráfico que se movem, dicas em ícones e botões (já existem só em parte; próxima proposta).
- Qualquer mudança de regra, permissão, aba ou número; som; biblioteca de animação.
- Efeito em tabela inteira que recarrega (só pisca a linha ou o valor que mudou).

### Frentes
`telas` (peças, aplicação nas telas, `globals.css`). Para a tela inicial, a leitura da pendência
vencida usa casos de uso que já existem (`regras e dados`, só leitura, sem aba nova).

### Entrega
Uma entrega, como a Diretoria pediu, feita em passos com commits separados: (1) peças e testes;
(2) tela inicial (anel e brilho); (3) números nos apps; (4) brilho nos cartões; (5) pisca nas
gravações. No fim, o Desenvolvedor atualiza a tabela "Movimento" da habilidade `telas` (as quatro
peças passam a existir) e a seção de efeitos de `docs/identidade-visual.md`, se algum valor
mudou. Se a entrega ficar grande demais para conferir, o PR diz onde cortar.

### Decisões tomadas sozinho (custo se estiverem erradas)
- **O que é "pendência vencida"**: requisição e avaliação atrasadas, únicas com prazo hoje. Se a
  Diretoria quiser outras (por exemplo, pedido de comunicação urgente), é um ajuste pequeno.
- **Tempos**: contagem 0,6 s, brilho 0,2 s, pisca 0,6 s, anel 2,4 s por ciclo. Ajuste de número.
- **Anel só na tela inicial**; dentro do app o alerta continua como hoje.
- **Não contar números que mudam a cada tecla** (índices ao vivo de formulário).
- **`sessionStorage` para o pisca**: simples e sem servidor; custo: se a pessoa abrir a tela em
  outra aba logo depois de gravar, não pisca. Aceitável.

### Critérios de pronto (na prévia)
1. Em qualquer app, ao abrir o painel, os números grandes sobem de zero e terminam no valor certo.
2. Na tela inicial, passar o mouse (e navegar pelo Tab) em qualquer cartão faz a borda brilhar na
   cor do app.
3. Com um perfil que tenha requisição ou avaliação atrasada, o cartão desse app pulsa e mostra a
   etiqueta "Pendência vencida"; sem atraso, não pulsa.
4. Salvar uma alteração (por exemplo, a lotação de um funcionário) mostra a confirmação em verde
   e faz pulsar de leve só a linha ou o valor que mudou; recarregar a página não pisca de novo.
5. Com "reduzir movimento" ligado no computador, nada anima e todas as informações aparecem.
6. Tema claro e escuro, celular e impressão conferidos; `npm run verificar` e `npm run build` verdes.

## Menu, navegação, leiaute dos painéis e movimento nos gráficos (proposta #118)

Completa a proposta #109 (efeitos de acabamento), que não incluía o movimento dos gráficos. Vale
para todos os apps. A barra do topo com busca é a issue #117 e fica de fora.

### Objetivo e para quem
Quem usa o Elo reconhece de relance em que app, em que grupo e em que tela está, acha o que procura
sem rolar o menu, vê as pendências com a cor do app e percebe nos gráficos o que mudou. Todas as
pessoas, em especial quem usa o Orçamento (menu mais longo).

### O que já existe (conferido no código)
- `src/ui/casca.tsx`: o menu mostra os filhos do app só quando a pessoa está dentro dele; os
  títulos de grupo (`secao`) são um texto pequeno sem recuo próprio; o rodapé tem usuário, "Sair",
  seletor de tema e versão sempre à mostra.
- `src/plataforma/navegacao.ts`: `ICONE_DO_MODULO` mapeia Orçamento, Parcerias e `handshake` para o
  mesmo ícone; `projetos` não está no mapa e cai em "planilhas". A tela inicial
  (`src/app/(elo)/page.tsx`) também usa o ícone do Orçamento para Parcerias e Projetos.
- `src/app/globals.css`: Parcerias reutiliza a cor do Orçamento; Projetos não tem cor.
- Pendências da tela inicial: todas com o ícone âmbar de atenção, sem app de origem.
- `src/ui/graficos.tsx`: nenhum componente anima; o `Linhas` usa `polyline` (não anima por CSS).
- Textos: a tela de entrada diz "em breve, a avaliação diagnóstica"; o título do mês no calendário
  e nos indicadores da Comunicação usa `capitalize` do CSS e vira "Novembro De 2026".
- `TabelaDados` já rola na horizontal, mas sem sinal de que há mais colunas.

### Decisões da Diretoria
- Cores (issue #118, 13/11/2026): **Parcerias em lilás e Projetos em oliva**
  (lilás #7E3F98 claro / #D2A2EA escuro; oliva #5F6B12 claro / #B8C65A escuro). Contraste de texto
  conferido nos dois temas pelo Arquiteto (todos acima de 4,5:1).
- Observação do Product Owner: conferir na prévia, nos dois temas e com simulação de daltonismo, se
  o oliva se confunde com o verde dos alertas (ver "Critérios de pronto").

### Usuários e permissões
Nada muda: o menu continua mostrando só o que a pessoa pode abrir (`menuDoUsuario`). Nenhuma aba,
permissão ou regra de negócio é criada ou alterada.

### Telas

**1. Menu lateral** (`casca.tsx`; computador e celular)

Quem usa e o que quer: chegar a uma tela de um app. Caminho mais curto: app → (grupo, se fechado) →
tela, no máximo 2 cliques e nenhuma rolagem para achar um grupo.

Três níveis, distintos por recuo, peso e espaço (nunca só por cor):
- **App**: ícone na cor do app, nome em peso forte; é o único nível com ícone. Só o app atual vem
  expandido; os outros ficam numa linha.
- **Grupo** (`secao`): cabeçalho recolhível, botão com seta que gira (`aria-expanded`), texto em
  peso médio e recuado em relação ao app, com um pouco mais de espaço acima. Clicar abre ou fecha.
  Apps cujo menu não tem grupos (Parcerias hoje) mostram as telas direto, sem cabeçalho.
- **Tela**: recuada mais um nível, com a linha guia à esquerda; a atual com o traço na cor do app e
  o texto em destaque.

Comportamento dos grupos:
1. Ao entrar numa tela, o grupo dela abre (e só ele, no primeiro acesso); os outros ficam
   recolhidos.
2. Se a pessoa abriu ou fechou um grupo, o menu lembra (`localStorage`, chave própria por app e
   grupo, igual ao já feito com `elo-menu`); sem armazenamento, vale até recarregar.
3. Navegar para uma tela dentro de um grupo recolhido sempre o abre, mesmo que a pessoa o tenha
   fechado antes (a tela atual nunca fica escondida).
4. No menu recolhido (só ícones), os grupos não aparecem; o app abre o primeiro item como hoje.
5. Teclado: a seta é um botão (Enter e espaço abrem e fecham), na ordem natural; o foco fica visível.
6. Com 7 grupos no Orçamento: 7 cabeçalhos mais as telas do grupo aberto (no máximo 6) cabem sem
   rolagem num computador comum.

Nomes de grupo: nenhum grupo repete o nome do app. Em Projetos, o grupo "Projetos" passa a se
chamar **"Ideias e projetos"** (`src/modulos/projetos/manifesto.ts`, alteração autorizada por esta
proposta); o grupo "Diretoria" fica. O Desenvolvedor confere os demais manifestos e lista qualquer
repetição que encontrar, sem renomear sem decisão.

**Rodapé do menu**: uma linha só, com as iniciais, o nome e um botão de menu do usuário. O menu do
usuário (abre por cima, fecha com Esc e ao clicar fora, no teclado e no toque) traz: nome e
perfis, tema (claro, escuro, automático), versão da plataforma e "Sair da plataforma". No menu
recolhido, só as iniciais, que abrem o mesmo menu. Peça nova em `src/ui/` (menu do usuário), o que
mexe no Núcleo; esta proposta pede isso.

**Ícones e cores por app**: cada app tem ícone próprio e cor própria, e o mesmo ícone no menu, no
cartão do início e nas pendências:

| App | Ícone | Cor |
| --- | --- | --- |
| Orçamento | atual (calculadora) | petróleo |
| Requisições, Comunicação, Avaliação | atuais | atuais |
| Parcerias | novo: duas mãos que se encontram (ou dois elos), traço igual aos demais | lilás |
| Projetos | novo: bandeira sobre um caminho com marcos (as portas de decisão) | oliva |

`ICONE_DO_MODULO` e a tela inicial passam a usar um mapa único de ícone por app (hoje há dois
trechos que repetem a escolha). O ícone novo entra em `icones.tsx`; a cor entra em `globals.css`
(três blocos por app: claro, escuro e escuro automático) e na tabela "Cores por app" de
`docs/identidade-visual.md`. Parcerias deixa de compartilhar a regra do Orçamento. Os tons
`--destaque-forte` e `--destaque-suave` seguem o padrão dos outros apps.

**2. Tela inicial** (`src/app/(elo)/page.tsx`)

Primeira dobra: a faixa "Precisa da sua atenção" vem primeiro; a ação principal de cada pendência é
o verbo dela ("Aprovar", "Revisar").
- Cada pendência ganha o campo `app` e mostra o ícone e a cor do app de origem no lugar do ícone
  âmbar; o nome do app vem escrito junto (a cor nunca vai sozinha).
- Pendências do mesmo app vêm juntas, num bloco com cabeçalho (ícone, nome do app e quantidade),
  na ordem dos apps do menu. Pendências da plataforma (atualização de estrutura, pessoas sem
  perfil) vêm num último bloco "Plataforma", com ícone de Administração e cor ardósia.
- Sem pendências: mantém a mensagem atual de confirmação.
- Grade de apps: os cartões da mesma linha têm a mesma altura; os atalhos ficam sempre no pé do
  cartão, de modo que o ícone e o nome alinham entre cartões.
- Celular: os blocos de pendência empilham; a ação continua com 44 px de altura.

**3. Textos**
- Tela de entrada: troca "em breve, a avaliação diagnóstica" por uma frase que não prometa app
  futuro: "Os apps da sua instituição em um só lugar: orçamento, requisições, comunicação,
  avaliação e mais. Cada pessoa vê só o que o seu perfil permite." (sem nome próprio).
- Mês: o título do calendário e o da tela de indicadores da Comunicação deixam de usar
  `capitalize`; só a primeira letra vira maiúscula ("Novembro de 2026"). Mesma regra para qualquer
  texto de data que o Desenvolvedor encontrar.

**4. Painéis longos: atalhos para as seções**

Decisão: **índice de seções com âncoras**, e não abas. Abas escondem o panorama e pioram a
impressão. A peça nova `AtalhosSecoes` (`src/ui/pagina.tsx`) é uma faixa de pílulas ("Neste painel")
no topo, que fica visível ao rolar, leva à seção com rolagem suave (sem animação com "menos
movimento") e marca a seção em foco. Em celular, a faixa rola na horizontal. Cada seção é um
`<section>` com título e `id`. Entra em painéis com 5 ou mais blocos.

Painel geral do Orçamento, hoje 11 blocos, passa a 5 seções (os blocos e seus textos não mudam):

| Seção | Blocos |
| --- | --- |
| Indicadores | Indicadores |
| O ano em foco | Receita e despesa mês a mês; Sobra ou falta em cada mês; Fontes de recurso |
| Comparar exercícios | Despesa mês a mês por exercício; Despesa por área; Despesa por grupo de gasto |
| Receita | Segurança da receita; De onde vem a receita; Liberdade de uso da receita |
| Resumo | Resumo dos exercícios |

O Desenvolvedor confere os outros painéis; os que tiverem 5 ou mais blocos usam a mesma peça e
entram na lista do PR.

**5. Tabelas largas** (`TabelaDados`)
- A tabela nunca corta coluna sem aviso: rola na horizontal dentro do cartão, com a **primeira
  coluna fixa** à esquerda e uma **sombra na borda** do lado em que há mais colunas (some quando a
  pessoa chega ao fim). Quando rola, aparece a dica "Role para o lado para ver mais colunas" (texto,
  não só sombra). O "Resumo dos exercícios" é o caso de conferência.
- Tabelas que já cabem não mudam.

**6. Gráficos com movimento** (`src/ui/graficos.tsx`; todos os componentes, em todos os apps)

Pergunta que cada gráfico responde não muda; muda só como ele aparece e se atualiza.
- **Ao abrir** (uma vez, quando o gráfico entra na tela): barras crescem da base, linhas se
  desenham da esquerda para a direita, pontos surgem em seguida, barras de `Indicadores` e
  `Barras100` se preenchem; 0,4 s (dentro do limite de 0,2 a 0,6 s).
- **Ao trocar de ano, aba ou filtro**: barras, linhas e pontos se movem da posição antiga para a
  nova (0,4 s). Séries que entram ou saem esmaecem. O valor do `NumeroQueConta` ao lado já conta;
  sem mudança em cima dele.
- **Sem animação**: com "reduzir movimento", tudo aparece direto; ao passar o mouse ou focar, a
  dica aparece sem atraso.
- Não animar o que muda a cada tecla ou a cada passagem do mouse (dica, destaque da coluna).
- A animação não pode esconder valor: no fim do movimento, a posição é a exata, e "Ver os números"
  e a leitura ao lado já mostram o valor final desde o primeiro instante.
- Para o movimento funcionar na troca, o gráfico não pode ser remontado: as telas não colocam a
  `key` do ano no componente e o mesmo gráfico recebe os dados novos.
- Implementação a critério do Desenvolvedor, desde que funcione nos navegadores atuais (o
  `polyline` do `Linhas` não anima por CSS). A sugestão é um gancho de interpolação com
  `requestAnimationFrame`, com a conta da interpolação em função pura e teste.

**7. Estados**: nenhuma tela ganha ação nova que grave dados, então não há novos estados de
gravação ou erro. Vazio, sem dados e `null` continuam como a habilidade `graficos` manda.

### Regras de negócio (com teste)
1. O estado dos grupos do menu (aberto ou fechado, o que a pessoa escolheu) é calculado por função
   pura: a tela atual sempre vem aberta; a escolha da pessoa vale para os demais; sem escolha,
   só o grupo da tela atual abre. Teste: caminho em grupo recolhido abre; escolha lembrada vale;
   app sem grupos não tem cabeçalho.
2. Nenhum grupo de nenhum manifesto tem o mesmo nome do app (teste sobre `MODULOS`).
3. Todo app ativo tem ícone próprio e cor própria no mapa único; dois apps não compartilham o
   ícone nem a cor (teste sobre o mapa e `globals.css`).
4. As cores lilás e oliva passam de 4,5:1 sobre o fundo e o cartão nos dois temas (teste de
   contraste com os valores da identidade visual) e ficam a pelo menos a diferença de tom das
   demais cores de app.
5. Pendências da tela inicial têm `app`; o agrupamento mantém a ordem dos apps do menu e põe a
   plataforma por último (função pura com teste).
6. A formatação do mês só põe maiúscula na primeira letra ("Novembro de 2026").
7. A interpolação dos gráficos é função pura com teste (início, meio, fim; série que entra ou sai;
   "menos movimento" retorna o valor final direto).
8. O menu continua mostrando só o que o `Autorizador` permite (os testes de navegação atuais
   continuam passando).

### Fica de fora
- Barra do topo com busca (issue #117).
- Reorganizar os 7 grupos do Orçamento (sugestão abaixo); mudar regra, permissão, aba ou número.
- Biblioteca de gráficos ou de animação; som.
- Formulários: não foram avaliados e não mudam.

### Frentes
`telas` (menu, rodapé, ícones, cores, tela inicial, atalhos, tabela, textos) e `graficos`
(movimento). Sem `regras e dados` nem `infraestrutura`: nenhuma aba nova. Muda o Núcleo `src/ui/`
(`casca.tsx`, `graficos.tsx`, `tabela-dados.tsx`, `pagina.tsx`, `icones.tsx`, menu do usuário),
`src/plataforma/navegacao.ts` e `globals.css`, como a proposta pede; o único módulo tocado é o
nome do grupo em `src/modulos/projetos/manifesto.ts` e a seção das telas do Painel geral do
Orçamento (agrupar blocos, sem alterar conteúdo).

### Entrega
Uma entrega, em passos com commits separados: (1) cores e ícones por app, mapa único, testes;
(2) menu com níveis e grupos recolhíveis, rodapé compacto; (3) tela inicial (pendências por app,
cartões iguais, textos); (4) atalhos de seção e Painel geral; (5) tabelas largas; (6) movimento dos
gráficos. No fim, atualiza a tabela "Movimento" da habilidade `telas` (esmaecer e pontos que se
movem passam a existir), a habilidade `graficos`, "Cores por app" e a estrutura do menu em
`docs/identidade-visual.md`. Se ficar grande demais para conferir, o PR diz onde cortar (a ordem
acima já é a de corte: 6 e 5 por último).

### Melhorias sugeridas (a Diretoria decide; não entram nesta entrega)
- Reagrupar o menu do Orçamento em menos grupos (por exemplo, juntar "Execução" e "Tesouraria", e
  "Histórico" com os painéis), se depois da mudança o menu ainda parecer longo.
- Mostrar na grade da tela inicial o número de pendências de cada app (a identidade visual já prevê).
- Botão "Recolher todos os grupos" no menu.

### Decisões tomadas sozinho (custo se estiverem erradas)
- **Só o app atual abre**; os outros ficam numa linha. Custo: um clique a mais para trocar de app.
- **"Sair" fica dentro do menu do usuário.** Custo: um clique a mais para sair; se incomodar, o
  botão volta ao rodapé.
- **Grupo "Projetos" renomeado para "Ideias e projetos".** Nome é troca de uma linha.
- **Ícones novos** (aperto de mãos para Parcerias, bandeira com marcos para Projetos). Custo:
  trocar o desenho.
- **Atalhos de seção em vez de abas.** Custo: se a Diretoria preferir abas, é refazer o leiaute do
  Painel geral.
- **Primeira coluna fixa e sombra nas tabelas largas.** Custo: ajuste de componente.
- **Duração 0,4 s e movimento ao abrir e ao trocar.** Custo: um número.
- **Sem ADR**: não há decisão de arquitetura (só interface e `localStorage`, como o `elo-menu`).

### Critérios de pronto (na prévia)
1. Orçamento no perfil Diretoria: app, grupo e tela se distinguem de relance, nos dois temas; o
   grupo da tela atual vem aberto, os outros recolhidos, e todo o menu cabe sem rolar; abrir um
   grupo, navegar e voltar mantém a escolha.
2. O rodapé ocupa uma linha; tema, versão e "Sair" estão no menu do usuário, que abre pelo teclado
   e fecha com Esc.
3. Orçamento, Parcerias e Projetos têm ícones diferentes e cores petróleo, lilás e oliva. O oliva
   não se confunde com o verde de "Tudo em dia" e de "Aprovado" nos dois temas (conferir também com
   simulação de daltonismo do navegador, sem depender só da cor: o nome e o ícone sempre vêm).
4. Nenhum grupo repete o nome do app (Projetos mostra "Ideias e projetos").
5. Na tela inicial, cada pendência tem o ícone e a cor do app, as do mesmo app estão juntas, e os
   cartões da grade têm a mesma altura.
6. A tela de entrada não cita "em breve, a avaliação diagnóstica"; o calendário mostra
   "Novembro de 2026".
7. O Painel geral do Orçamento tem a faixa "Neste painel" com 5 atalhos que levam às seções.
8. O "Resumo dos exercícios" mostra a sombra e a dica de que há mais colunas à direita.
9. No Painel geral, ao trocar o ano, barras e linhas se movem até os novos valores; ao abrir, elas
   aparecem crescendo. Com "reduzir movimento" ligado, tudo aparece direto e completo.
10. No celular, o menu continua abrindo como botão, os grupos recolhem e nada passa da largura.

## Cadastro do encarregado de dados (DPO) no Núcleo (proposta #168)

**Objetivo**: cada instituição registra no Elo quem é o seu encarregado de dados (DPO), como a LGPD
exige. O DPO pode ser **pessoa física** (alguém do quadro) ou **pessoa jurídica** (assessoria
externa). **Para quem**: a Diretoria cadastra e mantém; todas as pessoas que entram no Elo podem
ver quem é o encarregado e como falar com ele. **Origem**: pendência #69, respondida em 15/11/2026.
**Frentes**: telas e regras e dados. Sem infraestrutura. Muda o Núcleo (aba nova, permissão nova,
tela nova), a pedido da proposta. Não precisa de ADR: é uma aba comum do Núcleo.

### Usuários e permissões
| Quem | Vê | Altera |
| --- | --- | --- |
| Diretoria (`core.dpo.gerenciar`, nova, escopo global) | Nome, documento e e-mail, atual e histórico | Cadastra, corrige e troca |
| Qualquer pessoa logada | Só nome e e-mail do encarregado atual (na página Ajuda) | Nada |
| Administrador da plataforma | Como qualquer pessoa logada | Nada (a Diretoria é dona deste dado) |

`PERMISSOES_INICIAIS` ganha `{ perfil: 'diretoria', permissao: 'core.dpo.gerenciar' }`; "Preparar
estrutura" já grava permissões novas em planilhas existentes.

### Entidade: aba `Encarregados` (planilha `nucleo`, `definirTabela`)
| Coluna | Tipo | Sigilo |
| --- | --- | --- |
| `nome` | texto obrigatório (pessoa ou razão social) | — |
| `tipo` | `fisica` ou `juridica` (obrigatório) | — |
| `documento` | só dígitos, 11 (CPF) ou 14 (CNPJ) | `pessoal` |
| `email` | e-mail válido, minúsculas | — |
| `inicio` | data em que passou a valer | — |
| `fim` | data em que deixou de valer (vazio = atual) | — |

Usa as colunas-padrão (`ativo`, versão). Nada é apagado: trocar o encarregado encerra o registro
anterior (`fim`, `ativo = FALSE`) e cria outro.

### Regras de negócio (cada uma com teste)
1. Só quem tem `core.dpo.gerenciar` cadastra, corrige ou troca; quem não tem recebe `ErroPermissao`
   (testar Diretoria, Administrador, Financeiro e Leitura).
2. Existe no máximo **um encarregado atual** (sem `fim`). Cadastrar com outro já atual é recusado
   com a mensagem "Já existe um encarregado. Use Trocar encarregado."
3. O tipo decide o documento: `fisica` exige CPF com 11 dígitos e dígitos verificadores corretos;
   `juridica` exige CNPJ com 14 dígitos e dígitos verificadores corretos. O que a pessoa digita
   pode ter pontos, barra e traço; grava-se só dígitos.
4. E-mail obrigatório e válido. Nome obrigatório.
5. **Corrigir dados** altera o registro atual (com a versão lida) e audita as colunas alteradas.
6. **Trocar encarregado** encerra o atual com `fim` = data da troca e cria o novo com `inicio` igual
   a essa data, nas duas gravações auditadas. A data não pode ser anterior ao `inicio` do atual.
7. Auditoria (`registrarAuditoria`) em toda gravação, com as colunas, nunca os valores. Abrir a tela
   de administração, que mostra o documento (coluna `pessoal`), registra `acao: 'leitura'`. A
   página Ajuda mostra só nome e e-mail e não gera auditoria.
8. A leitura para a página Ajuda passa pelo `Autorizador`: devolve apenas `nome` e `email`, nunca
   `documento`, para quem não tem a permissão (testar que o documento não vaza).
9. Sem encarregado cadastrado, a Ajuda mostra o aviso da seção Telas; nada quebra.
10. A demonstração começa **sem** encarregado (para a Diretoria ver o estado vazio); os testes usam
    dados de `tests/apoio/planilhas-teste.ts`, com CPF e CNPJ de teste válidos gerados no próprio teste.

### Telas
**Administração › Encarregado de dados** (`/admin/encarregado`), no menu Administração para quem
tem a permissão.
1. **Quem e caminho**: a Diretoria quer registrar ou trocar o encarregado. Cadastro inicial: 2
   cliques (abrir o formulário, enviar). Trocar: 2 cliques e a confirmação.
2. **Primeira dobra**: `CabecalhoPagina` ("Encarregado de dados", "A LGPD pede que a instituição
   indique quem cuida dos dados pessoais e recebe pedidos dos titulares."). Abaixo, o cartão do
   encarregado atual (nome, tipo, documento, e-mail, "desde dd/mm/aaaa"). Ações: **Corrigir dados**
   e **Trocar encarregado**. Depois, o histórico em `TabelaDados` (nome, tipo, de, até).
3. **Componentes de `src/ui/`**: `CabecalhoPagina`, `JanelaFormulario`, `Campo`, `BotaoEnviar`,
   `FormularioConfirmado`, `TabelaDados`. Nenhuma peça nova.
4. **Estados**:
   - Vazio: "Nenhum encarregado cadastrado. Cadastre quem a instituição indicou para a LGPD." e o
     botão **Cadastrar encarregado**.
   - Gravando: "Salvando…". Gravou: "Encarregado salvo." Erro: a mensagem da regra (ex.: "CPF
     inválido. Confira os 11 números."), com o formulário aberto e o que foi digitado mantido.
   - Conflito de versão (outra pessoa mexeu): "Os dados mudaram enquanto você editava. Reabra e
     tente de novo."
   - Sem permissão: redireciona para o início, como as demais telas de administração.
5. **Formulário**: campos `Tipo` (opções "Pessoa física" e "Pessoa jurídica", obrigatório), `Nome`
   ("Nome da pessoa" ou "Razão social", muda conforme o tipo), `CPF` ou `CNPJ` (rótulo muda com o
   tipo; dica "Pode digitar com pontos e traço."), `E-mail` (dica "Para onde os titulares vão
   escrever."). Na troca, também `Data da troca` (hoje por padrão).
6. **Ação sem volta**: **Trocar encarregado** pede confirmação: "O encarregado atual será
   encerrado nesta data e o novo passa a valer. O histórico fica guardado."
7. **Celular e teclado**: campos em coluna única; cartão e ações empilham; ordem do teclado: tipo,
   nome, documento, e-mail, enviar; a janela fecha com Esc.
8. Sem gráficos.

**Ajuda** (`/ajuda`): bloco novo "Encarregado de dados (LGPD)" com nome e e-mail como link
`mailto:`. Sem cadastro: "A instituição ainda não indicou o encarregado de dados." Para a Diretoria
o aviso acrescenta o link "Cadastrar".

**Sugestões de melhoria (a Diretoria decide)**: (a) avisar a Diretoria no início quando não há
encarregado; (b) usar nome e e-mail do encarregado no termo de adesão e na política de privacidade
(hoje `[a preencher]`); (c) campo de telefone.

### Fica de fora
Termo de adesão e política de privacidade preenchidos automaticamente; avisos ao titular; registro
de pedidos de titulares; DPO da Operadora (é da Rede, `docs/especificacao-rede.md`); ligar o
encarregado a uma `Pessoa` do Cadastro Único.

### Entregas
Uma só, pequena: aba, permissão, casos de uso com testes, tela de administração e bloco na Ajuda.
Arquivos prováveis: `src/nucleo/estrutura/tabelas.ts` (`Encarregados` em `TABELAS_DO_NUCLEO`),
`dados-iniciais.ts`, `src/nucleo/encarregado/` (casos de uso e testes), `src/app/(elo)/admin/
encarregado/`, `src/app/(elo)/ajuda/page.tsx`, menu de Administração, manual.

### Critérios de pronto (conferência na prévia)
1. Como Diretoria, em Administração aparece "Encarregado de dados" com o estado vazio.
2. Cadastrar pessoa física com CPF inválido mostra o erro e mantém o que foi digitado; com CPF
   válido, salva e o cartão aparece.
3. Trocar por uma pessoa jurídica (CNPJ válido) mostra o novo no cartão e o anterior no histórico.
4. Em Ajuda, qualquer perfil vê nome e e-mail, sem o documento.
5. Perfis sem a permissão não veem o item de menu e são redirecionados ao abrir o endereço.
6. `npm run verificar` e `npm run build` verdes.

### Decisões tomadas sozinho (e o custo se estiverem erradas)
- **Só a Diretoria altera** (a proposta diz "Diretoria"). Se o Administrador também deveria, é uma
  linha em `PERMISSOES_INICIAIS`.
- **Histórico em vez de sobrescrever** (regra "nada é apagado"). Se bastar um registro só, é uma
  simplificação pequena, mas se descobrirmos depois que precisávamos do histórico não dá para
  recuperá-lo.
- **Documento com sigilo `pessoal` e fora da Ajuda**: CPF de pessoa física é dado pessoal. Se a
  Diretoria quiser o documento público (CNPJ costuma ser), muda só a Ajuda.
- **Validação dos dígitos verificadores** do CPF e do CNPJ. Custo: recusa documentos de teste
  inventados; os testes geram números válidos.
- **E-mail do encarregado visível a todos os logados** (a LGPD pede divulgação dos dados de contato).
- **Demonstração sem encarregado**, para mostrar o estado vazio.
