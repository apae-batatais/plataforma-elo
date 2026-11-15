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
7. Data desejada não pode estar no passado. Urgente quando a data desejada fica antes de hoje + antecedência mínima, contando dias úteis de segunda a sexta (sem feriados nesta fase). A urgência é calculada no envio e recalculada no reenvio de um devolvido.
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
