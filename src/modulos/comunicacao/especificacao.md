# Especificação — Módulo Comunicação (fase 1)

- Situação: aprovada em 06/11/2026 pela Diretoria
- Dono do produto: Diretoria
- Próximas fases: Roadmap do Elo (fase 2 e-mail automático e avisos por e-mail; fase 3 Instagram automático; fase 4 resultado das postagens)

## Objetivo

Qualquer pessoa da equipe pede uma publicação pelo Elo, ligada a um tema do calendário da Comunicação.
O Setor de Comunicação revisa, a coordenação da Comunicação aprova, a Comunicação agenda e publica,
e tudo fica registrado para medir volume, prazos e cobertura do calendário. Cada instituição tem os
próprios pedidos, calendário e contatos.

A fase 1 não tem integração externa: o Instagram é agendado pela Comunicação no Meta Business Suite;
release e artigo saem por um e-mail pronto aberto no Gmail de quem clica; os avisos aparecem só no Elo.

## Usuários e permissões

| Perfil | Pode | Permissão |
| --- | --- | --- |
| Todos os perfis | Pedir publicação, acompanhar os próprios pedidos, ajustar os devolvidos, cancelar enquanto aguardam revisão | `comunicacao.acessar`, `comunicacao.solicitar` |
| Comunicação (perfil novo) | Revisar, agendar e publicar; ver todos os pedidos; cuidar do calendário e dos contatos | `comunicacao.revisar`, `comunicacao.ver_todos`, `comunicacao.calendario.gerenciar`, `comunicacao.contatos.gerenciar` |
| Coordenação da Comunicação (perfil novo) | Tudo da Comunicação; aprovar, pedir ajustes ou recusar; definir a antecedência mínima; ver os indicadores | as da Comunicação + `comunicacao.aprovar`, `comunicacao.configurar`, `comunicacao.indicadores` |
| Diretoria | Tudo da Coordenação da Comunicação (pode assumir a função dela) | as mesmas da Coordenação da Comunicação |

## Entidades (planilha `comunicacao`)

| Aba | O que guarda | Sigilo |
| --- | --- | --- |
| Calendario | Tema, se é data exata ou período, início e fim, tipos de peça sugeridos, observação | interno |
| Pedidos | Número, quem pediu (e-mail e nome), área, item do calendário (ou fora do calendário), tipo de peça, título, descrição, data desejada, urgente, confirmação de imagem (com data e hora), link do vídeo, situação, pedido a que foi juntado, data e hora agendadas, grupos de destino, link da publicação, publicado em | pessoal: solicitante |
| Historico | Cada mudança: quando, quem, situação anterior e nova, comentário (só inclusões) | pessoal: usuário |
| Anexos | Fotos e documentos de cada pedido: id do arquivo na pasta de anexos, nome, tipo, tamanho | sensível: arquivo |
| Contatos | Nome, veículo, e-mail | pessoal: contato |
| Grupos | Nome do grupo | interno |
| ContatoGrupos | Ligação entre contato e grupo | interno |
| Parametros | Antecedência mínima em dias úteis | interno |

Tipos de peça (fixos na fase 1): Post no Instagram, Reel no Instagram, Release, Artigo, Entrevista.

## Regras de negócio (com teste)

1. Caminho do pedido:

   | Situação | Quem age | Vai para |
   | --- | --- | --- |
   | Aguardando revisão | Comunicação | Em revisão; Cancelado (só quem pediu) |
   | Em revisão | Comunicação | Aguardando aprovação; Devolvido; Recusado; Juntado |
   | Devolvido | Quem pediu | Aguardando revisão (depois do ajuste); Cancelado |
   | Aguardando aprovação | Coordenação da Comunicação | Aprovado; Em revisão (ajustes pedidos); Recusado |
   | Aprovado | Comunicação | Agendado |
   | Agendado | Comunicação | Publicado (entrevista: Realizada); Agendado (reagendar) |

   Situações finais: Publicado, Realizada, Recusado, Cancelado, Juntado.
2. Devolver, recusar e pedir ajustes exigem comentário.
3. Na revisão, a Comunicação pode alterar título, descrição, tipo de peça, item do calendário, data desejada e anexos; cada alteração vai para o histórico com as colunas alteradas.
4. Juntar: o pedido de destino precisa estar ativo (não final) e ser outro pedido; o juntado fica como Juntado, com o número do destino; o destino recebe no histórico a referência do juntado.
5. Pedido sem tema escolhe "Fora do calendário"; na revisão, a Comunicação pode ligá-lo a um item existente ou criar um item novo.
6. Só itens ativos do calendário aparecem para escolha. Item com data exata tem início = fim; item com período tem fim maior ou igual ao início; todo item tem pelo menos um tipo de peça sugerido.
7. Data desejada não pode estar no passado. Urgente quando a data desejada fica antes de hoje + antecedência mínima, contando dias úteis de segunda a sexta (sem os feriados cadastrados no Núcleo, ADR-034). A urgência é calculada no envio e recalculada no reenvio de um devolvido.
8. Pedido com foto ou link de vídeo só é enviado com a confirmação "As pessoas que aparecem têm autorização de uso de imagem"; o Elo guarda quando e por quem foi confirmado.
9. Anexos (ADR-014, mesma pasta de anexos da instituição): fotos JPG/PNG/WebP reduzidas no navegador e documentos PDF ou DOCX de até 10 MB, até 5 arquivos por pedido. Vídeo não é anexado: entra como link (https) de uma pasta do Drive. Só quem vê o pedido abre os anexos, pelo Elo, e cada abertura vai para a auditoria.
10. Agendar só pedido Aprovado, com data e hora no futuro. Release e artigo exigem pelo menos um grupo ou contato de destino. Reagendar mantém a situação Agendado e registra a data anterior no histórico.
11. E-mail pronto (release e artigo): o Elo monta um e-mail no Gmail com os destinatários em cópia oculta, o título como assunto e a descrição como texto; a Comunicação anexa o arquivo. Se a lista for longa demais para abrir de uma vez, o Elo mostra os endereços para copiar.
12. Publicar só pedido Agendado. Post e reel exigem o link da publicação; release e artigo registram a data do envio; entrevista fica como Realizada, com comentário opcional.
13. Cancelar só quem pediu, e só em Aguardando revisão ou Devolvido.
14. Antecedência mínima: número inteiro de 0 a 30 dias úteis; só a Coordenação da Comunicação altera.
15. Contatos: e-mail válido e sem repetir entre os ativos; um contato pode estar em vários grupos.
16. Quem pede vê só os próprios pedidos; Comunicação, coordenação e Diretoria veem todos.
17. Número sequencial no ano: COM-AAAA-NNNN.
18. Nada é apagado: itens do calendário, contatos, grupos e anexos tirados ficam com `ativo = FALSE`; o histórico só recebe inclusões; toda gravação registra auditoria só com as colunas.

## Telas

1. Avisos na tela inicial e número no menu: "N devolvidos para você ajustar", "N aguardando revisão", "N urgentes", "N para publicar hoje", "N aguardando aprovação", conforme o perfil.
2. Meus pedidos e Novo pedido / Ajustar (tema com busca entre os itens mais próximos ou "Fora do calendário", tipo de peça, título, descrição, data desejada com aviso imediato de urgência, anexos, link do vídeo, confirmação de imagem).
3. Pedidos (Comunicação e coordenação): filas Para revisar, Para aprovar, Para agendar e Agendados, mais Todos, com filtros por situação, tipo, área e tema; urgente sempre com ícone e texto.
4. Detalhe do pedido (janela por cima da tela): dados, anexos, histórico e as ações de quem pode agir naquela situação.
5. Calendário: visão de mês e de lista; cada item mostra quantos pedidos tem e quantos já foram publicados.
6. Contatos da imprensa: contatos e grupos.
7. Indicadores (coordenação e Diretoria), com filtro de mês, trimestre ou ano.
8. Configurações: antecedência mínima.

## Eventos

| Evento | Publica ou consome | Efeito |
| --- | --- | --- |
| — | — | Nenhum na fase 1 |

## Indicadores

| Código | Cálculo | Referência |
| --- | --- | --- |
| comunicacao_volume | Pedidos enviados no período, por área, tipo de peça e item do calendário | Indicadores |
| comunicacao_tempo_revisao | Média de dias úteis do envio (ou reenvio) até sair da revisão | Indicadores |
| comunicacao_tempo_aprovacao | Média de dias úteis de Aguardando aprovação até a decisão | Indicadores |
| comunicacao_tempo_publicacao | Média de dias úteis do primeiro envio até Publicado ou Realizada | Indicadores |
| comunicacao_publicados_com_atraso | % dos publicados no período com publicação depois da data desejada | Indicadores |
| comunicacao_urgentes | Pedidos enviados como urgentes no período | Indicadores |
| comunicacao_temas_sem_publicacao | Itens do calendário encerrados no período sem nenhum pedido publicado | Indicadores |

## Decisões da Diretoria (06/11/2026)

1. Se a própria coordenação da Comunicação fizer um pedido, ela mesma aprova (o pedido já passou pela revisão da Comunicação).
2. A Diretoria pode assumir a função da coordenação da Comunicação: tem as mesmas permissões.
3. Limites de anexos para começar: até 5 arquivos, documentos de até 10 MB.
4. Quem pediu também pode cancelar um pedido devolvido (além de antes da revisão), como no Requisições.
5. Cor do app: azul-celeste (#0369A1 no tema claro, #5CC8F5 no escuro), testada nos dois temas (contraste 5,5 e 8,9).

## Decisões tomadas na construção (Entrega 3, 07/11/2026) — para conferência da Diretoria

1. Na revisão, a Comunicação só inclui foto nova se quem pediu já confirmou a autorização de uso de imagem; senão, devolve o pedido para quem pediu confirmar. A Comunicação não confirma por outra pessoa.
2. O anexo aparece com o nome original do arquivo, guardado como dado pessoal (decisão da Diretoria em 07/11/2026); no Drive o arquivo fica com o nome gerado pelo Elo.
3. Abrir o envio de anexos exige `comunicacao.solicitar` ou `comunicacao.revisar`.
4. Documentos de até 10 MB são entregues inteiros, em partes, pela rota de leitura. Na prévia isso não pode ser conferido acima de 4 MB, porque a demonstração recusa arquivos maiores que 4 MB.

## Decisões tomadas na construção (Entregas 4 e 5, 09/11/2026) — para conferência da Diretoria

1. Agendar mostra a data e a hora no horário de Brasília. Para release e artigo, os destinatários escolhidos ficam gravados no pedido; ao mudar a data, a escolha anterior já vem marcada.
2. Post e reel só têm o link da publicação obrigatório; release e artigo aceitam um link opcional. Publicar antes do dia agendado é permitido (a Comunicação pode antecipar).
3. O e-mail pronto só aparece para release e artigo agendados, para quem tem `comunicacao.revisar`. Os contatos desativados e os grupos desativados ficam de fora na hora de abrir o e-mail, mesmo que estivessem escolhidos quando agendou.
4. Indicador "publicados com atraso": só entram os pedidos em Publicado; entrevista (Realizada) não entra. Vale o dia da publicação em Brasília contra a data desejada.
5. Tempo de revisão: conta de cada envio ou reenvio até a Comunicação sair da revisão; se a coordenação pedir ajustes, a volta para a revisão não abre uma nova contagem.
6. Temas sem publicação: só itens ativos do calendário; item desativado não é cobrado.
7. Contatos: ao reativar um contato, o e-mail não pode repetir o de outro contato ativo.

## Fase 2 · ligação com o Gmail (proposta #63, ADR-027)

**Objetivo.** O Elo envia e-mails sozinho: avisos a quem precisa agir, lembrete à Comunicação no dia
agendado e o envio de release e artigo na data e hora marcadas, com registro e aviso de falha. Substitui o
"e-mail pronto" aberto à mão, que continua existindo como alternativa quando o envio automático não está
ligado.

**Decisão da Diretoria (comentário na issue, 15/11/2026).** Os e-mails saem de um endereço institucional
do tipo "não-responda@", não da conta pessoal de alguém da Comunicação. A instituição informa qual é no
cadastro dela. Leitura confirmada pelo Arquiteto: é conta de serviço com delegação no domínio (ADR-027).

### Permissões
| Perfil | Pode | Permissão |
| --- | --- | --- |
| Comunicação e coordenação | Escolher "enviar pelo Elo" ao agendar release e artigo; ver o resultado dos envios; tentar de novo um envio que falhou | `comunicacao.revisar` |
| Coordenação e Diretoria | Ligar ou desligar os avisos por e-mail da instituição | `comunicacao.configurar` |
| Administração da instituição (Núcleo/Rede) | Informar o remetente "não-responda@" | permissão já existente de administrar a instituição |
| Quem pediu | Receber o aviso por e-mail dos próprios pedidos | — |

### Entidades
| Aba | O que guarda | Sigilo |
| --- | --- | --- |
| Envios (nova, planilha `comunicacao`) | Pedido, tipo (release, artigo, aviso, lembrete), assunto, destinatários (e-mails), data e hora de envio previstas, situação (pendente, enviado, falhou, cancelado), tentativas, enviado em, erro resumido | pessoal: destinatários |
| Instituicoes (rede, alterada) | Coluna nova `remetente_email` | interno |
| Configuracoes (comunicação, alterada) | `avisos_por_email` (liga/desliga, começa desligado) | interno |
| Pedidos (alterada) | Coluna nova `envio_automatico` (verdadeiro/falso) | interno |

### Regras de negócio (com teste)
1. Sem `remetente_email` válido (do domínio da instituição) ou com `avisos_por_email` desligado, nenhum
   e-mail de aviso ou lembrete é criado, e o agendamento automático não fica disponível; tudo continua
   aparecendo no Elo.
2. **Agendar com envio automático** (release e artigo): exige data e hora futuras, pelo menos um destino
   ativo e remetente configurado. O Elo cria um `Envio` pendente. Reagendar atualiza o envio pendente
   (nunca cria um segundo); cancelar ou devolver o pedido cancela o envio pendente.
3. **Rotina**: a cada rodada, para cada `Envio` pendente com hora chegada, o Elo remonta os destinos a
   partir de contatos e grupos **ativos naquele momento** (desativado sai), envia em Cco, anexa os arquivos
   do pedido e marca `enviado`. O mesmo envio nunca sai duas vezes (versão da linha).
4. **Sucesso**: o pedido continua Agendado até a Comunicação marcar Publicado, mas o envio registra
   "enviado em" e o histórico do pedido recebe "Enviado pelo Elo". (Decisão tomada sozinho abaixo.)
5. **Falha**: até 3 tentativas (+15 e +60 minutos). Esgotadas: envio `falhou`, pedido segue Agendado e
   **não** pode virar Publicado por envio automático; aviso à Comunicação no Elo (pendência na tela
   inicial) e por e-mail. A Comunicação pode "Tentar de novo" ou "Enviar à mão" (e-mail pronto).
6. **Avisos por e-mail** (quando a pessoa precisa agir): devolvido para ajustar (a quem pediu), aguardando
   revisão (à Comunicação, um resumo por rodada, não um e-mail por pedido), aguardando aprovação (à
   coordenação) e publicado (a quem pediu). O texto não traz título nem descrição do pedido: só o número
   (COM-AAAA-NNNN), o que fazer e o link.
7. **Lembrete**: no dia agendado, às 8h de Brasília, a Comunicação recebe um resumo dos pedidos do dia
   (post, reel e entrevista, que a Comunicação publica à mão).
8. Uma pessoa recebe no máximo um e-mail de aviso por tipo e por rodada. No máximo 100 envios por
   rodada; o que passar fica para a próxima.
9. Quem vê e quem altera: `Envios` só é lida por `comunicacao.revisar` e é gravada pela plataforma
   (rotina) e por ações de agendar, reagendar e tentar de novo; a rota da rotina recusa chamada sem a chave.
10. Toda gravação registra auditoria só com colunas; nada é apagado (envio cancelado fica `cancelado`).

### Telas
Usam só componentes existentes de `src/ui/` (formulário, botão, aviso, tabela, selo); nenhuma peça nova.
1. **Agendar (release e artigo)**: abaixo de data e hora, a escolha "Como enviar": "Enviar pelo Elo na
   hora marcada" (preselecionada quando o envio automático está disponível) ou "Abrir e-mail pronto no
   meu Gmail". Indisponível: o texto explica por quê ("A instituição ainda não informou o e-mail de
   envio.") e leva a Comunicação ao caminho de hoje. Caminho mais curto: o mesmo número de cliques de hoje.
2. **Detalhe do pedido**: faixa "Envio" com situação em texto e selo ("Enviado em 12/03 às 9h",
   "Falhou: tente de novo"), botões "Tentar de novo" e "Enviar à mão". Estado de erro nunca perde o que a
   pessoa digitou.
3. **Configurações**: interruptor "Avisos por e-mail" (coordenação) e o remetente aparece só como leitura
   ("Enviando por: <e-mail>", ou "Falta informar o e-mail de envio na administração da instituição").
4. **Administração da instituição (Rede)**: campo "E-mail de envio" com dica "Ex.: nao-responda@seudominio",
   validação do domínio e texto de ajuda que remete ao manual de configuração no Google.
5. **Tela inicial**: aviso "N envios falharam" para a Comunicação, com link ao pedido.
6. Celular e teclado: tudo em coluna única, botões com a mesma ordem de tabulação do restante do app.
7. Sugestão de melhoria (para a Diretoria decidir): botão "Enviar e-mail de teste" na administração da
   instituição, que manda uma mensagem à própria pessoa para confirmar a delegação.

### Fica de fora
Instagram automático (fase 3); aviso de Requisições (#61) e do painel de prazos (#57), que usam a peça em
entregas próprias; verificação do aplicativo pelo Google; rastreio de abertura; resposta a e-mails; envio
por conta pessoal; outros provedores de e-mail.

### Frentes
`regras e dados` (peça de e-mail do Núcleo, abas, rotina, testes de acesso), `telas` (agendar, detalhe,
configurações, administração), `infraestrutura` (workflow `rotina.yml`, Secret `ROTINA_TOKEN`, roteiro de
delegação no Google). Núcleo muda: peça nova `src/nucleo/email/` e coluna em `Instituicoes` (aprovação da
especificação autoriza).

### Entregas (ordem de construção)
1. Peça de e-mail do Núcleo (Gmail e memória), remetente na instituição, rota e workflow da rotina, com
   e-mail de teste. Conferência: enviar o e-mail de teste na prévia (demonstração, memória).
2. Comunicação: aba `Envios`, agendar com envio automático, falha, tentar de novo.
3. Comunicação: avisos e lembrete por e-mail.

### Decisões tomadas sozinho (custo se estiverem erradas)
- Revisão do Google dispensada nesta etapa (delegação interna). Se estiver errada: o envio real é
  recusado e é preciso pedir verificação, que leva semanas. Mitiga: testar com a própria instituição
  antes de abrir a outras.
- Esta entrega cobre a Comunicação e deixa a peça pronta; Requisições (#61) entra em entrega própria.
  Custo se errada: uma entrega a mais, sem retrabalho na peça.
- Rotina pelo GitHub Actions a cada 15 minutos (ADR-027). Custo se errada: trocar de agendador.
- Envio bem-sucedido não marca Publicado sozinho: a Comunicação confirma. Custo se errada: um clique a mais
  por release; trocar para automático é pequena mudança.
- Avisos por e-mail começam desligados e sem título do pedido no texto, por privacidade.

## Critérios de pronto

- [x] Regras de negócio com testes
- [x] Testes de acesso para cada aba (quem vê e quem altera)
- [x] `npm run verificar` e `npm run build` verdes
- [ ] Conferido pela Diretoria na prévia com dados fictícios, com os três perfis

## Fase 3 · publicação automática no Instagram (proposta #64, ADR-028)

**Objetivo.** Na hora marcada, o Elo publica no Instagram da própria instituição o post com imagem, o Reel
ou o carrossel do pedido, grava o link do post e avisa a Comunicação se algo falhar. Substitui o
agendamento à mão no Meta Business Suite, que continua como alternativa. Depende da fase 2 (#63, ADR-027):
usa a mesma rotina e o mesmo padrão de fila.

**Decisões da Diretoria (comentários da issue, 15/11/2026).** Outras OSCs usam já nesta entrega, cada uma
com a própria conta; cobre post com imagem, Reel e carrossel; a Diretoria cria a conta profissional do
Instagram e avisa; as credenciais de cada conta são cadastradas **dentro do Elo**, não só em Secrets.

### Permissões
| Perfil | Pode | Permissão |
| --- | --- | --- |
| Coordenação da Comunicação e Diretoria | Conectar, reconectar e desconectar a conta do Instagram da instituição | `comunicacao.configurar` |
| Comunicação e coordenação | Escolher "Publicar pelo Elo" ao agendar; ver o resultado; "Tentar de novo" | `comunicacao.revisar` |
| Todos os outros | Nada além do que já veem; nunca veem a chave | — |

### Entidades
| Aba | O que guarda | Sigilo |
| --- | --- | --- |
| Credenciais (nova, Núcleo, ADR-028) | Instituição, serviço (`instagram`), nome de usuário da conta, valor cifrado, vence em, situação, conectado por e em | sensível: valor cifrado; pessoal: conectado por |
| Publicacoes (nova, planilha `comunicacao`) | Pedido, tipo (post, reel, carrossel), data e hora previstas, situação, tentativas, identificador do post na Meta, link, erro resumido, publicada em | interno |
| Pedidos (alterada) | Coluna `publicacao_automatica` (verdadeiro/falso) | interno |
| Anexos (lida) | Os arquivos que serão publicados | sensível: arquivo |

### Regras de negócio (com teste)
1. **Conectar**: só `comunicacao.configurar`. O Elo leva a pessoa à Meta, recebe o token e grava cifrado
   (nunca em texto). Só uma conta ativa por instituição; conectar outra exige desconectar a atual. Conta
   que não é profissional é recusada com explicação.
2. **Segredo nunca aparece**: nenhuma tela, resposta de rota, log, auditoria ou erro mostra o valor. A
   tela mostra só o nome de usuário, a situação e a validade.
3. **Disponibilidade**: "Publicar pelo Elo" só aparece com conta `conectada` e para pedidos de post, reel
   ou carrossel (hoje "Post no Instagram" e "Reel no Instagram"; a Comunicação escolhe "carrossel" quando
   o pedido tem 2 a 10 imagens: decisão abaixo).
4. **Mídia**: post exige 1 imagem JPG (a Meta não aceita WebP/PNG no contêiner; o Elo converte ao
   publicar); carrossel 2 a 10 imagens; Reel exige 1 vídeo. O vídeo, hoje só um link do Drive (regra 9 da
   fase 1), passa a poder ser anexado ao pedido de Reel, de até o limite medido na construção. Sem a
   mídia exigida, não agenda.
5. **Agendar com publicação automática**: exige data e hora futuras, mídia válida e confirmação de
   imagem já feita no pedido. Cria `Publicacao` pendente; reagendar atualiza a pendente (nunca cria
   segunda); cancelar ou devolver o pedido a cancela.
6. **Rotina**: a cada rodada, para cada publicação pendente com hora chegada, o Elo cria o código de mídia
   temporária, pede à Meta o contêiner, espera ficar pronto (Reel leva mais tempo e é acompanhado nas
   rodadas seguintes), publica e grava o identificador e o link. O código temporário é encerrado ao fim,
   com sucesso ou não. Nunca publica duas vezes o mesmo pedido.
7. **Sucesso**: o pedido passa sozinho para **Publicado** com o link gravado (aqui, diferente do e-mail,
   a Meta devolve o link, então não há o que confirmar à mão), e o histórico registra "Publicado pelo Elo".
8. **Falha**: até 3 tentativas (+15 e +60 minutos). Esgotadas: publicação `falhou`, **o pedido volta para
   Agendado**, e a Comunicação recebe aviso no Elo (pendência na tela inicial) e por e-mail, se a fase 2
   estiver ligada, com o motivo em português ("A conta precisa ser reconectada", "A imagem não foi
   aceita pelo Instagram"). A Comunicação pode "Tentar de novo" ou "Publicar à mão".
9. **Token**: renovado pela rotina quando falta menos de 15 dias; falhando, situação `expirando` e aviso
   na tela e na tela inicial; vencido, `expirada` e nenhuma publicação sai (as pendentes ficam
   pendentes e o aviso explica; reconectar retoma).
10. **Limites**: no máximo 50 publicações por conta em 24 horas e 25 por rodada; o excedente fica
    pendente para a rodada seguinte, com aviso se atrasar mais de 1 hora.
11. **Mídia temporária**: a rota só entrega o arquivo daquele código, até 1 hora, sem login; código
    inexistente, vencido ou encerrado devolve "não encontrado" (sem pista do motivo); cada entrega vai
    para a auditoria como leitura de dado sensível.
12. **Quem vê e quem altera**: `Credenciais` é gravada só pela ação de conectar e pela rotina, lida só
    pela camada de aplicação (o valor decifrado nunca sai dela); `Publicacoes` é lida por
    `comunicacao.revisar`; a rota da rotina recusa chamada sem a chave. Toda gravação registra auditoria só
    com colunas; nada é apagado.
13. **Isolamento entre instituições**: a rotina só usa a credencial da instituição dona do pedido; teste
    com duas instituições garante que uma nunca publica na conta da outra.

### Telas
Usam só componentes existentes de `src/ui/` (formulário, botão, aviso, selo, tabela); nenhuma peça nova.
1. **Configurações → Instagram** (coordenação): sem conta, texto "Conecte o Instagram da instituição para
   publicar na hora marcada" e botão **"Conectar Instagram"** (2 cliques mais a autorização na Meta). Com
   conta: "Conectado como @usuario · válido até 10/01", selo da situação, botões "Reconectar" e
   "Desconectar" (este pede confirmação: "O Elo deixa de publicar. Publicações já agendadas ficam
   paradas até você conectar de novo."). Estados: conectando, erro da Meta ("Não foi possível conectar.
   Confira se a conta é profissional e tente de novo."), instituição sem permissão no app da Meta ("O
   Instagram desta instituição ainda não foi liberado pela Diretoria do Elo.") e sem permissão do perfil.
2. **Agendar (post, reel)**: abaixo de data e hora, "Como publicar": "Publicar pelo Elo na hora marcada"
   (preselecionada se a conta está conectada) ou "Eu publico à mão" (caminho de hoje). Indisponível: texto
   com o motivo e botão para a configuração, se a pessoa tem permissão. Caminho mais curto igual ao de hoje.
3. **Detalhe do pedido**: faixa "Instagram" com situação em texto e selo ("Publicado em 12/03 às 9h",
   "Falhou: tente de novo"), link do post e botões "Tentar de novo" e "Publicar à mão". Se der erro, nada
   do que a pessoa digitou se perde.
4. **Tela inicial**: aviso "N publicações falharam" e "A conta do Instagram precisa ser reconectada".
5. Celular e teclado: coluna única, mesma ordem de tabulação do restante do app; botões com texto, nunca
   só ícone.
6. Sugestões (para a Diretoria decidir): prévia de como o post fica antes de agendar; mostrar na lista a
   publicação programada do dia.

### Fica de fora
Story, comentários e mensagens, Facebook, primeiro comentário, marcar pessoas, publicar por conta
pessoal, resultado das postagens (fase 4), revisão do app na Meta (pendência da Diretoria, sem código),
troca de provedor.

### Frentes
`regras e dados` (peça `credenciais` e cifra, adaptador Instagram, abas, rotina, rota de mídia, testes de
acesso e de isolamento), `telas` (configuração, agendar, detalhe, tela inicial), `infraestrutura`
(Secrets `META_APP_ID`, `META_APP_SECRET`, `ELO_CHAVE_CREDENCIAIS`, vencimentos em `.github/chaves.json`,
rota pública de mídia e roteiro no manual). Núcleo muda: peça nova `src/nucleo/credenciais/` e aba
`Credenciais` (a aprovação da especificação autoriza).

### Entregas (ordem de construção, depois da #63)
1. **(construída, #64)** Peça de credenciais cifradas do Núcleo, tela "Conectar Instagram" e renovação do token. Conferência
   na prévia: conectar e desconectar uma conta fictícia (demonstração, sem Meta de verdade).
2. **(construída, #64)** Post com imagem: aba `Publicacoes`, agendar, rota de mídia temporária, rotina, falha e "Tentar de
   novo".
3. Reel e carrossel (inclui anexar vídeo e os limites de tamanho medidos na hospedagem).

### Decisões tomadas sozinho na entrega 2 (custo se estiverem erradas)
- **Sem conversão de imagem no servidor:** a foto do pedido já é JPG (reduzida no navegador); outra coisa é recusada ao
  agendar. Custo se errada: pedidos com PNG/WebP antigos precisam ser refeitos; adicionar conversão exige uma biblioteca
  de imagem.
- **A legenda do post é a descrição do pedido** (até 2.200 caracteres, o limite do Instagram). Custo se errada: trocar a
  origem do texto (um campo "legenda") muda o formulário do pedido.
- **Aviso de falha:** pendência no menu do app e faixa na lista de pedidos, para quem tem `comunicacao.revisar`; o aviso
  por e-mail fica para quando a fase 2 estiver ligada.
- **Endereço público** vem de `ELO_URL_PUBLICA` ou `URL` (Netlify). Custo se errada: sem endereço a rotina não publica
  (e informa `sem_endereco_publico`).

### Decisões tomadas sozinho (custo se estiverem erradas)
- **Depois da #63** (pergunta de fila sem resposta): a #64 reaproveita a rotina e a fila. Custo se errada:
  a entrega 1 teria de criar a rotina, e a #63 passaria a reaproveitá-la.
- **Conexão por "Entrar com Instagram" (Instagram Login), um app Meta para todo o Elo.** Custo se errada:
  se a Meta exigir página do Facebook ligada, o fluxo muda para o login do Facebook (outra permissão, outra
  revisão); a camada de credenciais e as regras não mudam.
- **Credenciais cifradas na planilha do Núcleo, com chave mestra na Netlify.** Alternativa seria um cofre
  externo. Custo se errada: migrar os valores para o cofre, sem mudar o contrato da peça.
- **Publicado sozinho com sucesso**, ao contrário do e-mail, porque a Meta devolve o link.
- **Falha devolve para Agendado** (como pede o roadmap), com aviso.
- **Carrossel decidido pelo número de imagens do pedido**, sem novo tipo de peça (tipos continuam
  fixos). Custo se errada: criar o tipo "Carrossel" no pedido (pequena mudança).
- **Limite de 50 por dia** (menor valor documentado pela Meta) e mídia pública por até 1 hora.

## Fase 2 · entrega 3: avisos por e-mail da Comunicação (proposta #184)

Detalha a entrega 3 da Fase 2 (ADR-027, proposta #63). **Não muda nada do que a Diretoria já decidiu** nas regras 1 a 10
da Fase 2; só diz como os avisos funcionam na prática. Sem ADR nova (nenhuma decisão de arquitetura).

**Pré-requisito.** Esta entrega usa a aba `Envios`, a coluna `envio_automatico` e a tarefa de envio da rotina, que são da
entrega 2 (agendar com envio automático, falha e tentar de novo). A entrega 2 precisa estar construída antes.

### O que entra
1. **Aviso a quem precisa agir** (Fase 2, regra 6), um por tipo, cada um com gatilho, destinatário e texto fixos:

   | Tipo | Quando é criado | Quem recebe | Assunto | Texto (sem título nem descrição do pedido) |
   | --- | --- | --- | --- | --- |
   | Devolvido | O pedido passa para Devolvido | Quem pediu | "Pedido COM-AAAA-NNNN devolvido para ajuste" | "Seu pedido foi devolvido para ajuste. Abra o Elo para ver o que ajustar." + link |
   | Aguardando revisão | Há pedidos em Aguardando revisão (resumo por rodada) | Quem tem `comunicacao.revisar` | "N pedidos aguardando revisão" | "Há N pedidos aguardando revisão." + link da lista |
   | Aguardando aprovação | O pedido passa para Aguardando aprovação | Quem tem `comunicacao.aprovar` | "Pedido COM-AAAA-NNNN aguardando aprovação" | "Um pedido espera a sua aprovação." + link |
   | Publicado | O pedido passa para Publicado | Quem pediu | "Pedido COM-AAAA-NNNN publicado" | "Seu pedido foi publicado." + link |
2. **Lembrete do dia** (regra 7): às 8h de Brasília, resumo à Comunicação (`comunicacao.revisar`) dos pedidos de post, reel
   e entrevista agendados para o dia: "Hoje: N pedidos para publicar." + link da agenda. Dia sem pedido: não envia.
3. **Aviso de falha de envio** (regra 5): quando o envio de release ou artigo esgota as tentativas, a Comunicação recebe
   "O envio do pedido COM-AAAA-NNNN falhou. Abra o Elo para tentar de novo ou enviar à mão." + link do pedido. O pedido
   continua Agendado e não vira Publicado por envio automático (regra da entrega 2, aqui coberta por teste).
4. **Tarefa nova da rotina** `comunicacao.avisos` (em `TAREFAS_DA_ROTINA`): cria os avisos e o lembrete e os envia, usando
   a aba `Envios` (tipos aviso e lembrete) e o `EnviadorDeEmail` por `app.email`. Devolve só contagens.

### Regras de negócio (com teste)
1. Aviso de pedido (Devolvido, Aguardando aprovação, Publicado) nasce na mesma gravação que muda a situação do pedido:
   cria um `Envio` pendente do tipo aviso, que a rotina envia. Se a criação do `Envio` falhar, a mudança de situação
   **não** é desfeita (o aviso dentro do Elo é o principal); o erro fica registrado e a rotina não repete sozinha.
2. Nada é criado sem `remetente_email` válido ou com `avisos_por_email` desligado (regra 1 da Fase 2).
3. Destinatário sem e-mail cadastrado, ou desativado, é ignorado; o aviso não falha por isso.
4. Aguardando revisão e lembrete são **resumos**: no máximo um por pessoa por rodada e um lembrete por dia por
   instituição (idempotente: a rotina rodando de novo no mesmo dia não reenvia).
5. Texto fixo, só número do pedido, o que fazer e o link do Elo; nunca título, descrição, nome de atendido nem anexo.
6. Aviso de falha sai uma vez por envio que falhou (não a cada tentativa) e não é reenviado ao "Tentar de novo",
   salvo se falhar de novo.
7. Falha ao enviar um aviso (Gmail fora do ar) segue a regra 5 da Fase 2 (3 tentativas), mas **nunca** altera a
   situação do pedido.
8. Quem vê e quem altera: `Envios` segue a regra 9 da Fase 2; ninguém altera aviso à mão; auditoria só com colunas.
9. Em demonstração e nos testes, tudo vai para o enviador em memória: nada sai de verdade (regra 9 do projeto).

### Telas
Quase sem tela nova; usam só componentes de `src/ui/`.
1. **Configurações** (coordenação, `comunicacao.configurar`): o interruptor "Avisos por e-mail" já especificado ganha a
   explicação "Quando ligado, o Elo manda e-mail a quem precisa agir, sem título nem descrição do pedido." e, desligado
   por falta de remetente, o texto "Falta informar o e-mail de envio na administração da instituição."
   Gravou: "Salvo."; erro: mensagem e a escolha anterior mantida.
2. **Detalhe do pedido**: no histórico, a linha "Aviso enviado por e-mail a <perfil ou nome de quem pediu>" ou "Aviso por
   e-mail não enviado: <motivo em português simples>", visível a quem já vê o pedido.
3. **Tela inicial**: o aviso "N envios falharam" (já especificado) passa a contar também avisos que falharam.
4. Estados: sem aviso a enviar, nada aparece; sem permissão, a pessoa não vê o interruptor.
5. Celular e teclado: nada novo (coluna única, ordem natural de tabulação).
6. Sugestão (Diretoria decide): cada pessoa poder desligar os próprios avisos por e-mail.

### Fica de fora
Aviso de Requisições (#61) e do painel de prazos (#57); Instagram (Fase 3); cada pessoa escolher quais avisos
receber; avisos por outros canais; rastreio de abertura; núcleo e outros módulos (só a pasta da Comunicação e a lista de
tarefas da rotina em `src/plataforma/rotina.ts`).

### Frentes
`regras e dados` (criação dos avisos, tarefa da rotina, testes de gatilho, texto e acesso) e `telas` (configurações,
histórico do pedido, tela inicial). Sem infraestrutura nova (o `rotina.yml` e o `ROTINA_TOKEN` são da entrega 1).

### Decisões tomadas sozinho (custo se estiverem erradas)
- **Quem recebe cada aviso**: aprovação vai a quem tem `comunicacao.aprovar` (coordenação e Diretoria). Se errada: troca
  de destinatário, pequena.
- **Lembrete às 8h só quando há pedido no dia.** Se a Diretoria quiser todo dia útil, é pequena mudança.
- **Falha de aviso nunca desfaz a mudança do pedido.** Se errada: um pedido pode mudar de situação sem e-mail; o aviso
  dentro do Elo continua.
- **Um aviso de falha por envio**, para não lotar a caixa da Comunicação.

### Critérios de pronto (conferência na prévia, em demonstração com e-mail fictício)
- Devolver, mandar para aprovação e publicar um pedido cria o aviso certo, para a pessoa certa, só com número e link.
- Com avisos desligados ou sem remetente, nada é criado.
- A rotina rodando duas vezes no mesmo dia manda um só lembrete.
- Um envio de release que falhou gera um aviso à Comunicação e o pedido continua Agendado.
