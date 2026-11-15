# Como trazer uma instituição para o Elo

Guia para a TI e a Diretoria de uma Apae (ou outra entidade) que vai passar a usar o Elo.
"Instituição" é quem usa o Elo; "Operadora" é quem o mantém (hoje a Apae Batatais). Os exemplos usam
uma instituição fictícia, a "Instituição Modelo", com o domínio `modelo.exemplo.org.br`.

Os dados da instituição ficam no Google Drive **dela**. A Operadora não vê pessoas, folha nem
orçamento da instituição.

## Visão geral

| # | Etapa | Quem faz |
| --- | --- | --- |
| 1 | Conferir o que é preciso ter | Instituição |
| 2 | Assinar o termo de adesão | Diretoria da instituição e da Operadora |
| 3 | Criar o endereço `elo.<domínio>` | TI da instituição e Operadora |
| 4 | Criar o Drive compartilhado e enviar o link | TI da instituição |
| 5 | Restringir os membros do Drive | TI da instituição |
| 6 | Cadastrar, conferir e ativar | Operadora |
| 7 | Primeiro acesso | Administrador inicial |

## 1. Antes de começar
- Google Workspace com **domínio próprio** (e-mails como `nome@modelo.exemplo.org.br`). Só e-mails
  desse domínio entram no Elo.
- Uma pessoa da **TI** (ou quem cuide do domínio e do Google Workspace).
- Uma pessoa da **Diretoria** para assinar o termo e indicar o(s) administrador(es) inicial(is).

## 2. Termo de adesão
Assine o termo (`docs/termo-adesao.md` é o modelo) **antes de qualquer dado real** entrar no Elo.
A instituição é a controladora dos dados (LGPD) e a Operadora, a operadora.

## 3. Endereço
1. A TI cria no DNS do domínio um registro **CNAME** de `elo.<domínio>` (ex.:
   `elo.modelo.exemplo.org.br`) para o endereço do Elo que a Operadora informar.
2. A Operadora inclui esse endereço no site (Netlify) e no login do Google. Quando a Operadora
   avisar, o endereço abre.

## 4. Drive compartilhado da instituição
O Elo guarda tudo em planilhas do Google, num **Drive compartilhado** da instituição (ADR-018).
1. No Google Drive, crie um Drive compartilhado chamado **"Elo · <nome da instituição>"**.
2. Inclua a **conta de serviço do Elo** como membro com a função **Gerente de conteúdo**. A
   Operadora informa o e-mail da conta de serviço.
3. Copie o link da pasta e envie à Operadora.

> **Hoje, antes da entrega R4 (pasta única):** em vez do Drive único, a instituição cria as
> planilhas à mão (Núcleo, Auditoria e as dos apps que vai usar), compartilha cada uma com a conta
> de serviço e envia o ID de cada uma. A Operadora diz quais planilhas e a conta de serviço. Com a
> R4, basta o link da pasta: o Elo cria as planilhas sozinho.

## 5. Restringir os membros do Drive (muito importante)
**Quem é membro do Drive compartilhado vê todas as planilhas dele**, inclusive a de Avaliação,
que tem dado sensível de pessoas atendidas. O Elo **não confere** quem é membro: isso é
responsabilidade da TI da instituição (ADR-018).

- Deixe como membros apenas a **conta de serviço do Elo** e **uma ou duas pessoas** da TI ou da
  Diretoria.
- A equipe **não** precisa ser membro: ela usa só o Elo, que aplica as permissões de cada pessoa.
- Revise a lista de membros **sempre que alguém sair** ou mudar de função.
- Não compartilhe o Drive por link aberto.

## 6. O que a Operadora faz
Na área da rede (Rede › Instituições), a Administração da rede:
1. **Cadastra** a instituição (fica "em preparação"): nome, razão social, domínio dos e-mails,
   endereço, administradores iniciais, unidades iniciais e as planilhas.
2. Usa **Conferir**, que testa tudo sem gravar e diz em português o que falta, e depois
   **Preparar estrutura**, que cria as abas e a configuração inicial.
3. Com a estrutura em dia, clica em **Ativar**. A partir daí a equipe entra pelo endereço.

Com a R4, a Operadora cola só o link da pasta; ao salvar, o Elo confere e prepara sozinho.

## 6b. E-mail de envio (opcional, ADR-027)
O Elo pode enviar avisos por e-mail, sempre de um endereço institucional do tipo `nao-responda@<domínio>`
(nunca da conta pessoal de alguém). Sem esse endereço, o Elo funciona igual, só sem e-mail.

**Quem administra o Google Workspace da instituição faz uma vez:**
1. Crie o usuário (ou grupo com envio permitido) `nao-responda@<domínio>`.
2. No Google Cloud do Elo, ative a **Gmail API** (a Operadora faz isso uma vez para a rede).
3. No Admin do Google Workspace: Segurança › Acesso e controle de dados › Controles da API ›
   **Delegação em todo o domínio** › Adicionar. Informe o **ID do cliente** da conta de serviço do Elo
   (a Operadora informa) e o único escopo `https://www.googleapis.com/auth/gmail.send`.
   O Elo nunca recebe a senha de ninguém.

**A Operadora faz:** na área da rede, em Instituições › Alterar, preenche **E-mail de envio** (precisa ser do
domínio da instituição) e salva; depois clica em **E-mail de teste** na linha da instituição. O teste chega
só para quem clicou. Se falhar, a mensagem diz o que conferir.

## 7. Primeiro acesso
O administrador inicial entra pelo `elo.<domínio>` com o e-mail da instituição, cadastra a
organização (unidades, áreas, serviços) e os acessos da equipe.

## Suspensão e saída
- Se a instituição for **suspensa**, ninguém entra, mas os dados continuam no Drive dela.
- Se a instituição **sair**, os dados já são dela, no Drive dela. A Operadora retira o endereço e o
  compartilhamento com a conta de serviço. Nada é apagado pelo Elo.
- Se a Operadora mudar (por exemplo, para uma empresa), nada muda para a instituição além do termo
  (ver `docs/transferencia-operadora.md`).

## Suporte
Contato da Operadora: **[a preencher pela Diretoria]**.

## Para a Operadora: como este guia foi conferido
Cada passo foi conferido com `docs/especificacao-rede.md` e com a tela Rede › Instituições (botões
**Conferir**, **Preparar estrutura**, **Ativar**, **Suspender**). Onde divergir do sistema, vale o
sistema e este guia é corrigido.
