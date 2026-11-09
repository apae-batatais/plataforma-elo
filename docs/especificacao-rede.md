# Especificação — Várias instituições no Elo (Rede)

Decisão de arquitetura: ADR-012. Este documento descreve o que muda para quem usa.
"Instituição" é cada Apae ou entidade que usa o Elo, inclusive a Apae Batatais.
"Operadora" é quem mantém o Elo: hoje a Apae Batatais; no futuro, uma empresa.

## Quem faz o quê
| Quem | O que faz |
| --- | --- |
| Administração da rede (Operadora) | Cadastra, confere, prepara a estrutura, suspende e reativa instituições; publica atualizações e roda "Preparar estrutura de todas" depois delas; dá suporte técnico. Não vê dados das instituições |
| TI ou Diretoria da instituição | Cria o endereço `elo.<domínio>` no DNS, cria as planilhas no próprio Drive e compartilha com a conta de serviço |
| Administração da plataforma (de cada instituição) | Pode rodar "Preparar estrutura" da própria instituição; cadastra unidades, áreas, serviços e acessos da sua instituição |

## Telas novas
1. **Rede › Instituições** (só Administração da rede, no endereço da Operadora):
   lista com situação, endereço, domínio e estado das planilhas (encontradas,
   compartilhadas, estrutura em dia). Ações: cadastrar, alterar, suspender, reativar.
2. **Cadastro de uma instituição**: nome curto, razão social, domínio de e-mail,
   endereços de acesso, unidades iniciais, IDs das planilhas e e-mails dos
   administradores iniciais. Botão **Conferir** testa cada planilha e mostra o
   que falta, em português, sem gravar nada. Na conferência, **Preparar
   estrutura** cria as abas e a configuração inicial (unidades do cadastro,
   áreas, perfis e permissões), com auditoria na rede e na instituição.
   **Preparar estrutura de todas** faz o mesmo nas ativas e em preparação.
3. **Endereço não cadastrado** (pública): explica que o endereço não pertence a
   nenhuma instituição do Elo, sem mostrar dados.

## Passo a passo para uma instituição nova
1. A Administração da rede cadastra a instituição ("em preparação").
2. A instituição cria `elo.<domínio>` no DNS (CNAME); a Operadora inclui o
   endereço na Netlify e no cliente OAuth do Google.
3. A instituição cria as planilhas no próprio Drive e compartilha com a conta de serviço.
   A partir da R4: cria só o Drive compartilhado "Elo · <instituição>", inclui a conta de
   serviço como Gerente de conteúdo e envia o link.
4. A Administração da rede cola os IDs, usa **Conferir** e, na conferência, **Preparar
   estrutura**. A partir da R4: cola só o link da pasta e salva; o Elo confere e prepara sozinho.
   Com a estrutura em dia, clica em **Ativar**.
5. O administrador inicial entra com tudo pronto e cadastra a organização e os acessos.

## Regras (com teste)
1. Cada requisição usa só as planilhas da instituição do endereço acessado.
2. Login só com e-mail do domínio da instituição do endereço; a sessão de uma não vale em outra.
3. Instituição suspensa: ninguém entra; os dados continuam no Drive dela.
4. A Administração da rede não vê pessoas, folha nem orçamento de nenhuma instituição, inclusive da Apae Batatais.
5. Nada de uma instituição fica fixo no código: nome, domínio, unidades e áreas vêm do cadastro.
6. Toda alteração no cadastro da Rede registra auditoria (colunas, nunca valores).
7. Sem a planilha `rede`, o Elo funciona como hoje, com uma instituição só.

## Manual e Ajuda
Cada entrega atualiza o manual e a tela Ajuda no mesmo Pull Request, só com o
que já existe:
- R1: "Primeiros passos" explica o endereço próprio de cada instituição.
- R2: capítulo "Administração da rede" (visível só para esse perfil).
- R3: guia à parte "Como trazer uma instituição para o Elo" e termo de adesão.

## Demonstração
Duas instituições fictícias e uma Operadora fictícia, para conferir na prévia que uma
instituição não vê a outra e que a Administração da rede não vê dados de nenhuma.

Nomes na demonstração e nas prévias (decisão da Diretoria na proposta #72; nenhum deles
leva "Apae"):

| O que | Nome | Nome por extenso (tela de entrada) |
| --- | --- | --- |
| Instituição fictícia 1 (código `exemplo`) | Instituição Operadora | Instituição Operadora (fictícia) |
| Instituição fictícia 2 (código `modelo`) | Instituição Modelo | Instituição Modelo (fictícia) |
| Operadora fictícia (Administração da rede) | Instituição Operadora da Plataforma | — |

Valem só para a demonstração e as prévias; as instituições reais não mudam.

## Configuração na hospedagem (R1)
Até a R2, as instituições ficam nas variáveis da Netlify (contas da Operadora):

- **Uma instituição** (como hoje): `DOMINIO` (obrigatório), `PLANILHAS`,
  `ADMINISTRADORES_INICIAIS`, `INSTITUICAO_NOME` e `INSTITUICAO_RAZAO_SOCIAL`.
  Atende qualquer endereço.
- **Várias**: `INSTITUICOES`, uma lista em JSON. Cada item: `codigo`, `nome`,
  `nomeCompleto`, `dominio`, `enderecos` (ex.: `["elo.apaefranca.org.br"]`),
  `planilhas` (`nucleo`, `auditoria` e as dos módulos), `administradoresIniciais`,
  `unidades` (opcional) e `situacao` (`ativa`, `preparacao` ou `suspensa`).
  Endereço que não está na lista mostra "Endereço não cadastrado".

As credenciais (`GOOGLE_CONTA_SERVICO`, `GOOGLE_CLIENT_ID`, `SESSAO_SEGREDO`)
são da Operadora e valem para todas. Na R2, a lista sai das variáveis e passa
para a planilha `rede`, com a tela de cadastro.

## Configuração da Operadora (R2)
A Operadora cria a planilha da rede no próprio Drive (em branco), compartilha
com a conta de serviço e cadastra na Netlify a variável `REDE`:

```json
{"planilha":"<id da planilha da rede>","dominio":"<domínio dos e-mails da Operadora>",
 "enderecos":["rede.<domínio da Operadora>"],"administradores":["<e-mail>"]}
```

- `enderecos` (opcional): onde a área da rede abre (`/rede`). Vazio: em qualquer endereço do Elo.
- `administradores`: entram sempre, para a rede nunca ficar sem quem a administre;
  outros são incluídos na tela Administradores.
- As abas da planilha da rede (Instituicoes, Administradores, Registros) são criadas sozinhas no primeiro acesso.
- Enquanto a rede não tem instituições, valem as das variáveis da R1 (`DOMINIO`/`PLANILHAS` ou `INSTITUICOES`).
  Depois de cadastrar e ativar as instituições na rede, essas variáveis podem sair.
- Instituição "em preparação" ou "suspensa": ninguém entra pelo endereço dela; a página explica.

## Organização no Google Drive
O Elo acha cada planilha pelo ID; os nomes servem só para as pessoas. Padrão: "Elo · dono · conteúdo".

```
Drive compartilhado "Elo · Operadora"        (da Operadora; vai para a empresa na transferência)
└── Elo · Rede de instituições               (variável REDE)

Drive compartilhado "Elo · <instituição>"    (um por instituição, no Workspace dela)
├── Elo · <instituição> · Núcleo
├── Elo · <instituição> · Auditoria
├── Elo · <instituição> · Orçamento
└── Elo · <instituição> · Folha de pagamento
```

- Drive compartilhado, não pasta pessoal: os arquivos são da instituição, não de quem os criou.
- Em cada Drive compartilhado, a conta de serviço do Elo é membro como Administrador de conteúdo.
- Mover uma planilha no Drive não muda o ID: nada a reconfigurar.

## Migração das variáveis para a rede
1. Com a R2 publicada, cadastrar a Apae Batatais em /rede com os mesmos dados das variáveis
   (domínio, IDs das planilhas, administradores iniciais) e o endereço atual de acesso.
2. Conferir e Ativar. Enquanto não há instituição ativa na rede, as variáveis continuam valendo.
3. Retirar da Netlify `DOMINIO`, `PLANILHAS`, `ADMINISTRADORES_INICIAIS`, `INSTITUICAO_NOME`,
   `INSTITUICAO_RAZAO_SOCIAL` (e `INSTITUICAO_CODIGO`, se existir) e publicar de novo.
   Ficam só as da Operadora: `GOOGLE_CONTA_SERVICO`, `GOOGLE_CLIENT_ID`, `SESSAO_SEGREDO` e `REDE`.

## Entregas
- **R1**: descoberta da instituição pelo endereço; planilhas, login e sessão por
  instituição; nome, domínio e dados iniciais vindos do cadastro (sem Apae
  Batatais fixa no código); página de endereço não cadastrado; demonstração.
- **R2**: planilha `rede` da Operadora, perfil Administração da rede, telas de cadastro e conferência.
- **R3**: guia de adesão, termo de adesão (LGPD) e roteiro de transferência da Operadora
  (detalhe na seção "R3", no fim deste documento; proposta #58).
- **R4**: pasta única por instituição; o Elo cria as próprias planilhas (ADR-018). Detalhe abaixo.

## R4 · Pasta única (proposta completa, aguarda aprovação)

Decisão de arquitetura: ADR-018. Decisão da Diretoria (07/11/2026): um Drive compartilhado por
instituição, com membros restritos.

### O que muda para quem usa
- **Cadastro da instituição**: os campos de ID de cada planilha saem. Entra o campo **Link da
  pasta** (aceita o link copiado do Drive ou o ID). Abaixo dele, a lista das planilhas do Elo com a
  situação de cada uma ("Criada", com o botão **Abrir**, ou "Será criada ao preparar a estrutura").
- **Conferir** (sem gravar nada): a pasta existe, está num Drive compartilhado e a conta de
  serviço pode criar arquivos nela; aponta em português o que falta. Também avisa se alguma
  planilha já criada foi para a lixeira.
- **Automático ao salvar o link** (decisão da Diretoria, 07/11/2026): a Administração da rede só
  cadastra o link. Ao salvar, o Elo confere a pasta e, se estiver tudo certo, prepara a estrutura
  sozinho, sem outro clique. Se algo falhar, a tela mostra o motivo e o botão **Tentar de novo**.
- **Preparar estrutura** (o que roda sozinho): para cada planilha necessária (Núcleo, Auditoria e as dos apps ativos) e
  para a pasta de anexos:
  1. se o cadastro já tem o ID e o arquivo existe, usa;
  2. senão, procura na pasta um arquivo com a marca do Elo para aquela planilha e usa;
  3. senão, cria "Elo · <nome curto da instituição> · <nome da planilha>" na pasta.
  Grava os IDs no cadastro (auditoria com as colunas alteradas) e cria as abas, como hoje.
  Ao fim, mostra o que foi criado e o que já existia.
- **Preparar estrutura de todas** (decisão da Diretoria, 07/11/2026): continua sendo um botão da
  Administração da rede, usado depois de publicar um app novo ou uma mudança de abas. Faz o mesmo
  em todas as instituições ativas e em preparação.
- **Aviso de estrutura desatualizada**: na lista de instituições da Rede, cada instituição em que
  falta planilha, pasta ou aba aparece com o aviso "Estrutura desatualizada" e o que falta; no
  topo da tela, quantas instituições estão nessa situação.
- **Acompanhamento pela Administração da rede**: ao salvar o link e ao preparar uma ou todas, a
  tela mostra o resultado por instituição: planilhas criadas (com o botão **Abrir**), planilhas
  que já existiam, abas criadas e falhas com o motivo. O mesmo resumo fica no registro da Rede
  (auditoria), com data e quem preparou.
- **Só a Administração da rede prepara a estrutura** (decisão da Diretoria, 07/11/2026). A
  Administração da plataforma de cada instituição perde a tela Estrutura e fica com Acessos,
  Áreas e Serviços. Exceção: no Elo sem a Rede (uma instituição só), a tela Estrutura continua com
  ela, porque não há Administração da rede.

### Instituições já cadastradas
- A Apae Batatais informa a pasta. As planilhas atuais continuam valendo (os IDs já estão no
  cadastro), mesmo fora da pasta. Na primeira preparação, o Elo põe a marca nelas.
- Mover as planilhas atuais para a pasta é opcional e não muda nada (o ID não muda).

### Regras (com teste)
1. Rodar "Preparar estrutura" duas vezes não cria planilha duplicada.
2. O Elo cria planilhas só dentro da pasta da instituição em preparação; nunca usa planilha
   marcada de outra instituição.
3. Os IDs criados são gravados no cadastro da instituição, com auditoria (colunas, nunca valores).
4. O Elo nunca apaga nem move planilha ou pasta.
5. Pasta fora de Drive compartilhado ou sem permissão de criar: nada é criado e a conferência
   explica o que fazer.
6. A Administração da rede continua sem ver dados das instituições: criar planilha vazia e abas
   não lê conteúdo.

### Demonstração
O armazenamento em memória simula a pasta: na prévia, cadastrar uma instituição fictícia só com o
link e ver as planilhas aparecerem como "Criada" depois de "Preparar estrutura".

### Fica de fora da R4
- Conferir quem é membro do Drive compartilhado: é responsabilidade da TI da instituição
  (decisão da Diretoria, 07/11/2026), com orientação no guia e no termo de adesão da R3.
- Criar o próprio Drive compartilhado: a conta de serviço não pode criar drives no Google
  Workspace da instituição.

## Nomes da demonstração (proposta #72)

**Objetivo**: nenhuma tela da demonstração ou da prévia mostra "Apae Exemplo" nem "Apae Modelo".
**Para quem**: a Diretoria, ao conferir prévias. **Frentes**: regras e dados (configuração do
Núcleo, a pedido da proposta) e telas (um texto no cabeçalho da rede).

### O que muda
1. `INSTITUICOES_DEMONSTRACAO` (`src/nucleo/config.ts`): `nome` e `nomeCompleto` passam para os
   textos da tabela da seção "Demonstração". Os códigos (`exemplo`, `modelo`), domínios e
   unidades não mudam, para não quebrar sessões, rotas e testes.
2. `REDE_DEMONSTRACAO` ganha o campo opcional `nome` ("Instituição Operadora da Plataforma"),
   usado só na demonstração. No cabeçalho da Administração da rede
   (`src/app/(rede)/rede/layout.tsx`), em demonstração, o nome aparece como identificação da
   Operadora fictícia (no lugar de "Rede de instituições" na marca). Em produção nada muda.
3. A tela de entrada e o seletor de instituição da demonstração usam os novos nomes
   automaticamente (leem `nome`/`nomeCompleto`).
4. Qualquer outro texto da demonstração que diga "Apae Exemplo" ou "Apae Modelo" é trocado
   (hoje só `config.ts`; o Desenvolvedor confere com busca no código, manual e Ajuda).

### Regras (com teste)
1. A demonstração tem duas instituições com nomes diferentes entre si, e nenhum nome ou nome
   por extenso contém "Apae" (teste em `tests/nucleo/instituicoes.test.ts`, que hoje confere os
   nomes antigos).
2. Uma instituição fictícia continua sem ver a outra (testes existentes seguem verdes).
3. A Operadora fictícia tem nome sem "Apae"; com a variável `REDE` (produção) o cabeçalho não
   mostra nome de demonstração.
4. Nenhuma regra de acesso, permissão ou aba muda.

### Fica de fora
Instituições, Operadora e dados reais; domínios `exemplo.local`; dados fictícios de pessoas.

### Critérios de pronto (na prévia)
- A tela de escolha/entrada mostra "Instituição Operadora (fictícia)" e "Instituição Modelo
  (fictícia)"; em nenhuma tela aparece "Apae Exemplo" ou "Apae Modelo".
- A Administração da rede mostra "Instituição Operadora da Plataforma".
- Entrar numa instituição continua sem mostrar dados da outra.

### Entrega
Uma só, pequena. Não exige ADR (não muda a arquitetura).

### Decisões tomadas sozinho
- **Manter os códigos `exemplo`/`modelo`**: se a Diretoria quiser códigos novos, é uma troca
  simples, mas apareceria nos endereços da prévia.
- **Mostrar o nome da Operadora no cabeçalho da rede só na demonstração**: se for errado, é
  trocar um texto.
- **Nomes parecidos ("Instituição Operadora" e "Instituição Operadora da Plataforma")**: foram
  escolhidos pela Diretoria; se atrapalhar a conferência, renomear é uma troca de texto.

## R3 · Guia de adesão, termo de adesão (LGPD) e transferência da Operadora

Proposta #58. É **documentação, não código**: nenhuma tela, aba ou regra do Elo muda.
Decisões de arquitetura já registradas nas ADR-012 (Operadora, LGPD), ADR-018 (pasta única e
membros restritos) e ADR-019 (roteiro do quadro). Não exige ADR nova.

**Objetivo**: ter escritos, e conferidos com o sistema, os três documentos que faltam antes da
primeira instituição nova com dados reais. **Para quem**: a Diretoria (Operadora hoje), a TI e a
Diretoria de cada instituição que aderir e, no futuro, a empresa que assumir a Operadora.

### Os três documentos (todos em `docs/`)

| Documento | Arquivo | Quem lê |
| --- | --- | --- |
| Guia "Como trazer uma instituição para o Elo" | `docs/guia-adesao-instituicao.md` | TI e Diretoria da instituição; Administração da rede |
| Termo de adesão (modelo, LGPD) | `docs/termo-adesao.md` | Diretoria da instituição e da Operadora; assessoria jurídica |
| Roteiro de transferência da Operadora | `docs/transferencia-operadora.md` | Operadora de hoje e a empresa de amanhã |

### 1. Guia "Como trazer uma instituição para o Elo"
Em português simples, na ordem em que as coisas acontecem:
1. **Antes de começar**: o que a instituição precisa ter (Google Workspace com domínio próprio,
   alguém da TI, alguém da Diretoria para assinar o termo).
2. **Termo de adesão**: assinar antes de qualquer dado real.
3. **Endereço**: criar `elo.<domínio>` no DNS (CNAME); a Operadora inclui o endereço na Netlify e
   no login do Google.
4. **Drive compartilhado** "Elo · <instituição>" (ADR-018): criar o drive, incluir a conta de
   serviço como Gerente de conteúdo, copiar o link da pasta e enviar.
5. **Restringir os membros do Drive** (pedido da proposta): quem é membro vê todas as planilhas,
   inclusive a de Avaliação (dado sensível). A TI da instituição deixa como membros só a conta de
   serviço e uma ou duas pessoas da TI ou da Diretoria; a equipe usa só o Elo. O Elo não confere
   os membros: a responsabilidade é da TI da instituição, que também revisa a lista quando
   alguém sair.
6. **O que a Operadora faz**: cadastra, o Elo confere e prepara sozinho (R4), e a Operadora clica
   em **Ativar**.
7. **Primeiro acesso** do administrador inicial: cadastrar organização e acessos.
8. **Suspensão e saída**: os dados continuam no Drive da instituição; nada é apagado.
9. **Suporte**: espaço para o contato da Operadora (a Diretoria informa).

O guia segue "Passo a passo para uma instituição nova" e a R4 deste documento; onde divergir do
sistema, vale o sistema e o guia é corrigido. Quem redigir confere cada passo com a tela
Rede › Instituições e aponta no PR as melhorias de experiência de uso que encontrar.

### 2. Termo de adesão (modelo)
É um **modelo para a assessoria jurídica da Diretoria revisar**; o Elo não dá parecer jurídico.
Conteúdo mínimo, vindo de decisões já tomadas (ADR-012, 017, 018):
1. **Partes**: instituição (controladora) e Operadora (operadora, pela LGPD). Razão social, CNPJ,
   representantes e endereço ficam `[a preencher]`.
2. **Objeto**: uso do Elo; os dados ficam no Drive da própria instituição.
3. **Papéis LGPD** e obrigações do operador: tratar só conforme as instruções, sigilo,
   segurança, avisar incidente, apoiar direitos dos titulares, devolver ou eliminar ao fim.
4. **Segurança**: entrada só com e-mail do domínio; auditoria de leituras sensíveis e alterações
   (colunas, nunca valores); a Administração da rede **não vê** pessoas, folha nem orçamento.
5. **Drive compartilhado com membros restritos**: obrigação da TI da instituição (ver guia).
6. **Transferência internacional**: as funções do servidor rodam fora do Brasil; o termo
   registra isso (análise de LGPD pedida nas ADR-011 e ADR-017).
7. **Encarregado (DPO)** da instituição e da Operadora: `[a preencher]`. A definição do DPO da
   Apae Batatais é a pendência #69 e **não** é resolvida aqui.
8. **Custo**: rateio ou mensalidade `[a preencher]` (a ADR-012 deixa a Diretoria decidir).
9. **Suspensão, saída e troca da Operadora**: a empresa assume o papel nos termos, sem mudança
   para a instituição.
10. **A Apae Batatais** assina o termo como as demais instituições (ADR-012).

### 3. Roteiro de transferência da Operadora
Parte da tabela "Transferência para a empresa" da ADR-012, em passos com responsável e conferência:
1. **Código**: transferir a organização ou o repositório do GitHub.
2. **Quadro e automações do desenvolvimento**: seguir o roteiro "Migração do quadro na
   transferência do Elo" da **ADR-019** (só apontar, sem repetir), com `QUADRO_TOKEN`,
   `QUADRO_NUMERO`, `CLAUDE_CODE_OAUTH_TOKEN` e o usuário da Diretoria nos workflows.
3. **Publicação**: transferir o site da Netlify e conferir plano e créditos (ADR-019).
4. **Google Cloud**: transferir o projeto (conta de serviço, cliente OAuth, origens autorizadas),
   garantindo que a conta de serviço mantém o acesso aos Drives das instituições.
5. **Planilha da rede** e Drive "Elo · Operadora": transferir a propriedade.
6. **Variáveis da Netlify**: `GOOGLE_CONTA_SERVICO`, `GOOGLE_CLIENT_ID`, `SESSAO_SEGREDO`, `REDE`.
7. **Marca Elo e domínio da rede** em nome da empresa.
8. **Contratos**: termo novo ou aditivo com a empresa como Operadora; avisar cada instituição
   antes da troca.
9. **Conferência final**: cada instituição entra, a Administração da rede vê o cadastro,
   publicação e login funcionam.
10. A Apae Batatais passa a instituição usuária comum e perde o acesso de operadora.

O roteiro **nunca traz credenciais**: diz onde cada uma é gerada, não o valor (CLAUDE.md, regra 9).

### Regras (conferência por leitura, pois não há código)
1. Todo passo do guia existe na tela ou no processo descrito nesta especificação (R1, R2, R4).
2. Escrita sempre **Apae Batatais** (nunca "APAE"); exemplos usam instituições fictícias.
3. Nenhum documento traz dado real, e-mail de pessoa, ID de planilha ou credencial.
4. O guia orienta a restringir os membros do Drive (ADR-018).
5. O roteiro aponta para a ADR-019 no trecho do quadro e das automações.
6. O que depende da Diretoria fica `[a preencher]`; nada é inventado.

### Telas, manual e Ajuda
Nenhuma tela muda. Conforme "Manual e Ajuda", a R3 entrega o guia à parte e o termo; o manual em
PDF não muda.

### Fica de fora
- Parecer jurídico e assinatura de termos (assessoria da Diretoria).
- Definir o DPO (#69), o modelo de cobrança e o contato de suporte.
- Mudança de código, abas ou permissões; link do guia na tela Rede › Instituições (sugestão de
  melhoria para depois).
- Executar a transferência: aqui só se escreve o roteiro.

### Frentes
Sem trabalho de produção em telas nem em regras e dados. Só documentação em `docs/`; a habilidade
**infraestrutura** orienta os passos de Netlify, Google e GitHub do roteiro.

### Entrega
Uma só, pequena: três arquivos em `docs/`, ligados a partir deste documento. O PR de entrega
(`Entrega #58`) só mexe em documentos, então não tem prévia; a Diretoria confere lendo no PR.

### Critérios de pronto
- Os três arquivos existem em `docs/` e estão ligados a partir de `docs/especificacao-rede.md`.
- A Diretoria lê o guia de ponta a ponta e entende o que a TI da instituição faz e o que a
  Operadora faz.
- O guia tem a orientação de restringir os membros do Drive; o roteiro aponta para a ADR-019.
- Os campos `[a preencher]` estão listados no PR para a Diretoria decidir.

### Decisões tomadas sozinho
- **Documentos em `docs/`, não na tela Ajuda**: o público (TI, assessoria jurídica) está fora do
  Elo e o termo precisa circular em arquivo. Se preferir dentro do Elo, é uma entrega de tela a mais.
- **Termo como modelo com campos `[a preencher]`**: não invento DPO, custos nem dados das partes.
  O custo é preencher; o risco real é assinar sem revisão jurídica, por isso o aviso.
- **Roteiro do quadro por referência à ADR-019**, como a Diretoria pediu no comentário da issue.
- **Manual em PDF não muda**: o guia é documento à parte.

### Documentos entregues
- `docs/guia-adesao-instituicao.md` — guia "Como trazer uma instituição para o Elo".
- `docs/termo-adesao.md` — modelo do termo de adesão (LGPD).
- `docs/transferencia-operadora.md` — roteiro de transferência da Operadora.
