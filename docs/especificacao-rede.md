# Especificação — Várias instituições no Elo (Rede)

Decisão de arquitetura: ADR-012. Este documento descreve o que muda para quem usa.
"Instituição" é cada Apae ou entidade que usa o Elo, inclusive a Apae Batatais.
"Operadora" é quem mantém o Elo: hoje a Apae Batatais; no futuro, uma empresa.

## Quem faz o quê
| Quem | O que faz |
| --- | --- |
| Administração da rede (Operadora) | Cadastra, confere, suspende e reativa instituições; publica atualizações; dá suporte técnico. Não vê dados das instituições |
| TI ou Diretoria da instituição | Cria o endereço `elo.<domínio>` no DNS, cria as planilhas no próprio Drive e compartilha com a conta de serviço |
| Administração da plataforma (de cada instituição) | Roda "Preparar estrutura", cadastra unidades, áreas, serviços e acessos da sua instituição |

## Telas novas
1. **Rede › Instituições** (só Administração da rede, no endereço da Operadora):
   lista com situação, endereço, domínio e estado das planilhas (encontradas,
   compartilhadas, estrutura em dia). Ações: cadastrar, alterar, suspender, reativar.
2. **Cadastro de uma instituição**: nome curto, razão social, domínio de e-mail,
   endereços de acesso, unidades iniciais, IDs das planilhas e e-mails dos
   administradores iniciais. Botão **Conferir** testa cada planilha e mostra o
   que falta, em português, sem gravar nada.
3. **Endereço não cadastrado** (pública): explica que o endereço não pertence a
   nenhuma instituição do Elo, sem mostrar dados.

## Passo a passo para uma instituição nova
1. A Administração da rede cadastra a instituição ("em preparação").
2. A instituição cria `elo.<domínio>` no DNS (CNAME); a Operadora inclui o
   endereço na Netlify e no cliente OAuth do Google.
3. A instituição cria as planilhas no próprio Drive e compartilha com a conta de serviço.
4. A Administração da rede cola os IDs e usa **Conferir**.
5. O administrador inicial entra, roda **Preparar estrutura** e cadastra a
   organização e os acessos. A situação passa a "ativa".

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
Duas instituições fictícias ("Apae Exemplo" e "Apae Modelo") e uma Operadora
fictícia, para conferir na prévia que uma instituição não vê a outra e que a
Administração da rede não vê dados de nenhuma.

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
