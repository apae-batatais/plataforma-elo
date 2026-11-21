# Especificação — Módulo Requisições

- Situação: aprovada em 31/10/2026 pela Diretoria
- Dono do produto: Diretoria

## Objetivo

Qualquer pessoa da equipe pede materiais ou serviços pelo Elo. A coordenação dos centros de custo
aprova, o setor responsável atende, e tudo fica registrado com data e hora para medir os prazos (SLA).

## Entregas (um tipo de ficha por PR, cada um validado antes do seguinte)

1. **Base do módulo + Materiais (Almoxarifado)** — esta entrega.
2. **TI (Setor de Informática)**: ficha de chamado (categoria, equipamento, patrimônio, local, problema, urgência, contato), perfil novo Setor de Informática, urgência na fila. Material de informática usa a ficha de materiais com o Setor de Informática.
3. **Mobiliário (Setor de Patrimônio)**: ficha com o que fazer (mudar de lugar, emprestar, recolher, montar/desmontar, outro), lista de móveis (quantidade, descrição, patrimônio), de onde, para onde, para quando e devolução (empréstimo); perfil novo Setor de Patrimônio.
4. **Manutenção (Setor de Manutenção)**: ficha com tipo de serviço (elétrica, hidráulica, ar-condicionado, equipamento, portas/janelas/móveis, pintura, paredes/piso/telhado, outro), local, problema, urgência, equipamento, patrimônio, melhor horário e contato; perfil novo Setor de Manutenção; urgência na fila. Fotos e vídeo: entrega 6.
5. **Painel de prazos e feriados**: painel com % de aprovação e de atendimento no prazo, tempo médio, atendidas em parte e atrasadas agora, por mês, setor e tipo; feriados fora das horas úteis (a lista é do Núcleo: Administração › Feriados, ADR-034).
6. **Fotos e vídeo (ADR-014)**: até 3 fotos (reduzidas no celular) e 1 vídeo de até 30 s / 25 MB, gravados direto na abertura; arquivos numa pasta de unidade compartilhada do Drive da instituição; o tipo diz se aceita.

## Usuários e permissões

| Perfil                               | Pode                                                                                              | Permissão                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Todos os perfis                      | Abrir requisições, acompanhar as próprias, ajustar as devolvidas, cancelar enquanto não aprovadas | `requisicoes.acessar`, `requisicoes.solicitar`          |
| Coordenação de serviço               | Aprovar, devolver ou recusar as dos centros de custo do seu escopo                                | `requisicoes.aprovar` (escopo)                          |
| Diretoria                            | Aprovar qualquer uma (e as da própria coordenação e de serviços sem coordenação); ver todas       | `requisicoes.aprovar` (global), `requisicoes.ver_todas` |
| Almoxarifado (perfil novo)           | Receber e atender as dos tipos ligados a ele                                                      | `requisicoes.atender`                                   |
| Setor de Informática (perfil novo)   | Receber e atender chamados de TI e material de informática                                        | `requisicoes.atender`                                   |
| Setor de Patrimônio (perfil novo)    | Receber e atender as requisições de mobiliário                                                    | `requisicoes.atender`                                   |
| Setor de Manutenção (perfil novo)    | Receber e atender os pedidos de manutenção                                                        | `requisicoes.atender`                                   |
| Setor Cozinha (perfil novo)          | Receber e atender as requisições da cozinha (tipo Requisição Cozinha)                             | `requisicoes.atender`, `requisicoes.painel`             |
| Administração da plataforma (só ela) | Criar e alterar tipos, áreas permitidas, itens aceitos e expediente (feriados: `core.feriados.gerenciar`)                    | `requisicoes.tipos.gerenciar`                           |
| Diretoria, coordenação e setores     | Ver o painel de prazos (só das requisições que já podem ver)                                      | `requisicoes.painel`                                    |

## Entidades (planilha `requisicoes`)

| Aba           | O que guarda                                                                                                                                       | Sigilo                |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Tipos         | Nome, categoria, ficha, perfil que atende, prazos (horas úteis), áreas permitidas (vazio = todas); coluna de grupos não é mais usada               | interno               |
| CatalogoItens | Itens aceitos por tipo (descrição e unidade). Tipo sem itens aceita texto livre                                                                    | interno               |
| Requisicoes   | Número, tipo, quem pediu, área, grupo de despesa (só pedidos até 04/11/2026), situação, quem aprova, detalhes da ficha (JSON), datas de cada etapa | pessoal: requisitante |
| Centros       | Serviço e percentual de cada requisição (somam 100%)                                                                                               | interno               |
| Itens         | Quantidade, unidade, descrição, item da lista (quando houver) e quanto foi entregue                                                                | interno               |
| Historico     | Cada mudança de etapa: quando, quem, de/para, comentário (só inclusões)                                                                            | pessoal: usuário      |
| Parametros    | Expediente (início e fim) usado no SLA                                                                                                             | interno               |
| Feriados      | Aba antiga: só leitura, copiada para o Núcleo em "Preparar estrutura" (a lista vive no Núcleo, ADR-034)                                            | interno               |
| Anexos        | Fotos e vídeo de cada requisição: id do arquivo na pasta de anexos, tipo, tamanho, duração                                                         | sensível: arquivo     |

O grupo de despesa saiu da ficha e do cadastro de tipos em 04/11/2026 (decisão da Diretoria); a ligação com o Orçamento foi removida (ADR-013, Atualização).

## Regras de negócio (com teste)

1. Centros de custo: um ou mais serviços, sem repetir, somando exatamente 100%.
2. Todos os centros precisam ter a mesma coordenação (perfil com `requisicoes.aprovar` em escopo de serviço, área ou unidade que cobre o serviço). Coordenações diferentes: o Elo não deixa enviar.
3. Quem pede é dessa coordenação → aprova a Diretoria. Serviço sem coordenação → aprova a Diretoria.
4. Caminho: enviada → aprovada | devolvida | recusada; devolvida → (ajuste) enviada | cancelada; aprovada → em atendimento → atendida | atendida em parte. Cancelar só enquanto não aprovada, e só quem pediu.
5. Devolver e recusar exigem comentário; atendimento parcial exige explicação.
6. Só o setor do tipo (perfil responsável + `requisicoes.atender`) recebe e conclui; ninguém aprova a própria requisição.
7. Nada é apagado: centros e itens trocados no ajuste ficam com `ativo = FALSE`; o histórico só recebe inclusões; toda gravação registra auditoria só com colunas.
8. SLA em horas úteis (segunda a sexta, expediente padrão 8h–17h, horário de Brasília). Aprovação: do envio (ou reenvio) à decisão. Atendimento: da aprovação à conclusão.
9. Número sequencial no ano: REQ-AAAA-NNNN.
10. O tipo só aceita as áreas marcadas (sem marcação, todas). A ficha não pede grupo de despesa (desde 04/11/2026).
11. Tipo com lista de itens só aceita itens da lista (pela descrição, sem diferença de acento ou maiúscula); descrição e unidade gravadas vêm da lista. Tirar um item da lista não muda requisições já feitas.
12. Tipos de requisição: só a Administração da plataforma da instituição cria e altera. "Preparar estrutura" retira a permissão que a Diretoria recebeu na versão 0.9.0 (`permissoesRetiradas` no manifesto).
13. Chamado de TI: categoria, local, problema (mín. 10 letras) e urgência são obrigatórios; não tem itens; tipo com ficha de chamado é sempre "serviço". Concluir exige dizer se resolveu e o que foi feito (resolvido em parte → "atendida em parte").
14. Mobiliário: o que fazer, pelo menos um móvel (quantidade inteira), de onde e para quando são obrigatórios; mudar de lugar e emprestar exigem para onde; emprestar exige a devolução (não antes da data). Concluir como chamado (feito ou em parte, com o que foi feito).
15. Manutenção: tipo de serviço, local, problema (mín. 10 letras) e urgência são obrigatórios; não tem itens; tipo é sempre "serviço". Concluir como chamado (resolvido ou em parte, com o que foi feito).
16. Feriados (ADR-034): a lista é do Núcleo (Administração › Feriados, `core.feriados.gerenciar`); o SLA a lê de lá; os feriados não contam nas horas úteis de nenhum prazo (inclusive de requisições antigas, ao recalcular).
17. Painel de prazos (`requisicoes.painel`: Diretoria, coordenação e setores): mostra só as requisições que a pessoa já pode ver. Aprovação conta no mês da decisão (aprovar, devolver ou recusar), com horas do envio à decisão; atendimento conta no mês da conclusão, com horas da aprovação à conclusão. Atrasadas agora: esperando decisão ou atendimento além do prazo.
18. Fotos e vídeo: só nos tipos que aceitam (marcados no cadastro; sem marcação, as fichas de serviço); até 3 fotos de até 1,4 MB (já reduzidas) e 1 vídeo de até 30 s e 25 MB, em JPG/PNG/WebP e MP4/MOV/WebM/3GP. O servidor confere cada arquivo na pasta antes de ligar à requisição; um arquivo só pertence a uma requisição. Só quem vê a requisição vê os anexos, pelo Elo, e cada abertura vai para a auditoria. Ao ajustar uma devolvida, os anexos tirados são encerrados.

## Telas

1. Minhas requisições, Para aprovar, Para atender, Todas (lista com situação e prazo da etapa).
2. Nova requisição / Ajustar: ficha de materiais (tipo, área, centros com %, itens, retirada ou entrega, evento, utensílios, observações).
3. Ficha da requisição: dados, prazos, ações de quem pode agir, histórico e Imprimir.
4. Tipos de requisição (setor, prazos, áreas permitidas, expediente do SLA) e Itens aceitos de cada tipo (um a um ou em lote).
5. Painel de prazos: cartões, gráfico mês a mês, tabelas por mês, setor e tipo, atrasadas agora.
6. Avisos: tela inicial ("N esperam a sua aprovação", "N na fila do seu setor", "N devolvidas") e número no menu.

## Indicadores

| Código                           | Cálculo                                                 | Referência       |
| -------------------------------- | ------------------------------------------------------- | ---------------- |
| requisicoes_aprovacao_no_prazo   | % de requisições decididas dentro do prazo de aprovação | Painel de prazos |
| requisicoes_atendimento_no_prazo | % de atendimentos concluídos dentro do prazo            | Painel de prazos |

## Depois

- Aviso por e-mail (precisa de ligação com o Gmail).
- Ligar a requisição à execução do orçamento (1C): especificado na issue #115, em `docs/especificacao-ligacoes-entre-apps.md` (projeto, atividade, saldo e fonte na aprovação).

## Agendamento de espaços (proposta #230, 21/11/2026)

### Objetivo e para quem

Qualquer pessoa da equipe reserva um espaço da instituição (salão, sala de reuniões, salão de
eventos) para reunião ou evento, escolhendo espaço, data, horário, finalidade e número de pessoas.
O perfil **Espaços** aprova vendo o conflito de agenda e, depois do uso, registra se o espaço foi
usado com ou sem problema. Hoje isso é combinado fora do Elo, sem controle nem registro.

É um **tipo novo de requisição, com ficha e tela próprias** (padrão da #228, proposta #234). Veículos
(#229) é uma proposta irmã: aprovador por perfil dedicado, conflito visto por quem aprova e
fechamento depois do uso são a mesma ideia. Quem for construído primeiro cria a parte comum
(aprovação por perfil dedicado, caminho "aprovada → fechada", aviso de conflito); o outro a reaproveita.
Sem ADR: tudo acontece dentro do módulo (ficha, perfil e abas novas), sem mudar Núcleo nem
armazenamento.

### Usuários e permissões

| Perfil | Pode | Permissão |
| --- | --- | --- |
| Todos os perfis | Pedir um espaço, acompanhar, ajustar a devolvida e cancelar o próprio pedido enquanto não aprovado | `requisicoes.solicitar` |
| Espaços (perfil novo) | Ver e decidir (aprovar, devolver, recusar) **todos** os pedidos de espaço, de qualquer coordenação; ver o conflito; fechar a reserva depois do uso | `requisicoes.espacos.decidir` (nova) |
| Diretoria | Ver todos (`requisicoes.ver_todas`); aprovar pedido de espaço **feito por quem tem o perfil Espaços** (ninguém aprova o próprio pedido) | `requisicoes.espacos.decidir` (nova) |
| Administração da plataforma | Cadastrar espaços e os períodos de indisponibilidade; criar o tipo "Reserva de espaço" | `requisicoes.tipos.gerenciar` (já existe) |

A coordenação do centro de custo **não** aprova pedido de espaço (diferente do resto das requisições).
Quem pede vê só os próprios pedidos; só quem decide vê os pedidos dos outros no conflito.

### Entidades (planilha `requisicoes`, abas novas com `definirTabela`)

| Aba | O que guarda | Sigilo |
| --- | --- | --- |
| Espacos | Nome, local ou unidade (texto), capacidade (pessoas), ativo | interno |
| EspacoIndisponibilidades | Espaço, data de início, data de fim, motivo (reforma, obra…), ativo. Um espaço pode ter vários períodos | interno |

O pedido é uma linha de `Requisicoes` como as outras. Os dados do espaço vão no JSON `detalhes`
(`DetalhesEspaco`): id do espaço, data, hora de início, hora de fim, finalidade, pessoas esperadas.
A ficha nova é `espaco` em `FORMULARIOS` (categoria "serviço", sem itens, sem centros de custo, sem
anexos). Fechamento (resultado "sem problema" ou "com problema" e o texto) é gravado na mesma
requisição, com data e quem fechou; o histórico recebe a inclusão. Coluna pessoal: as mesmas de hoje.

### Regras de negócio (com teste)

1. **Campos obrigatórios:** espaço, data, hora de início, hora de fim, finalidade (mín. 5 letras) e
   pessoas esperadas (inteiro ≥ 1). Reserva é de **um dia só** (início e fim na mesma data) e o fim
   é depois do início. Data não pode ser anterior a hoje (horário de Brasília).
2. **Espaço indisponível:** espaço inativo, ou com período de indisponibilidade que cobre a data
   pedida, não é aceito no pedido (nem no reenvio). A lista de espaços da tela já mostra só os
   disponíveis na data escolhida.
3. **Período novo sobre pedido já aprovado:** nada é cancelado sozinho; o pedido aprovado que cai
   no período aparece com aviso para o Espaços resolver na mão (devolvendo ou fechando com texto).
4. **Capacidade:** pessoas acima da capacidade do espaço **não bloqueiam**; o pedido é enviado com
   aviso, e o aviso aparece de novo para quem decide.
5. **Conflito:** dois horários se cruzam quando, no mesmo espaço e data, `início < fim do outro` e
   `início do outro < fim` (encostar, como 10h–11h e 11h–12h, não conflita). Contam só pedidos
   "aguardando aprovação" e "aprovada". O pedido nunca é bloqueado por conflito; quem decide vê a
   lista dos que cruzam (quem pediu, horário, situação). Aprovar com conflito contra um pedido já
   **aprovado** pede confirmação explícita; contra outro só enviado, não.
6. **Quem decide:** pedido com ficha `espaco` vai sempre para o Espaços (regra 2 e 3 das regras
   gerais não se aplicam: sem centros de custo, sem coordenação). Quem tem o perfil Espaços e pede,
   é aprovado pela Diretoria. Ninguém decide o próprio pedido.
7. **Caminho:** enviada → aprovada | devolvida | recusada; devolvida → enviada | cancelada;
   aprovada → **usada** (fechada). Sem "receber" nem "em atendimento". Cancelar só enquanto não
   aprovada, só quem pediu (igual às outras).
8. **Fechamento:** só o Espaços, só depois que a hora de fim passou, só em pedido aprovado. Resultado
   obrigatório: "usado sem problema" ou "usado com problema"; este exige texto explicando
   (mín. 10 letras). Fechado não reabre. Situação final: "Atendida" (o resultado e o texto ficam
   na ficha e no histórico).
9. **Prazos:** só o prazo de aprovação (horas úteis) vale para esse tipo; não há prazo de atendimento
   (o painel de prazos não conta o fechamento no "atendimento no prazo").
10. **Cadastro:** só a Administração da plataforma cria e altera espaços e períodos; nome obrigatório
    e sem repetir entre os ativos; capacidade inteira ≥ 1; período com fim não antes do início. Nada
    é apagado: espaço e período encerrados ficam com `ativo = FALSE`. Pedido antigo mantém o espaço
    mesmo se ele for inativado.
11. Toda gravação registra auditoria só com colunas; toda leitura da lista de pedidos passa pelo
    `Autorizador`, e o conflito só aparece para quem tem `requisicoes.espacos.decidir`.

### Telas

1. **Pedir um espaço** (`/requisicoes/nova`, ficha própria `FichaEspaco`, como na #228).
   - Quem usa e quer: qualquer pessoa reservar um espaço. Caminho: escolher o tipo, preencher,
     "Enviar pedido" (3 passos).
   - Ordem dos campos (primeira dobra: tudo cabe sem rolar no computador): **Data**, **Hora de
     início**, **Hora de fim**, **Espaço** (só os disponíveis na data; mostra a capacidade ao lado do
     nome), **Pessoas esperadas**, **Finalidade ou evento**, Observações. Ação principal: "Enviar pedido".
   - Componentes de `src/ui/`: os mesmos campos e botões da ficha atual; sem peça nova.
   - Estados: sem espaço disponível na data → "Nenhum espaço está disponível nesta data. Escolha
     outra data." Gravando → botão desabilitado "Enviando…". Enviado → leva para a ficha com "Pedido
     enviado. O setor de Espaços vai responder." Erro → mensagem no topo, **o que foi digitado
     fica**. Acima da capacidade → aviso amarelo, não impede o envio. Sem permissão: tipo não aparece.
   - Rótulos sempre visíveis; dica de formato em data e hora; obrigatórios marcados.
   - Celular: campos em uma coluna, teclado de data e hora do aparelho.
2. **Ficha da requisição (espaço):** mostra os dados do pedido e, para o Espaços, o bloco
   **"Conflitos neste horário"** acima dos botões (lista de quem cruza, ou "Nenhum pedido cruza com
   este horário"). Ações do Espaços: "Aprovar reserva", "Devolver para ajuste", "Recusar" (os dois
   últimos exigem comentário). Aprovar com conflito já aprovado abre confirmação: "Este horário já
   está aprovado para outro pedido. Aprovar mesmo assim?" (a ação não tem volta; só devolve-se
   ajustando manualmente).
3. **Fechar reserva:** na ficha de pedido aprovado cuja hora de fim passou, o Espaços vê "Registrar
   uso" com duas opções "Usado sem problema" / "Usado com problema" (este abre o campo de texto).
   Antes da hora: o botão fica desabilitado com "Disponível depois de HH:MM de DD/MM".
4. **Fila do Espaços:** em "Para aprovar" (pedidos enviados) e em uma aba nova **"Para fechar"**
   (aprovados cuja hora de fim passou). Aviso de início de tela: "N esperam a sua decisão" e "N
   reservas para registrar o uso".
5. **Espaços** (Administração › Requisições): lista dos espaços com "Novo espaço"; em cada um, nome,
   local, capacidade, ativo e a lista de **períodos de indisponibilidade** (início, fim, motivo, com
   "Adicionar período" e "Encerrar período"). Vazio: "Nenhum espaço cadastrado. Cadastre o primeiro
   para liberar os pedidos."
6. **Agenda (sugestão, não obrigatória):** lista dos próximos dias com filtro de espaço, para o
   Espaços ver a ocupação sem abrir pedido por pedido. Veja "Decisões tomadas sozinho".

### Fica de fora

Repetição (toda terça às 14h); itens de apoio, taxa de uso e aprovador por espaço; formulário
público para quem é de fora; reserva de mais de um dia; cancelar reserva já aprovada; marcar
"não usado" (reserva que ninguém usou); aviso por e-mail (entra com a #61 se a Diretoria quiser).

### Decisões tomadas sozinho (com o custo se estiverem erradas)

- **Reserva de um dia só.** O pedido traz uma data e duas horas, como a proposta descreve. Se
  errado (evento de vários dias): trocar para início e fim com data; custo médio na regra 1 e 5.
- **Sem centros de custo, anexos nem prazo de atendimento** nesse tipo: espaço não consome verba e
  a proposta não os cita. Se errado: acrescentar o bloco comum da ficha; custo baixo.
- **Ordem data → horário → espaço** na tela, para só mostrar espaços disponíveis na data. Se errado:
  espaço primeiro, com aviso depois; custo baixo.
- **Capacidade só avisa**, em linha com "conflito não bloqueia". Se errado: bloquear; custo baixo.
- **Aprovar sobre conflito já aprovado pede confirmação**, para evitar clique por engano.
- **Diretoria aprova o pedido de quem é do Espaços**, para ninguém decidir o próprio pedido
  (regra 6 geral). Se errado: custo baixo.
- **Vários períodos de indisponibilidade por espaço** (a proposta diz "um período"; veículos usa
  uma data por vez). Se errado: limitar a um; custo baixo.
- **Reserva fechada fica "Atendida"**, reaproveitando a situação existente, com o resultado separado;
  evita situação nova nas listas e no painel.
- **Cancelar reserva já aprovada** e **"não usado"** ficam fora (sugestões abaixo).
- **Tipo "Reserva de espaço" é criado pela Administração** no cadastro de tipos, não por "Preparar
  estrutura"; o perfil e a permissão novos entram pelo manifesto.
- Nenhum nome real nas telas ou dados fictícios: "Espaço 1", "Sala de reuniões" etc.; os nomes
  verdadeiros são cadastrados pela instituição.

### Sugestões de melhoria (para a Diretoria decidir)

- Permitir ao Espaços **cancelar uma reserva aprovada** (com motivo), liberando o horário.
- Opção "Não foi usado" no fechamento.
- Agenda por dia com filtro de espaço (tela 6).

### Frentes

`telas` (ficha, bloco de conflito, fechamento, cadastro), `regras e dados` (ficha `espaco`, abas
novas, conflito, caminho e fechamento, perfil e permissão novos, testes de quem vê e quem decide).
Sem `infraestrutura`.

### Entregas

Uma só, conferível na prévia (dados fictícios com dois espaços e pedidos que se cruzam). Depende
da #228 (ficha própria por tipo): construir depois dela.

### Critérios de pronto

- [ ] Pedir um espaço: data → hora → espaço disponível; espaço com período de indisponibilidade
      na data não aparece.
- [ ] Dois pedidos no mesmo horário: ambos enviam; o Espaços vê o conflito na ficha e confirma ao aprovar.
- [ ] Coordenação comum e quem pediu não aprovam; só Espaços (e Diretoria no caso de pedido do Espaços).
- [ ] Fechar só depois da hora de fim; "com problema" exige texto.
- [ ] Administração cadastra espaço e período; ninguém mais.
- [ ] `npm run verificar` e `npm run build` verdes.
