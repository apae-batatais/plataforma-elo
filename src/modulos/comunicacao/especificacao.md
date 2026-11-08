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

## Critérios de pronto

- [ ] Regras de negócio com testes
- [ ] Testes de acesso para cada aba (quem vê e quem altera)
- [ ] `npm run verificar` e `npm run build` verdes
- [ ] Conferido pela Diretoria na prévia com dados fictícios, com os três perfis
