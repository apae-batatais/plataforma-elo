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
7. **Aviso por e-mail (resumo diário, #61, ADR-027)**: resumo diário por e-mail para quem tem requisição aguardando a aprovação dela, devolvida para ela ajustar, ou atrasada no seu escopo, reaproveitando a ligação com o Gmail da Comunicação (#63).

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
| ResumosEnviados | Um dia (AAAA-MM-DD) por instituição e quantas pessoas receberam o resumo diário naquele dia (entrega 7)                                          | interno               |

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
19. **Resumo diário por e-mail (entrega 7, ADR-027)**: a rotina (a cada 15 minutos) roda a tarefa `requisicoes.resumo_diario`. Para cada instituição ativa com remetente de e-mail cadastrado (ADR-027), em dia útil (sem fim de semana nem feriado do Núcleo, regra 16), entre 7h e 12h de Brasília (a primeira rodada da janela envia; as seguintes veem o dia já gravado), calcula para cada pessoa ativa: quantas requisições aguardam a aprovação dela (mesmo critério da tela "Para aprovar"), quantas ela tem devolvidas para ajuste e ainda não reenviou (mesmo critério de "Minhas requisições"), e quantas, no escopo dela de aprovação ou atendimento, estão atrasadas agora (mesmo critério do painel de prazos, regra 17). Sem nenhuma das três, não envia nada para essa pessoa; sem remetente cadastrado na instituição, a tarefa não roda (sem erro).
20. O e-mail do resumo é individual (não em cópia oculta), com as três contagens que forem maiores que zero e um link para abrir o Elo — sem número de requisição, nome de requisitante nem texto do pedido, a mesma regra dos avisos da Comunicação (ADR-027, item 5).
21. O resumo de uma instituição nunca sai duas vezes no mesmo dia: a tarefa grava o dia do envio (horário de Brasília) e quantas pessoas receberam na aba `ResumosEnviados` antes de mandar os e-mails; a rotina só tenta de novo se ainda não houver essa linha para o dia de hoje. Falha ao enviar para uma pessoa não impede o resumo das demais.

## Telas

1. Minhas requisições, Para aprovar, Para atender, Todas (lista com situação e prazo da etapa).
2. Nova requisição / Ajustar: ficha de materiais (tipo, área, centros com %, itens, retirada ou entrega, evento, utensílios, observações).
3. Ficha da requisição: dados, prazos, ações de quem pode agir, histórico e Imprimir.
4. Tipos de requisição (setor, prazos, áreas permitidas, expediente do SLA) e Itens aceitos de cada tipo (um a um ou em lote).
5. Painel de prazos: cartões, gráfico mês a mês, tabelas por mês, setor e tipo, atrasadas agora.
6. Avisos: tela inicial ("N esperam a sua aprovação", "N na fila do seu setor", "N devolvidas") e número no menu.
7. Resumo diário por e-mail: sem tela própria; usa o remetente já cadastrado na instituição (ADR-027). Melhoria sugerida, para a Diretoria decidir: mostrar na tela de Avisos (item 6) se o resumo de hoje já saiu e para quantas pessoas, para a coordenação conferir sem abrir o e-mail.

## Indicadores

| Código                           | Cálculo                                                 | Referência       |
| -------------------------------- | ------------------------------------------------------- | ---------------- |
| requisicoes_aprovacao_no_prazo   | % de requisições decididas dentro do prazo de aprovação | Painel de prazos |
| requisicoes_atendimento_no_prazo | % de atendimentos concluídos dentro do prazo            | Painel de prazos |

## Tela própria por tipo de requisição (proposta #228, 21/11/2026)

### Objetivo

Hoje `formulario-requisicao.tsx` é um componente só, que muda os campos mostrados com `if`
conforme o tipo escolhido (materiais, TI, mobiliário, manutenção). Esta entrega separa cada tipo
numa tela própria (componente próprio), deixando o padrão pronto para os tipos novos de
agendamento (veículos, #229; espaços, #230) nascerem já com tela própria, em vez de entrarem no
mesmo `if`.

Sem mudança de regra de negócio, de dado gravado ou de permissão: é só reorganização de tela. Sem
ADR (não muda arquitetura, armazenamento nem Núcleo).

### O que já existe (conferido no código em 21/11/2026)

- `telas/formulario-requisicao.tsx` (770 linhas) tem: um bloco comum a todos os tipos (Tipo e
  Área; Centros de custo com percentual; Anexos; Observações; aviso de erro; botão Enviar) e
  quatro blocos condicionais (`tipo?.formulario === '...'`): materiais (itens, retirada ou
  entrega, evento, utensílios), TI (categoria, equipamento, patrimônio, local, problema, urgência,
  contato), mobiliário (o que fazer, móveis, origem, destino, data, devolução, contato) e
  manutenção (tipo de serviço, local, equipamento, patrimônio, problema, horário, urgência,
  contato).
- Só existe uma rota, `/requisicoes/nova` (e `/requisicoes/[id]/editar`, para ajustar uma
  devolvida), que usa esse componente único.

### Regra (com teste, mas de tela — ver "Telas")

1. A pessoa continua escolhendo o tipo no mesmo lugar (`/requisicoes/nova`); ao escolher, aparece
   só a ficha daquele tipo. Nada muda na navegação nem na URL.
2. Cada tipo tem seu próprio componente de ficha, que só conhece os campos daquele tipo; o
   componente comum (Tipo e Área, Centros de custo, Anexos, Observações, Enviar) não sabe nada de
   nenhum tipo específico.
3. O JSON gravado em `Requisicoes.detalhes` (o formato de cada `Detalhes...` em
   `dominio/requisicao.ts`) não muda: é o mesmo formato de hoje, só a tela que monta é outra.

### Telas

1. **Quem usa e o que quer fazer:** quem abre uma requisição escolhe o tipo e preenche só os
   campos daquele tipo, sem ver nem rolar por campos de outros tipos. Caminho: igual ao de hoje
   (escolher tipo → preencher → enviar).
2. **Componentes:** um componente "casco" (`FormularioRequisicao`, o arquivo que existe hoje,
   enxuto) cuida do que é comum: Tipo e Área, Centros de custo, Anexos, Observações, erro e Enviar.
   Para cada tipo, um componente próprio novo: `FichaMateriais`, `FichaTi`, `FichaMobiliario`,
   `FichaManutencao` (em `telas/`), cada um recebendo e devolvendo só os dados do seu tipo. O
   casco escolhe qual Ficha mostrar pelo `tipo.formulario`, do mesmo jeito que hoje escolhe qual
   bloco do `if` mostrar.
3. **Sem tela nova para a Diretoria conferir** além de abrir cada tipo e ver que a ficha continua
   igual à de hoje (mesmos campos, mesma ordem, mesmo texto) — é refatoração, não mudança visual.
4. **Celular e teclado:** sem mudança (já funciona hoje).

### Fica de fora

Veículos (#229) e espaços (#230) entram como Fichas novas nas próprias propostas, seguindo este
padrão; não fazem parte desta entrega.

### Decisões tomadas sozinho

- **Mesma URL, mesma navegação** (regra 1): é a leitura mais simples da proposta (tela própria =
  componente próprio, não rota própria); a Diretoria não respondeu às perguntas da issue. Se errado: trocar para rota por tipo é entrega nova,
  custo médio (muda navegação, menu e redirecionamentos).
- **Uma entrega só**, cobrindo os quatro tipos já existentes de uma vez, em vez de uma entrega por
  tipo (diferente do padrão "uma entrega por tipo de ficha" usado quando os tipos foram
  construídos pela primeira vez): aqui não há ficha nova para testar com cuidado, só mover código
  que já funciona para arquivos separados. Se o Desenvolvedor achar mais seguro dividir em PRs
  menores (um tipo por vez), pode — sem mudar o resultado final.

### Frentes

`telas` (separar os componentes). Sem `regras e dados` nem `infraestrutura`.

### Entrega

Uma só: os quatro componentes de ficha novos, o casco enxuto, sem mudança de comportamento.

### Critérios de pronto

- [ ] Testes existentes de Requisições continuam passando (nenhuma regra de negócio muda).
- [ ] Na prévia (dados fictícios): abrir uma requisição nova de cada um dos quatro tipos e
      confirmar que a ficha tem os mesmos campos de hoje, na mesma ordem; ajustar uma devolvida de
      cada tipo e confirmar que os dados salvos aparecem certos na tela de novo.
- [ ] `npm run verificar` e `npm run build` verdes.

## Depois

- Preferência da pessoa para desligar o resumo diário por e-mail.
- Escolher o horário do resumo por instituição (hoje é fixo no código, 7h de Brasília).
- Ligar a requisição à execução do orçamento (1C): especificado na issue #115, em `docs/especificacao-ligacoes-entre-apps.md` (projeto, atividade, saldo e fonte na aprovação).

## Agendamento de veículos institucionais (proposta #229, 21/11/2026)

Novo tipo de requisição, com tela própria (mesmo padrão de "Ficha" da proposta #228: um componente
`FichaVeiculo`, sem entrar no `if` da tela única). Sem ADR: o fluxo novo fica dentro do módulo, o
perfil novo é declarado no manifesto como os outros setores e o Núcleo não muda.

Ajuste de 21/11/2026: a Diretoria confirmou que o pedido de veículo tem centros de custo, como os
outros tipos (regra 14), para estatística de uso por serviço — não é rateio de despesa.

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

Pedido de veículo reaproveita a aba `Centros` (comum a todos os tipos, regra 1 geral do módulo)
para os centros de custo; não tem itens. A área do pedido continua obrigatória (valem as "áreas
permitidas" do tipo).

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
14. **Centros de custo (decisão da Diretoria, 21/11/2026):** o pedido de veículo tem centros de
    custo como os outros tipos (regra 1 geral do módulo: um ou mais serviços, sem repetir, somando
    100%). Não gera despesa nem rateio — serve só para depois saber quais serviços mais usam os
    veículos (relatório por serviço: fica de fora desta entrega, ver "Fica de fora"). As regras 2 e
    3 gerais (mesma coordenação entre os centros; quem pede da própria coordenação ou serviço sem
    coordenação vai para a Diretoria) **não valem aqui**: quem aprova veículo é sempre o Transporte
    (regra 7), não a coordenação dos centros escolhidos — os centros podem ser de coordenações
    diferentes no mesmo pedido.

### Telas

1. **Pedir veículo** (`/requisicoes/nova`, tipo "Uso de veículo", `FichaVeiculo`). Quem pede quer
   reservar em poucos cliques: escolher tipo → área e centros de custo (bloco comum, como nos
   outros tipos) → veículo → saída/volta → destino/finalidade → "Enviar pedido". Primeira dobra:
   tipo, veículo e período. Ao escolher veículo e período aparece o aviso de conflito (regra 4) ou
   de manutenção (veículo indisponível: some da lista e uma dica diz "alguns veículos não aparecem
   porque estão em manutenção nessas datas"). Campos: centros de custo (um ou mais serviços,
   somando 100%, igual aos outros tipos), veículo (lista com nome, placa e capacidade), saída e
   volta prevista (data e hora, rótulos sempre visíveis, dica "dia/mês/ano hora:minuto"), destino,
   finalidade (dica: "para que será usado"), condutor (já preenchido). Erro: nada digitado se
   perde, a mensagem diz o campo. Celular: campos em coluna, data e hora nativas do aparelho.
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

Reserva de espaços (#230), relatório de uso por serviço/centro de custo, rateio de despesa por
veículo (não há despesa a ratear), abastecimento, multas, vistoria com foto, manutenção
corretiva, histórico de manutenções na tela (fica gravado em `VeiculoManutencoes`), condutor
ligado ao cadastro de pessoas.

### Decisões tomadas sozinho (e o que custam se estiverem erradas)

- **Condutor em texto livre**, não ligado a usuário do Elo (o motorista pode não ter acesso).
  Errado: trocar para escolha de pessoa exige migrar o campo (baixo).
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

### Como a entrega 2 ficou (22/11/2026)

- Telas do Transporte: **Pedidos de veículo** (`/requisicoes/veiculos/pedidos`, lista para decidir, ordenada pela saída, com os selos Conflito e Manutenção) e **Agenda dos veículos** (`/requisicoes/veiculos/agenda`, com o botão de marcar manutenção feita). O Transporte não tem a permissão `requisicoes.aprovar`, por isso não usa "Para aprovar".
- "Para atender" (Confirmar uso) fica na entrega 3.

### Critérios de pronto

- [ ] Prévia: Administração cadastra dois veículos e uma data de manutenção; o veículo some da
      lista para períodos a partir da data e volta ao marcar manutenção feita.
- [ ] Dois pedidos no mesmo veículo e horário: quem pede vê só o aviso; o Transporte vê o conflito
      na lista e na ficha, aprova um (confirmando se já havia aprovado) e recusa o outro.
- [ ] Pedido aprovado antes de uma manutenção ser cadastrada continua aprovado e mostra o aviso.
- [ ] Depois da saída, o Transporte confirma o uso sem e com problema; km de volta menor que a de
      saída é recusada; "com problema" sem texto é recusado.
- [ ] Quem não é Transporte nem Diretoria não vê pedidos de veículo dos outros.
- [ ] Pedido de veículo pede centros de custo (um ou mais serviços somando 100%) como os outros
      tipos.
- [ ] `npm run verificar` e `npm run build` verdes.

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

Ajuste de 21/11/2026: a Diretoria confirmou que o pedido de espaço tem centros de custo, como os
outros tipos — exceto quando é cedido a um externo (parceiro, comunidade), caso em que não há
serviço interno "usando" o espaço (regra 1-A e tela).

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
(`DetalhesEspaco`): id do espaço, data, hora de início, hora de fim, finalidade, pessoas esperadas,
`usoExterno` (verdadeiro/falso) e `organizacaoExterna` (texto, só quando `usoExterno`). A ficha nova
é `espaco` em `FORMULARIOS` (categoria "serviço", sem itens, sem anexos). Pedido com `usoExterno`
falso reaproveita a aba `Centros` (comum a todos os tipos, regra 1 geral do módulo) para os centros
de custo; com `usoExterno` verdadeiro não tem centros de custo. Fechamento (resultado "sem problema"
ou "com problema" e o texto) é gravado na mesma requisição, com data e quem fechou; o histórico
recebe a inclusão. Coluna pessoal: as mesmas de hoje; `organizacaoExterna` é dado de terceiro, não
pessoal do funcionário.

### Regras de negócio (com teste)

1. **Campos obrigatórios:** espaço, data, hora de início, hora de fim, finalidade (mín. 5 letras) e
   pessoas esperadas (inteiro ≥ 1). Reserva é de **um dia só** (início e fim na mesma data) e o fim
   é depois do início. Data não pode ser anterior a hoje (horário de Brasília).
1-A. **Centros de custo ou uso externo (decisão da Diretoria, 21/11/2026):** o pedido marca se é
   **uso externo** (cedido a um parceiro, organização ou pessoa de fora da instituição). Se não é
   uso externo, tem centros de custo como os outros tipos (regra 1 geral do módulo: um ou mais
   serviços, sem repetir, somando 100%) — a área/serviço que autoriza a cessão ou usa o espaço. Se
   é uso externo, não pede centros de custo e exige o nome da organização ou pessoa externa (mín.
   3 letras) em vez disso. Não gera despesa nem rateio em nenhum dos dois casos.
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
6. **Quem decide:** pedido com ficha `espaco` vai sempre para o Espaços — as regras 2 e 3 gerais
   (mesma coordenação entre os centros; quem pede da própria coordenação ou serviço sem coordenação
   vai para a Diretoria) **não valem aqui**: mesmo tendo centros de custo (regra 1-A), quem decide
   nunca é a coordenação deles. Quem tem o perfil Espaços e pede é aprovado pela Diretoria. Ninguém
   decide o próprio pedido.
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
     nome), **Pessoas esperadas**, **Finalidade ou evento**, **É uma cessão para fora da
     instituição?** (sim/não). Não: **Centros de custo** (um ou mais serviços, somando 100%, igual
     aos outros tipos). Sim: **Organização ou pessoa** (quem vai usar o espaço), sem centros de
     custo. Observações. Ação principal: "Enviar pedido".
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
- **Sem anexos nem prazo de atendimento** nesse tipo: espaço não consome verba e a proposta não os
  cita. Se errado: acrescentar o bloco comum da ficha; custo baixo.
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
- [ ] Pedido comum pede centros de custo (somando 100%); marcado como uso externo pede a
      organização ou pessoa em vez disso, sem centro de custo.
- [ ] `npm run verificar` e `npm run build` verdes.
