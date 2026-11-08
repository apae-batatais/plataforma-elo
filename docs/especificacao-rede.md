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
- **R3**: guia de adesão, termo de adesão (LGPD) e roteiro de transferência da Operadora.
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
