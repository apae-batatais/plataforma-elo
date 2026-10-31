# Especificação — Módulo Requisições

- Situação: aprovada em 31/10/2026 pela Diretoria
- Dono do produto: Diretoria

## Objetivo

Qualquer pessoa da equipe pede materiais ou serviços pelo Elo. A coordenação dos centros de custo
aprova, o setor responsável atende, e tudo fica registrado com data e hora para medir os prazos (SLA).

## Entregas (um tipo de ficha por PR, cada um validado antes do seguinte)

1. **Base do módulo + Materiais (Almoxarifado)** — esta entrega.
2. **TI (Setor de Informática)**: ficha de chamado (categoria, equipamento, patrimônio, local, problema, urgência, contato), perfil novo Setor de Informática, urgência na fila. Material de informática usa a ficha de materiais com o Setor de Informática.
3. Mobiliário (Setor de Patrimônio).
4. Manutenção (Setor de Manutenção).
5. Painel de SLA (indicadores por tipo, setor e mês) e cadastro de feriados.

## Usuários e permissões

| Perfil                               | Pode                                                                                              | Permissão                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Todos os perfis                      | Abrir requisições, acompanhar as próprias, ajustar as devolvidas, cancelar enquanto não aprovadas | `requisicoes.acessar`, `requisicoes.solicitar`          |
| Coordenação de serviço               | Aprovar, devolver ou recusar as dos centros de custo do seu escopo                                | `requisicoes.aprovar` (escopo)                          |
| Diretoria                            | Aprovar qualquer uma (e as da própria coordenação e de serviços sem coordenação); ver todas       | `requisicoes.aprovar` (global), `requisicoes.ver_todas` |
| Almoxarifado (perfil novo)           | Receber e atender as dos tipos ligados a ele                                                      | `requisicoes.atender`                                   |
| Setor de Informática (perfil novo)   | Receber e atender chamados de TI e material de informática                                        | `requisicoes.atender`                                   |
| Administração da plataforma (só ela) | Criar e alterar tipos, áreas e grupos permitidos, itens aceitos e o expediente                    | `requisicoes.tipos.gerenciar`                           |

## Entidades (planilha `requisicoes`)

| Aba           | O que guarda                                                                                                           | Sigilo                |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Tipos         | Nome, categoria, ficha, perfil que atende, prazos (horas úteis), áreas e grupos de despesa permitidos (vazio = todos)  | interno               |
| CatalogoItens | Itens aceitos por tipo (descrição e unidade). Tipo sem itens aceita texto livre                                        | interno               |
| Requisicoes   | Número, tipo, quem pediu, área, grupo de despesa, situação, quem aprova, detalhes da ficha (JSON), datas de cada etapa | pessoal: requisitante |
| Centros       | Serviço e percentual de cada requisição (somam 100%)                                                                   | interno               |
| Itens         | Quantidade, unidade, descrição, item da lista (quando houver) e quanto foi entregue                                    | interno               |
| Historico     | Cada mudança de etapa: quando, quem, de/para, comentário (só inclusões)                                                | pessoal: usuário      |
| Parametros    | Expediente (início e fim) usado no SLA                                                                                 | interno               |

Grupos de gasto vêm do Orçamento pela plataforma (ADR-013).

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
10. O tipo só aceita as áreas e os grupos de despesa marcados (sem marcação, todos).
11. Tipo com lista de itens só aceita itens da lista (pela descrição, sem diferença de acento ou maiúscula); descrição e unidade gravadas vêm da lista. Tirar um item da lista não muda requisições já feitas.
12. Tipos de requisição: só a Administração da plataforma da instituição cria e altera. "Preparar estrutura" retira a permissão que a Diretoria recebeu na versão 0.9.0 (`permissoesRetiradas` no manifesto).
13. Chamado de TI: categoria, local, problema (mín. 10 letras) e urgência são obrigatórios; não tem itens; tipo com ficha de chamado é sempre "serviço". Concluir exige dizer se resolveu e o que foi feito (resolvido em parte → "atendida em parte").

## Telas

1. Minhas requisições, Para aprovar, Para atender, Todas (lista com situação e prazo da etapa).
2. Nova requisição / Ajustar: ficha de materiais (tipo, área, grupo, centros com %, itens, retirada ou entrega, evento, utensílios, observações).
3. Ficha da requisição: dados, prazos, ações de quem pode agir, histórico e Imprimir.
4. Tipos de requisição (setor, prazos, áreas e grupos permitidos, expediente do SLA) e Itens aceitos de cada tipo (um a um ou em lote).
5. Avisos: tela inicial ("N esperam a sua aprovação", "N na fila do seu setor", "N devolvidas") e número no menu.

## Indicadores

| Código                           | Cálculo                                                 | Referência |
| -------------------------------- | ------------------------------------------------------- | ---------- |
| requisicoes_aprovacao_no_prazo   | % de requisições decididas dentro do prazo de aprovação | entrega 5  |
| requisicoes_atendimento_no_prazo | % de atendimentos concluídos dentro do prazo            | entrega 5  |

## Depois

- Aviso por e-mail (precisa de ligação com o Gmail).
- Ligar a requisição à execução do orçamento (1C).
