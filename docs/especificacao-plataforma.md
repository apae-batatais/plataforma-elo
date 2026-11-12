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
- [ ] Capacidade de Indicadores (cálculo e painel)

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
