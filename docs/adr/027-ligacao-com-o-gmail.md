# ADR-027 — Ligação do Elo com o Gmail (envio por conta de serviço e rotina agendada)

- Situação: proposta (15/11/2026), a aprovar com a especificação da issue #63
- Data: 15/11/2026

## Contexto
A Comunicação (fase 2) precisa enviar e-mails sozinha: avisos, lembretes e envio de release e artigo na
data marcada, sem ninguém com o navegador aberto. A Diretoria decidiu (comentário na issue #63) que os
envios saem de um e-mail institucional do tipo "não-responda@", e não da conta pessoal de alguém, e que
a instituição informa qual conta é essa no cadastro dela. Envio automático e sem pessoa autenticando a
cada vez aponta para a **conta de serviço com delegação em todo o domínio** do Google Workspace, a mesma
família de credencial que a ADR-011 já usa nas planilhas.

## Decisão
1. **Peça nova do Núcleo: `src/nucleo/email/`.** Contrato `EnviadorDeEmail` (`enviar(mensagem)`), com duas
   implementações: **Gmail** (API `users.messages.send`, escopo `gmail.send`, conta de serviço que age
   "em nome de" o remetente da instituição) e **memória** (demonstração e testes; guarda as mensagens
   enviadas e permite simular falha). Sem credenciais do Google ou em demonstração, vale a memória: o
   envio fictício nunca sai de verdade (regra 9).
2. **Remetente por instituição.** Coluna nova `remetente_email` (opcional) em `Instituicoes` (planilha da
   rede), editável na tela de administração da instituição. Deve ser do domínio da instituição. Sem
   remetente cadastrado, **nada é enviado por e-mail** e o app avisa a administração; os avisos dentro
   do Elo continuam funcionando. O código nunca fixa um e-mail.
3. **Delegação no domínio é configurada por quem administra o Google Workspace da instituição**, uma vez
   (roteiro no manual de implantação): autorizar o ID da conta de serviço com o único escopo
   `https://www.googleapis.com/auth/gmail.send`. O Elo nunca recebe a senha do remetente. A conta
   "não-responda@" precisa existir como usuária (ou grupo com envio permitido) no Workspace.
4. **Revisão do Google não é necessária nesta etapa.** Delegação no domínio, dentro do próprio Workspace
   da instituição, é autorizada pela administração do domínio e não passa pela verificação de aplicativo
   do Google (que vale para OAuth de pessoas de fora). A questão volta à pauta só se uma instituição
   quiser enviar por conta pessoal ou fora do domínio (roadmap).
5. **Fila de envios (aba `Envios`, planilha do módulo que pediu).** Todo envio é gravado antes de sair:
   situação `pendente`, `enviado`, `falhou` ou `cancelado`, tentativas e erro resumido. A gravação segue as
   regras 7 e 10 do projeto (auditoria só com colunas). O corpo da mensagem **não** fica gravado no envio
   agendado de release e artigo: ele é montado do pedido na hora de enviar; só o assunto, a data e os
   endereços de destino ficam no registro. Aviso por e-mail leva só texto genérico e o link do Elo (nada
   de dado pessoal de atendido, nem de conteúdo do pedido).
6. **Rotina agendada: GitHub Actions chama uma rota protegida.** Workflow `rotina.yml` roda a cada 15
   minutos e faz `POST /api/rotina` com a chave `ROTINA_TOKEN` (novo Secret, com vencimento em
   `.github/chaves.json`). A rota confere a chave (comparação em tempo constante), roda as tarefas de cada
   instituição ativa e devolve só contagens. Escolhido porque a esteira já vive no GitHub (ADR-019), não
   gasta créditos de publicação da Netlify e dispensa funções agendadas, que dependem da publicação
   ligada ao Git. Cada módulo oferece uma função `rotina(p, instituicao)` no `index.ts` (ADR-013); a
   plataforma só chama quem estiver ativo. Tarefa idempotente: o mesmo envio nunca sai duas vezes
   (a situação `enviado` e a versão da linha impedem).
7. **Falha nunca passa em silêncio.** Falhou: até 3 tentativas (15 e 60 minutos depois); esgotadas, o
   envio fica `falhou`, o pedido **não** vira Publicado e a Comunicação recebe aviso no Elo (e por e-mail,
   se o remetente funcionar). Erro do Gmail é gravado resumido, sem endereço nem texto da mensagem.
8. **Limites.** Gmail aceita cerca de 2.000 envios por dia por usuária do Workspace; o Elo envia no
   máximo 100 por rodada e por instituição. Mensagens com anexo até 10 MB (limite do app).
9. **Privacidade.** Destinatários da imprensa (`Contatos.email`) já são dado pessoal; os envios usam cópia
   oculta (um e-mail só, todos em Cco). Nada de rastreamento de abertura.

## Consequências
- Um app novo envia e-mail usando `EnviadorDeEmail` e a aba `Envios`, sem conhecer o Gmail; Requisições
  (#61) e o painel de prazos (#57) aproveitam a mesma peça em entregas próprias.
- A rotina tem precisão de cerca de 15 minutos (o agendador do GitHub pode atrasar alguns minutos); para
  releases isso basta. Se um dia for preciso mais precisão, trocar o agendador não muda o resto.
- Nova dependência de configuração fora do código: delegação no Workspace, remetente no cadastro da
  instituição e o Secret `ROTINA_TOKEN`. Sem qualquer um, o Elo continua funcionando, só sem e-mail.
- Se o plano gratuito do GitHub Actions apertar, a frequência da rotina pode cair para 30 ou 60 minutos.
