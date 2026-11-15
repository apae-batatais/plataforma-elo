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
1. Peça de credenciais cifradas do Núcleo, tela "Conectar Instagram" e renovação do token. Conferência
   na prévia: conectar e desconectar uma conta fictícia (demonstração, sem Meta de verdade).
2. Post com imagem: aba `Publicacoes`, agendar, rota de mídia temporária, rotina, falha e "Tentar de
   novo".
3. Reel e carrossel (inclui anexar vídeo e os limites de tamanho medidos na hospedagem).

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
