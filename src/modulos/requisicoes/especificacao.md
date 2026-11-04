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
4. **Manutenção (Setor de Manutenção)**: ficha com tipo de serviço (elétrica, hidráulica, ar-condicionado, equipamento, portas/janelas/móveis, pintura, paredes/piso/telhado, outro), local, problema, urgência, equipamento, patrimônio, melhor horário e contato; perfil novo Setor de Manutenção; urgência na fila. Foto do problema fica para depois (precisa de pasta no Drive com envio de arquivos).
5. **Painel de prazos e feriados**: painel com % de aprovação e de atendimento no prazo, tempo médio, atendidas em parte e atrasadas agora, por mês, setor e tipo; feriados (nacionais de uma vez, municipais um a um) fora das horas úteis.

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
| Administração da plataforma (só ela) | Criar e alterar tipos, áreas permitidas, itens aceitos, expediente e feriados                     | `requisicoes.tipos.gerenciar`                           |
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
| Feriados      | Data e nome dos dias que não contam nas horas úteis                                                                                                | interno               |

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
16. Feriados: só a Administração da plataforma cadastra e tira; uma data só uma vez; os feriados não contam nas horas úteis de nenhum prazo (inclusive de requisições antigas, ao recalcular).
17. Painel de prazos (`requisicoes.painel`: Diretoria, coordenação e setores): mostra só as requisições que a pessoa já pode ver. Aprovação conta no mês da decisão (aprovar, devolver ou recusar), com horas do envio à decisão; atendimento conta no mês da conclusão, com horas da aprovação à conclusão. Atrasadas agora: esperando decisão ou atendimento além do prazo.

## Telas

1. Minhas requisições, Para aprovar, Para atender, Todas (lista com situação e prazo da etapa).
2. Nova requisição / Ajustar: ficha de materiais (tipo, área, centros com %, itens, retirada ou entrega, evento, utensílios, observações).
3. Ficha da requisição: dados, prazos, ações de quem pode agir, histórico e Imprimir.
4. Tipos de requisição (setor, prazos, áreas permitidas, expediente e feriados do SLA) e Itens aceitos de cada tipo (um a um ou em lote).
5. Painel de prazos: cartões, gráfico mês a mês, tabelas por mês, setor e tipo, atrasadas agora.
6. Avisos: tela inicial ("N esperam a sua aprovação", "N na fila do seu setor", "N devolvidas") e número no menu.

## Indicadores

| Código                           | Cálculo                                                 | Referência       |
| -------------------------------- | ------------------------------------------------------- | ---------------- |
| requisicoes_aprovacao_no_prazo   | % de requisições decididas dentro do prazo de aprovação | Painel de prazos |
| requisicoes_atendimento_no_prazo | % de atendimentos concluídos dentro do prazo            | Painel de prazos |

## Depois

- Aviso por e-mail (precisa de ligação com o Gmail).
- Ligar a requisição à execução do orçamento (1C).
