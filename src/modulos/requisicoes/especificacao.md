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

## Agendamento de veículos institucionais (proposta #229, 21/11/2026)

Novo tipo de requisição, com tela própria (mesmo padrão de "Ficha" da proposta #228: um componente
`FichaVeiculo`, sem entrar no `if` da tela única). Sem ADR: o fluxo novo fica dentro do módulo, o
perfil novo é declarado no manifesto como os outros setores e o Núcleo não muda.

### Objetivo e para quem

Quem precisa de um veículo institucional reserva pelo Elo, com finalidade. O setor Transporte
aprova vendo se há conflito de agenda, e depois do uso confirma como foi e registra a
quilometragem. Resultado: dois pedidos não ficam com o mesmo veículo no mesmo horário sem que o
Transporte veja o conflito antes de decidir.

### Usuários e permissões

| Perfil | Pode | Permissão |
| --- | --- | --- |
| Todos os perfis | Pedir um veículo, acompanhar, ajustar a devolvida e cancelar os próprios pedidos enquanto não aprovados | `requisicoes.solicitar` (já existe) |
| Transporte (perfil novo, escopo global) | Ver todos os pedidos de veículo (e só eles), aprovar, devolver, recusar, cancelar reserva aprovada, confirmar o uso com a quilometragem, marcar manutenção feita, ver a agenda | `requisicoes.veiculos.operar`, `requisicoes.painel` |
| Administração da plataforma (só ela) | Cadastrar e alterar veículos e a data de manutenção prevista (e também marcar manutenção feita) | `requisicoes.veiculos.cadastrar` |
| Diretoria | Aprovar o pedido feito por alguém do Transporte (ninguém aprova o próprio) | `requisicoes.aprovar` (já existe) |

Pedido de veículo **não** passa pela coordenação: a aprovação é sempre do Transporte, de qualquer
coordenação. Quem não é Transporte nem Diretoria não vê pedidos dos outros.

### Entidades (planilha `requisicoes`)

Tipo novo em `FORMULARIOS`: `veiculo` (ficha de serviço, categoria "serviço"). O tipo "Uso de
veículo" é cadastrado em Tipos de requisição com perfil responsável `transporte`.

| Aba | O que guarda | Sigilo |
| --- | --- | --- |
| Veiculos (nova) | Nome/identificação, placa, capacidade de passageiros, `ativo` | interno |
| VeiculoManutencoes (nova) | Veículo, data prevista, `feita_em`, `feita_por`, próxima data (vira nova linha). A linha sem `feita_em` é a manutenção pendente (no máximo uma por veículo) | interno (`feita_por`: pessoal) |
| VeiculoUsos (nova) | Requisição, resultado (`sem_problema` ou `com_problema`), texto do problema, km de saída, km de volta, quem registrou e quando | interno (`registrado_por`: pessoal) |
| Requisicoes (existente) | O pedido em si; os campos da ficha vão em `detalhes` (JSON): veículo, saída, volta prevista, destino, finalidade, condutor | `condutor` é dado pessoal |

Pedido de veículo não tem centros de custo nem itens. A área do pedido continua obrigatória
(valem as "áreas permitidas" do tipo).

### Regras de negócio (com teste)

1. **Cadastro:** só a Administração cria e altera veículos (nome, placa, capacidade inteira ≥ 1,
   `ativo`). Nada é apagado: veículo desativado some da lista de pedido novo, mas pedidos antigos
   continuam mostrando o nome.
2. **Campos do pedido (todos obrigatórios):** veículo ativo, saída, volta prevista (depois da
   saída, pode passar de um dia), destino, finalidade/justificativa (mín. 10 letras), condutor
   (nome em texto; já vem preenchido com quem pede e pode ser trocado). Saída não pode estar no
   passado. Horário de Brasília.
3. **Conflito:** dois pedidos do mesmo veículo conflitam quando os períodos se cruzam (a volta de
   um igual à saída do outro não conflita) e os dois estão em "aguardando aprovação" ou
   "aprovada". Pedido recusado, cancelado, devolvido ou encerrado não conta. O conflito **nunca
   bloqueia** o envio nem a aprovação.
4. **Quem pede vê só um aviso** ("este veículo já tem pedido nesse horário; o Transporte decide"),
   sem saber de quem é. **O Transporte vê** os pedidos em conflito, com número, quem pediu, destino
   e situação, na lista e na ficha, antes de decidir.
5. **Aprovar com conflito:** se existe outro pedido **aprovado** no mesmo horário, o Transporte
   confirma explicitamente antes de aprovar; a confirmação vai no comentário do histórico. Se o
   conflito é só com pedidos ainda aguardando, aprova sem confirmação.
6. **Caminho:** enviada → aprovada | devolvida | recusada; devolvida → enviada | cancelada;
   aprovada → usada | usada com problema | cancelada. Não há "em atendimento". Devolver e recusar
   exigem comentário (como hoje). Cancelar reserva aprovada é só do Transporte e exige comentário
   (é o jeito de resolver conflito e aviso de manutenção na mão).
7. **Quem aprova:** só o Transporte; se quem pediu é do Transporte, aprova a Diretoria. Ninguém
   aprova o próprio pedido.
8. **Manutenção preventiva:** o veículo tem no máximo uma manutenção pendente, com data prevista.
   A partir do **dia da data prevista** (inclusive) e até marcarem como feita, o veículo não está
   disponível para pedido novo cujo período toque esse dia ou dias seguintes: não aparece na lista
   para esse período e o servidor recusa se vier mesmo assim. Antes da data o veículo funciona
   normal. Marcar como feita (Administração ou Transporte) registra quem e quando e pode informar
   a próxima data (cria nova linha pendente); a próxima data não pode ser anterior a hoje.
9. **Aviso de manutenção:** pedido já aprovado (ou aguardando) cujo período toca a partir da data
   prevista **não é cancelado sozinho**; o Transporte vê o aviso "veículo em manutenção a partir de
   dd/mm" na lista e na ficha do pedido, para resolver na mão (regra 6).
10. **Fechamento:** só o Transporte, só em pedido aprovado e depois do horário de saída, escolhe
    "usado sem problema" ou "usado com problema". "Com problema" exige texto explicando. Os dois
    exigem quilometragem de saída e de volta (inteiros ≥ 0, volta ≥ saída). Fechar encerra o
    pedido; fica uma linha em `VeiculoUsos` e a data de conclusão (`concluida_em`).
11. **Prazos:** só o prazo de aprovação conta para veículos (o do atendimento fica zerado no tipo e
    é ignorado no painel de prazos, que não lista veículo na parte de atendimento).
12. **Anexos:** o tipo "Uso de veículo" não aceita foto nem vídeo (marcado `nao` no cadastro).
13. **Auditoria:** toda gravação registra colunas alteradas (nunca valores). Ler o condutor e o
    histórico segue a regra de quem vê a requisição. Nada é apagado: pedido, manutenção e uso só
    recebem inclusões e mudança de situação.

### Telas

1. **Pedir veículo** (`/requisicoes/nova`, tipo "Uso de veículo", `FichaVeiculo`). Quem pede quer
   reservar em poucos cliques: escolher tipo → veículo → saída/volta → destino/finalidade →
   "Enviar pedido". Primeira dobra: tipo, veículo e período. Ao escolher veículo e período aparece
   o aviso de conflito (regra 4) ou de manutenção (veículo indisponível: some da lista e uma dica
   diz "alguns veículos não aparecem porque estão em manutenção nessas datas"). Campos: veículo
   (lista com nome, placa e capacidade), saída e volta prevista (data e hora, rótulos sempre
   visíveis, dica "dia/mês/ano hora:minuto"), destino, finalidade (dica: "para que será usado"),
   condutor (já preenchido). Erro: nada digitado se perde, a mensagem diz o campo. Celular:
   campos em coluna, data e hora nativas do aparelho.
2. **Para aprovar (Transporte):** a lista que já existe, com todos os pedidos de veículo,
   ordenados pela saída, com selo "Conflito" e "Manutenção" nos que têm. Ficha: dados do pedido,
   quadro "Pedidos neste horário" (conflitos) e botões **Aprovar pedido**, **Devolver**, **Recusar**.
   Aprovar com conflito abre confirmação: "Já existe um pedido aprovado nesse horário (REQ-…).
   Aprovar mesmo assim? Você resolve o outro depois." Recusar e devolver pedem o comentário.
3. **Para atender (Transporte):** reaproveita o menu; mostra pedidos aprovados cuja saída já
   passou, com **Confirmar uso**: um formulário com resultado (duas opções), texto do problema
   (aparece só em "com problema"), km de saída e km de volta. Sem volta: a confirmação explica
   "ao confirmar, o pedido é encerrado e não pode ser reaberto".
4. **Agenda dos veículos (Transporte, nova, `/requisicoes/veiculos/agenda`):** por veículo, os
   próximos 30 dias com pedidos aprovados e aguardando, e a manutenção prevista. Vazio: "Nenhum
   pedido de veículo nos próximos 30 dias." Leitura apenas.
5. **Veículos (Administração, nova, `/requisicoes/veiculos`):** lista e formulário no mesmo molde
   de "Tipos de requisição": nome, placa, capacidade, ativo, manutenção prevista, botão
   **Marcar manutenção feita** (pede a próxima data, opcional).
6. **Estados:** sem veículo cadastrado, a ficha diz "Nenhum veículo disponível. Peça à
   Administração para cadastrar." Sem permissão: mensagem padrão do módulo. Gravando/gravou/erro:
   padrão do módulo.
7. **Componentes de `src/ui/`:** os mesmos de Tipos de requisição e da ficha de requisição (formulário,
   lista, selos, confirmação). Nenhuma peça nova no Núcleo.

Sem gráfico nesta entrega.

### Melhorias que eu sugiro (não entram, a Diretoria decide)

- Campo "quantos passageiros" no pedido, conferido com a capacidade do veículo.
- Aviso por e-mail ao Transporte quando entra pedido de veículo (depende do Gmail, já no "Depois").
- Relatório de quilometragem e de usos com problema por veículo e mês.

### Fica de fora

Reserva de espaços (#230), centros de custo e rateio por veículo, abastecimento, multas,
vistoria com foto, manutenção corretiva, histórico de manutenções na tela (fica gravado em
`VeiculoManutencoes`), condutor ligado ao cadastro de pessoas.

### Decisões tomadas sozinho (e o que custam se estiverem erradas)

- **Condutor em texto livre**, não ligado a usuário do Elo (o motorista pode não ter acesso).
  Errado: trocar para escolha de pessoa exige migrar o campo (baixo).
- **Sem centros de custo** no pedido de veículo (a proposta não os cita). Errado: reaproveitar o
  bloco comum de centros (médio, muda a aprovação).
- **Diretoria aprova só quando o pedido é de alguém do Transporte** (para ninguém aprovar o
  próprio). Errado: dar à Diretoria a aprovação geral é uma permissão a mais (baixo).
- **Aprovar com conflito pede confirmação** quando o outro pedido já está aprovado. Errado: tirar
  a confirmação é só tela (baixo).
- **Cancelar reserva aprovada** é do Transporte, com comentário (a proposta não diz como resolver
  o aviso de manutenção). Errado: custo baixo.
- **Fechamento liberado depois do horário de saída**, não só depois da volta prevista, para
  permitir fechar uso que terminou antes. Errado: baixo.
- **Manutenção feita pode ser marcada por Transporte e Administração** (a proposta diz "alguém").
  Errado: baixo.
- **Veículo em manutenção** a partir do dia da data prevista, inclusive. Errado: baixo.
- **Histórico de manutenção em aba própria**, para nada ser apagado ao informar a próxima data.
- **Quem pede vê só o aviso de conflito**, sem dados do outro pedido (privacidade).
- **Anexos desligados** para o tipo. Errado: ligar no cadastro, sem código.

### Frentes

`telas` (ficha, agenda, cadastro de veículos), `regras e dados` (abas, permissões e perfil
`transporte` no manifesto, conflito, manutenção, fechamento, testes de quem vê e quem altera).
Sem `infraestrutura`. A tela segue o padrão de Ficha da #228; se a #228 ainda não tiver entrado, a
entrega 2 cria `FichaVeiculo` já como componente próprio.

### Entregas

1. **Cadastro de veículos e manutenção:** abas `Veiculos` e `VeiculoManutencoes`, tela Veículos,
   permissão `requisicoes.veiculos.cadastrar`, "Preparar estrutura".
2. **Pedido e aprovação:** perfil Transporte, ficha, tipo "Uso de veículo", conflito, aviso de
   manutenção, aprovar/devolver/recusar/cancelar reserva, agenda.
3. **Fechamento:** "Confirmar uso", quilometragem e `VeiculoUsos`.

### Critérios de pronto

- [ ] Prévia: Administração cadastra dois veículos e uma data de manutenção; o veículo some da
      lista para períodos a partir da data e volta ao marcar manutenção feita.
- [ ] Dois pedidos no mesmo veículo e horário: quem pede vê só o aviso; o Transporte vê o conflito
      na lista e na ficha, aprova um (confirmando se já havia aprovado) e recusa o outro.
- [ ] Pedido aprovado antes de uma manutenção ser cadastrada continua aprovado e mostra o aviso.
- [ ] Depois da saída, o Transporte confirma o uso sem e com problema; km de volta menor que a de
      saída é recusada; "com problema" sem texto é recusado.
- [ ] Quem não é Transporte nem Diretoria não vê pedidos de veículo dos outros.
- [ ] `npm run verificar` e `npm run build` verdes.
