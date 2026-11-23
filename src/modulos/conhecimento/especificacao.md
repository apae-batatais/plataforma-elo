# Especificação — Módulo Base de Conhecimento

- Situação: aprovada (proposta #231); as 4 entregas construídas (publicação e ciência; teste de compreensão; curtir e comentar; aviso por e-mail). Na planilha, a "versão" do conteúdo chama-se `edicao` (a coluna `versao` das abas é o controle de gravação)
- Dono do produto: Diretoria
- Decisão de arquitetura: ADR-039
- Id do módulo: `conhecimento` · planilha `conhecimento` · rota `/conhecimento` (nome na tela: Base de Conhecimento)

## Objetivo

Um lugar único para publicar comunicados, normas e material de referência aos colaboradores, com
registro confiável de quem recebeu, leu e confirmou. Cada publicação pode exigir, de forma
independente, **ciência** ("li e estou de acordo") e **teste de compreensão** (poucas perguntas de
múltipla escolha). Prova de sucesso: publicar algo exigindo os dois e ver, depois, exatamente quem
está em dia e quem não está.

Para quem: todo colaborador lê, dá ciência, faz o teste, curte e comenta; quem publica (Secretaria
Executiva, RH, Comunicação) cadastra e acompanha; a Diretoria acompanha quem está em dia.

## Usuários e permissões

| Perfil | Pode | Permissão |
| --- | --- | --- |
| Todos os perfis (inclusive `funcionario`) | Entrar, ler as publicações do seu público, dar ciência, fazer o teste, curtir, comentar, ver "Meus documentos" | `conhecimento.acessar`, `conhecimento.ler` |
| Editor da Base de Conhecimento (perfil novo) | Cadastrar categorias; criar, editar, arquivar publicações; esconder comentários; acompanhar quem está em dia | `conhecimento.publicar`, `conhecimento.acompanhar` |
| Diretoria | Tudo do editor, sem cadastrar categorias | `conhecimento.publicar`, `conhecimento.acompanhar` |
| Administração da plataforma | Cadastrar categorias; escolher quem é editor (atribui o perfil, como em qualquer perfil) | `conhecimento.categorias.gerenciar` |

Regras de quem vê quem:

- **Publicação:** só quem pertence ao público-alvo (ou quem tem `conhecimento.publicar`) vê a
  publicação, o anexo e o teste. Rascunho só o editor vê.
- **Quem deu ciência e o resultado do teste de cada pessoa** (nome e data) só aparecem para
  `conhecimento.acompanhar`. A pessoa vê o próprio registro em "Meus documentos". Colega nunca vê o
  registro do outro; só o total de curtidas e os comentários.
- **Gabarito:** a resposta certa nunca vai ao navegador antes do envio das respostas; a conferência
  é feita na camada de aplicação.

## Entidades (planilha `conhecimento`)

Planilha própria do app. Nenhuma coluna guarda dado de atendido; as colunas com e-mail de pessoa são
`sigilo: 'pessoal'`.

| Aba | O que guarda | Sigilo |
| --- | --- | --- |
| `Categorias` | `codigo`, `nome`, `ativo` | — |
| `Publicacoes` | `id`, `titulo`, `categoria`, `resumo`, `corpo` (texto), `anexo_id` (arquivo no Drive, opcional), `anexo_nome`, `publico_tipo` (`todos`, `perfil` ou `area`), `publico_valor` (código do perfil ou da área), `exige_ciencia`, `tem_teste`, `versao`, `situacao` (`rascunho`, `publicada`, `arquivada`), `autor`, `publicada_em`, `ativo` | `autor`: pessoal |
| `Perguntas` | `publicacao_id`, `versao`, `ordem`, `texto`, `opcoes` (JSON, 2 a 5 opções), `correta` (posição da opção certa), `ativo` | `correta`: sensivel |
| `Ciencias` | `publicacao_id`, `versao`, `usuario`, `registrada_em` (data e hora do servidor), `ativo` | `usuario`: pessoal |
| `TentativasTeste` | `publicacao_id`, `versao`, `usuario`, `feita_em`, `acertos`, `total`, `aprovada` (somente inclusão) | `usuario`: pessoal |
| `Curtidas` | `publicacao_id`, `usuario`, `ativo` (descurtir = `ativo = FALSE`; curtir de novo reativa a mesma linha) | `usuario`: pessoal |
| `Comentarios` | `id`, `publicacao_id`, `usuario`, `usuario_nome`, `texto`, `criado_em`, `ativo` (esconder = `ativo = FALSE`), `escondido_por`, `escondido_em` | `usuario`: pessoal |

Toda aba é declarada com `definirTabela` e registrada para "Preparar estrutura". Nada é apagado
(regra 6): arquivar publicação, esconder comentário, descurtir e desativar categoria só mudam
`ativo`/`situacao`. A auditoria (regra 7) grava as colunas alteradas, nunca os valores. Abrir uma publicação não gera
auditoria de leitura (conteúdo institucional, não sensível); a **consulta ao acompanhamento por pessoa**
registra `acao: 'leitura'`.

## Regras de negócio (com teste)

Publicação
1. Só quem tem `conhecimento.publicar` cria, edita e arquiva publicação. Sem a permissão, nenhuma
   gravação acontece.
2. Publicação exige título, categoria ativa e público-alvo, além de corpo em texto **ou** anexo (ou
   os dois). Sem nenhum dos dois, não grava.
3. Anexo: PDF (até 10 MB) ou imagem JPG, PNG ou WebP (até 1,5 MB, reduzida no navegador como em
   Requisições). Um anexo por publicação. Fica no Drive da instituição e só é entregue pela rota do
   Elo a quem vê a publicação (ADR-014).
4. Público-alvo: `todos` = todo usuário ativo da instituição com acesso ao app; `perfil` = quem
   tem atribuição ativa com aquele perfil (qualquer escopo); `area` = quem tem atribuição ativa
   com escopo naquela área. Quem entra no público depois da publicação passa a ver a publicação e
   a pendência (não é preciso republicar).
5. Rascunho não notifica, não gera pendência e não aparece para o público. "Publicar" muda para
   `publicada` e registra `publicada_em` (hora do servidor).
6. Publicação arquivada some da lista e das pendências, mas continua no acompanhamento e em "Meus
   documentos" de quem já deu ciência. Reativar é possível.

Versão
7. Editar **título, resumo, categoria, público ou anexo** não muda a versão. Editar **corpo ou o
   teste** de uma publicação que já tem ciência ou tentativa pede uma escolha explícita: "Correção
   pequena (as ciências já dadas continuam valendo)" ou "Nova versão (todos precisam dar ciência
   de novo)". Nova versão soma 1 em `versao`, cria novas perguntas (as da versão anterior ficam
   com o histórico) e volta todos a pendentes.
8. Cada ciência e cada tentativa guardam a versão a que se referem; o acompanhamento diz "em dia
   na versão atual", "em dia na versão anterior (precisa renovar)" ou "pendente".

Ciência
9. Exige `exige_ciencia = TRUE` e público-alvo: só quem é do público dá ciência. Ao confirmar, o
   Elo grava `usuario` (da sessão, nunca de campo enviado), `versao` e `registrada_em` (hora do
   servidor, sem geolocalização e sem carimbo ICP-Brasil).
10. A ciência não se desfaz nem se repete na mesma versão: dar ciência duas vezes não cria segunda
    linha. Não há "retirar ciência" pela pessoa; só a nova versão reabre a pendência.
11. Se a publicação também tem teste, a ciência só é aceita **depois da aprovação no teste** da
    versão atual (o botão fica desativado, com o motivo escrito). A pendência some quando todas as
    exigências da publicação estão cumpridas.

Teste de compreensão
12. Teste vale só com `tem_teste = TRUE` e de 1 a 10 perguntas, cada uma com 2 a 5 opções e
    exatamente uma correta. Publicação com teste ligado e sem pergunta válida não pode ser publicada.
13. A pessoa pode tentar quantas vezes quiser. Cada tentativa é gravada (acertos, total, aprovada)
    e **aprovada = todas certas**. Errar não avisa ninguém. A tela mostra quantas acertou e **quais
    perguntas errou, sem revelar a resposta certa** (para formar, sem virar cola).
14. Perguntas e opções aparecem na ordem cadastrada (nesta entrega, sem embaralhar).

Curtir e comentar
15. Uma curtida por pessoa por publicação; curtir de novo depois de descurtir reativa a mesma
    linha. Só quem vê a publicação curte.
16. Comentário tem de 1 a 1.000 caracteres, grava nome, data e hora. Só aparece o comentário com
    `ativo = TRUE`. Quem tem `conhecimento.publicar` esconde qualquer comentário (grava quem e
    quando); pode reativar. A pessoa não edita nem apaga o próprio comentário nesta entrega.
17. Publicação arquivada não recebe curtida nem comentário novos.

Acompanhamento e "Meus documentos"
18. "Meus documentos" mostra, para a pessoa, as publicações do seu público que exigem algo: pendentes
    primeiro, depois as em dia (com a data da ciência e do teste). Publicação sem exigência não
    entra (fica só na biblioteca).
19. O acompanhamento (`conhecimento.acompanhar`) de uma publicação lista cada pessoa do público com
    a situação (em dia, precisa renovar, pendente), a data da ciência e a melhor tentativa do teste,
    e o total "X de Y em dia". Pessoas sem e-mail de usuário ativo não entram.
20. Pendência: quem é do público de uma publicação que exige algo e ainda não cumpriu vê a
    pendência na tela inicial do Elo, agrupada no app "Base de Conhecimento" (mesmo padrão de
    Requisições, `src/plataforma/pendencias.ts`). Pendência de publicação **com mais de 15 dias
    sem cumprir** ganha a marca de vencida (anel do app, como hoje). O prazo de 15 dias é fixo
    nesta entrega (decisão tomada sozinho; ver abaixo).

Aviso por e-mail (entrega 4)
21. Ao publicar algo que exige ciência ou teste, o Elo grava um envio por e-mail na aba `Envios`
    (ADR-027) para o público-alvo, em cópia oculta, com texto genérico e o link do Elo ("Há um
    documento novo para você ler na Base de Conhecimento"), sem título nem conteúdo. Sem remetente
    cadastrado, nada sai por e-mail e o editor vê o aviso; a pendência na tela inicial funciona
    do mesmo jeito.
22. O e-mail sai uma única vez por publicação e versão (envio idempotente). Nova versão avisa de novo.

## Telas

Rotas dentro de `/conhecimento`. O menu do app: **Biblioteca**, **Meus documentos**,
**Acompanhamento** (só `acompanhar`), **Publicações** e **Categorias** (só quem gerencia).

### 1. Biblioteca (início do app)
- **Quem e o quê:** colaborador que quer achar e ler um documento. Caminho mais curto: abrir o app
  → clicar no cartão da publicação (2 cliques).
- **Primeira dobra:** faixa "Falta você" com as pendências (título, o que falta: "Dar ciência",
  "Fazer o teste") e o botão **Abrir** em cada uma; abaixo, filtros em pílulas por categoria,
  campo de busca por título e a lista de cartões (título, categoria, resumo, etiqueta de situação
  da própria pessoa: "Pendente", "Em dia", "Sem exigência", data).
- **Peças:** `CabecalhoPagina`, `Secao`, `Etiqueta`, `EstadoVazio`, `Aviso`, filtros em pílulas;
  `cartao-brilho` nos cartões.
- **Estados:** vazio ("Ainda não há publicações para você. Quando alguém publicar, aparece aqui."; para
  editor, com o botão "Nova publicação"); busca sem resultado ("Nenhuma publicação com esse texto.
  Limpe a busca para ver todas."); sem permissão (padrão do Elo).
- **Celular/teclado:** cartões em coluna única; ordem: pendências, busca, filtros, cartões.

### 2. Publicação (ler, ciência, teste, curtir e comentar)
- **Primeira dobra:** título, categoria, autor e data; resumo; corpo; link/visualização do anexo
  ("Abrir PDF" ou a imagem). Se exige algo, **cartão fixo "O que falta"** no topo (celular: no topo
  da página, não fixo) com a ação principal: **"Fazer o teste"** (quando há teste não aprovado) ou
  **"Li e estou de acordo"** (ciência). Cumprido, o cartão vira "Em dia desde <data>".
- **Teste (entrega 2):** perguntas numeradas, uma opção por pergunta (rádio), botão **Enviar
  respostas**. Resultado na mesma tela: "Você acertou 3 de 4. Revise as perguntas 2 e tente de
  novo." com o botão **Tentar de novo**; ao acertar tudo, `Aviso` verde "Você acertou todas. Agora
  confirme que leu e está de acordo." (se exige ciência). Respostas já marcadas permanecem se o
  envio falhar.
- **Ciência (ação sem volta):** `FormularioConfirmado` explica: "Isto registra que você leu e está
  de acordo, com seu nome, data e hora. Não dá para desfazer." Botão **Confirmar ciência**.
- **Curtir e comentar (entrega 3):** botão "Curtir" (alterna, mostra o total, com o texto "Curtida"
  quando marcada, nunca só cor/ícone); comentários em ordem do mais antigo, com nome e data; campo
  "Escreva um comentário" (dica: "Até 1.000 caracteres") e **Comentar**. Editor vê em cada
  comentário "Esconder" (com confirmação: "O comentário some para todos; fica guardado e pode ser
  reativado").
- **Estados:** gravando (`BotaoEnviar`), gravou (`?ok=` "Ciência registrada"), erro (`?erro=`;
  o texto digitado do comentário permanece), sem permissão ou fora do público ("Esta publicação
  não é para o seu perfil").
- **Teclado:** perguntas e opções navegáveis por Tab e setas; foco visível; áreas de 44 px.

### 3. Meus documentos
- Tabela com `TabelaDados` (título, categoria, situação, ciência em, teste em). Pendentes primeiro,
  com o botão **Abrir**. Vazio: "Nada exige sua ciência por enquanto."

### 4. Acompanhamento (`conhecimento.acompanhar`)
- **Quem e o quê:** quem publicou quer saber quem falta. Primeira dobra: lista de publicações
  que exigem algo com **"X de Y em dia"** (`NumeroQueConta`, com a frase) e uma barra de
  progresso (`graficos.tsx`: indicador de proporção, uma série, cor do app); clicar abre a
  lista de pessoas (nome, situação em `Etiqueta`, data da ciência, melhor tentativa).
- Filtros em pílulas "Pendentes", "Precisam renovar", "Em dia". Não há exportação nesta entrega.
- Vazio: "Nenhuma publicação exige ciência ou teste ainda."
- Abrir a lista de pessoas de uma publicação registra auditoria de leitura.

### 5. Publicações (editor)
- Lista (`TabelaDados`) com situação (rascunho, publicada, arquivada), versão e "X de Y em dia",
  botão principal **Nova publicação**.
- **Formulário** (`Campo`, rótulo sempre visível): Título* ; Categoria* ; Resumo (dica: "Uma ou duas
  frases que aparecem na lista"); Texto; Anexo (PDF ou imagem, com o limite escrito); Quem deve
  ler* (Todos, Um perfil, Uma área; o segundo campo aparece conforme a escolha); caixa **Exige
  ciência** ("A pessoa confirma que leu e está de acordo"); caixa **Tem teste de compreensão**
  ("A pessoa precisa acertar todas as perguntas"), que abre o editor de perguntas (texto, 2 a 5
  opções, marcar a correta, "Adicionar pergunta", "Remover pergunta"). Botões: **Salvar rascunho**
  e **Publicar** (grafite). Erro mantém tudo o que foi digitado.
- Ao editar o corpo ou o teste de publicação com ciência/tentativas: a escolha da regra 7 em
  janela, com a contagem ("42 pessoas já deram ciência").
- **Arquivar** (ação sem volta com reativação): `FormularioConfirmado` explica que some das listas
  e das pendências e que o registro de ciências é mantido. Arquivadas ficam em `Excluidos` com
  "Reativar".

### 6. Categorias
- Lista simples com "Nova categoria" e "Desativar" (`FormularioConfirmado`; categoria com
  publicações ativas não pode ser desativada: "Mova ou arquive as publicações antes").

### Componentes
Tudo com peças já existentes de `src/ui/`. **Nenhuma peça nova no Núcleo** (o envio de arquivo reusa
o fluxo de `arquivos/envio`; ver "Mudanças fora da pasta do módulo").

### Melhorias de experiência (sugestões, para a Diretoria decidir)
1. Lembrete por e-mail para quem segue pendente depois de alguns dias (hoje só aviso na publicação
   e a pendência na tela inicial).
2. Embaralhar a ordem das opções do teste a cada tentativa.
3. Botão "Exportar lista de ciências" (para anexar a um processo), ainda sem carimbo ICP-Brasil.
4. Editar o próprio comentário por 10 minutos.

## Mudanças fora da pasta do módulo (precisam da aprovação da Diretoria)

1. **Registro do app:** `src/plataforma/registro-modulos.ts`, ícone em `src/plataforma/icones-dos-apps.ts`
   e `src/ui/icones.tsx` (ícone novo, "livro" ou "biblioteca"), cor em `src/app/globals.css` e em
   `docs/identidade-visual.md`. **A cor precisa ser testada nos dois temas e comparada com as dos
   apps existentes antes de entrar; a escolha final é da Diretoria na prévia.**
2. **Rotas** em `src/app/(elo)/conhecimento/` e a rota de leitura do anexo.
3. **Envio de PDF:** a rota `arquivos/envio` e o armazenamento de arquivos hoje aceitam foto e
   vídeo; passa a aceitar também `application/pdf`, conferido no servidor. É uma extensão pequena
   do Núcleo (`src/nucleo/armazenamento/arquivos.ts` e a rota), sem mudar o contrato.
4. **Pendências e anel da tela inicial:** o app informa suas pendências pelo mesmo canal dos outros
   (`src/app/(elo)/page.tsx`, `pendencias-vencidas.ts`).
5. **Perfil novo** "Editor da Base de Conhecimento" (`editor_conhecimento`), criado pelo
   "Preparar estrutura" pelo manifesto, como os perfis de Requisições.
6. **Ajuda** (`src/app/(elo)/ajuda/`): passo a passo de cada tela, por perfil (metodologia, 21/11/2026).
7. **Sem nomes próprios** nos textos, nos dados fictícios e na Ajuda.

## Eventos
Nenhum nesta proposta (`publica: []`, `consome: []`).

## Indicadores
Nenhum indicador da plataforma nesta proposta. "X de Y em dia" é número da tela de
Acompanhamento, calculado ao abrir.

## Fica de fora (vai para o `docs/roadmap.md`)
- Geolocalização na ciência e carimbo de tempo ICP-Brasil (já combinados pela Diretoria).
- Vídeo e mais de um anexo por publicação; link externo como formato.
- Prazo de ciência configurável por publicação e lembrete por e-mail.
- Limite de tentativas, nota mínima e aviso a terceiros em caso de erro (a Diretoria decidiu que
  não há).
- Exportar a lista de ciências; relatório por pessoa entre publicações.
- Editar ou apagar o próprio comentário; respostas a comentários.
- Notificar o editor de novos comentários.

## Frentes
- **regras e dados:** abas, permissões, casos de uso (publicar, versão, ciência, teste, curtir,
  comentar, acompanhar), auditoria, aviso por e-mail (entrega 4) e testes de quem vê e quem altera.
- **telas:** biblioteca, publicação, teste, meus documentos, acompanhamento, publicações,
  categorias, pendência na tela inicial, ícone e cor, Ajuda.
- **infraestrutura:** só a extensão para PDF no envio de arquivos e o uso da peça de e-mail e da
  rotina (ADR-027) na entrega 4.

## Entregas (ordem de construção)
Proposta com quatro entregas, cada uma conferível na prévia (as sub-issues são abertas pela
Diretoria ou pelo Desenvolvedor ao começar cada uma):
1. **Publicação e ciência:** módulo, categorias, publicações (texto e PDF/imagem), público-alvo,
   versão, ciência, biblioteca, "Meus documentos", acompanhamento, pendência na tela inicial.
2. **Teste de compreensão:** perguntas, tentativas, ciência só depois de aprovar, regras 11 a 14.
3. **Curtir e comentar:** regras 15 a 17.
4. **Aviso por e-mail:** regras 21 e 22, sobre a peça do ADR-027 (depende de a ligação de Requisições
   com o e-mail, PR #217, ter entrado, para reaproveitar o padrão de aviso).

## Decisões tomadas sozinho (com o custo se estiverem erradas)
1. **Nome técnico `conhecimento`** (planilha, rota, permissões). Custo: renomear depois mexe em
   planilhas já criadas.
2. **Versão da publicação** e a escolha "correção pequena × nova versão" (regra 7): a proposta não
   falava de edição depois da ciência, e sem isso a ciência perderia o valor de prova. Se a
   Diretoria preferir que editar nunca reabra a ciência, a regra 7 e a coluna `versao` saem.
3. **Quem edita é um perfil novo (Editor)** mais a Diretoria; a Administração atribui o perfil.
   Se a Diretoria quiser que RH ou Secretaria sejam perfis fixos, é só criar mais perfis.
4. **Público "perfil" ou "área"** vale pelas atribuições do Núcleo; atribuição global a um perfil
   conta para "perfil" mas não para "área". Se a instituição quiser outra regra de pertencimento
   (por exemplo, por unidade), é nova coluna.
5. **Com teste e ciência juntos, a ciência só vale depois de aprovado no teste.** Se a Diretoria
   quiser os dois independentes na mesma publicação, remove-se a regra 11.
6. **Mostrar quais perguntas errou, sem revelar a certa** (regra 13). Se quiser mostrar o gabarito,
   é troca de texto e de regra.
7. **Prazo de 15 dias** para a pendência virar "vencida" (anel do app), fixo. Custo: se for outro
   prazo, é constante a mudar; se quiser por publicação, vira coluna e entra no roadmap.
8. **Anexo: um por publicação, PDF até 10 MB, imagem até 1,5 MB.** Custo: limite diferente é ajuste.
9. **Quem edita publicações esconde qualquer comentário** (a proposta diz "quem publicou"). Custo:
   restringir ao autor é uma condição a mais.
10. **E-mail só na entrega 4** e com texto genérico, sem título (o título de uma norma pode ser
    sensível dentro de e-mail). A pendência na tela inicial vem desde a entrega 1.
11. **Cor e ícone do app** ficam para testar na prévia (ver acima).

## Critérios de pronto (na prévia, com dados fictícios)
- [ ] Como Editor: criar categoria, publicar um texto e um PDF para "Todos" exigindo ciência.
- [ ] Como colaborador: ver a pendência na tela inicial, abrir, dar ciência e ver "Em dia"; tentar
      dar ciência duas vezes não duplica.
- [ ] Publicação com teste: errar mostra quais perguntas errou sem a resposta; acertar tudo libera
      a ciência.
- [ ] Editar o corpo com ciências dadas pede a escolha; "nova versão" volta todos a pendentes.
- [ ] Publicação para um perfil ou área só aparece para quem é do público.
- [ ] Acompanhamento mostra "X de Y em dia" e quem falta; colega não vê o registro do outro.
- [ ] Curtir/descurtir e comentar; editor esconde e reativa comentário.
- [ ] Tema claro e escuro, celular e teclado; Ajuda atualizada; sem nomes próprios.
- [ ] Testes de quem vê e quem altera para cada aba; `npm run verificar` e `npm run build` verdes.
