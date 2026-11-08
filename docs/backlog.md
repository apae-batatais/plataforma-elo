# Backlog do Elo

- Atualizado em: 08/11/2026
- Dono: Diretoria. A ordem de prioridade é decidida pela Diretoria.
- Fonte: as especificações em `docs/` e `src/modulos/*/especificacao.md`, inclusive as
  que estão em Pull Requests abertos, o [roadmap](roadmap.md) e o histórico de Pull Requests.
  Cada item aponta para o documento que o detalha.

Os itens seguem o ciclo de trabalho: especificar, aprovar, construir e conferir na prévia.

## Em andamento

| Item | Frente | Situação | Detalhe |
| --- | --- | --- | --- |
| Comunicação fase 1 — entregas 4 e 5 | Comunicação | Já planejadas: 4) contatos, agendamento, e-mail pronto e publicação; 5) indicadores. A próxima é a Tarefa 9 (entrega 4) | `docs/superpowers/plans/2026-11-06-comunicacao-fase-1.md` |

## Agora

| Item | Frente | O que é | Detalhe |
| --- | --- | --- | --- |
| Entrega 1E (Histórico) | Orçamento | Anos fechados de 2017 a 2025, indicadores históricos e fontes de receita ano a ano. Próxima da ordem aprovada (1D.1 → 1E → 1C.1 → 1C.2 → 1D.2); precisa de plano | `src/modulos/orcamento/especificacao-execucao-tesouraria.md` |

## Próximo

| Item | Frente | O que é | Detalhe |
| --- | --- | --- | --- |
| Capacidade de Indicadores | Capacidades | Cálculo e painel de indicadores compartilhados entre os apps. A pasta `src/capacidades/indicadores` ainda está vazia | `docs/especificacao-plataforma.md` (Situação da Fase 0) |
| Entrega R4 da Rede (pasta única) | Rede | Cadastro só com o link da pasta; o Elo cria as planilhas e a pasta de anexos que faltam. Especificação proposta em 07/11/2026, aguarda aprovação | `docs/especificacao-rede.md` (R4); ADR-018 |
| Entrega R3 da Rede | Rede | Guia "Como trazer uma instituição para o Elo", termo de adesão (LGPD) e roteiro de transferência da Operadora. É documentação, não código | `docs/especificacao-rede.md` (Entregas) |

## Depois

| Item | Frente | O que é | Detalhe |
| --- | --- | --- | --- |
| Entregas 1C.1, 1C.2 e 1D.2 (realizado, execução, fim do ano e reserva) | Orçamento | A 1C.1 foi para o roadmap em 07/11/2026: espera a amostra da exportação do WK Radar. A 1C fecha a Fase 1 ("a execução confere com a planilha") | `docs/roadmap.md` (Orçamento) |
| Ligar a requisição à execução do orçamento | Requisições | Depende da Entrega 1C pronta | `src/modulos/requisicoes/especificacao.md` (Depois) |
| Aviso por e-mail das requisições | Requisições | Usa a mesma ligação com o Gmail da Comunicação fase 2 | `src/modulos/requisicoes/especificacao.md` (Depois); `docs/roadmap.md` |
| Avaliação — próximas entregas | Avaliação (Fase 2) | A combinar: ligar a avaliação ao Cadastro Único de Pessoas (`pessoa_id`) e usar o motor de avaliação (ADR-006) para instrumentos com escala. Critério da Fase 2: ciclo fechado e enquadramentos justificados | `src/modulos/avaliacao/especificacao.md` (Entregas); ADR-006 e ADR-007 |
| Comunicação fase 2 — ligação com o Gmail | Comunicação e Núcleo | Implementação futura (decisão da Diretoria em 07/11/2026). Peça nova do núcleo para o Gmail; avisos e lembretes por e-mail; envio automático de release e artigo na data marcada, com registro e aviso de falha; verificação do app no Google para OSCs de outros domínios | `docs/roadmap.md` |
| Comunicação fase 3 — Instagram automático | Comunicação | Conexão da conta profissional da OSC, publicação na hora marcada com gravação do link, aviso de falha. Antes, confirmar se a Meta exige revisão do app | `docs/roadmap.md` |
| Comunicação fase 4 — resultado das postagens | Comunicação | Alcance e curtidas do Instagram nos indicadores | `docs/roadmap.md` |
| Auditoria completa na leitura de anexos | Núcleo | Leitura por faixa que não começa no início do arquivo não gera registro, e o erro 502 repassa o texto do Google. Vale para Requisições e Comunicação; precisa de pedido da Diretoria para mexer no Núcleo | `docs/superpowers/plans/2026-11-06-comunicacao-fase-1-andamento.md` (Pendências) |
| Feriados no núcleo do Elo | Núcleo | Levar o cadastro de feriados do Requisições para o núcleo, para a Comunicação considerar feriados na antecedência mínima | `docs/roadmap.md` (Melhorias deixadas para depois) |
| Fase 3 — Expansão | Novos apps | Educação, Saúde/CER e novos módulos | `docs/especificacao-plataforma.md` (Roteiro) |

## Pendências da Diretoria (fora do código)

| Item | Por que importa |
| --- | --- |
| Definir o DPO (encarregado de dados, LGPD) | É condição para avançar a Fase 1 (Roteiro) |
| Amostra da exportação do WK Radar (dados fictícios ou anonimizados) | Destrava a Entrega 1C.1 do Orçamento |

## Concluído

| Frente | Entrega | Pull Request |
| --- | --- | --- |
| Fundação | Camada de aplicação, armazenamento em planilhas, acesso, auditoria, login Google, demonstração e publicação na Netlify | início do projeto, #5, #6, #21 |
| Fundação | Google Cloud (conta de serviço e ID do cliente OAuth) e planilhas Núcleo e Auditoria criadas e compartilhadas | configuração feita pela Diretoria |
| Plataforma | Novo leiaute, revisão de interface, Painel geral, Ajuda e identidade visual com dois temas | #9, #19, #37 |
| Acessos | Serviços e Áreas em lote; perfil Funcionário e cadastro de pessoas em lote | #11, #33 |
| Orçamento | 1A — Folha de Pagamento com rateio por centro de custo, reimportação e lotação | #8, #10, #25 |
| Orçamento | 1B — Previsão: grupos, fontes, despesas, receitas, RH da folha, propostas, cotação, aprovação e remanejamentos | #14, #15, #16, #17, #26 |
| Rede | R1 (cada instituição pelo próprio endereço) e R2 (cadastro, conferência e Administração da rede) | #22, #23, #24 |
| Requisições | Entregas 1 a 6: Materiais, TI, Mobiliário, Manutenção, painel de prazos e feriados, fotos e vídeo; perfil Setor Cozinha | #27 a #32, #34, #35, #36, #38 |
| Avaliação (Fase 2) | Entrega 1: avaliação inicial e anual, comparativo da pessoa, painel por serviço atual, impressão e fundamento legal (ADR-016) | #39 |
| Comunicação | Entregas 1 e 2 da fase 1: calendário, antecedência mínima, cor do app; pedidos, revisão, aprovação e avisos | #40, #43 |
| Orçamento | Especificação das entregas 1C, 1D e 1E aprovada | #44 |
| Documentação | Backlog e roadmap; regras do agente (como trabalhar com a Diretoria, publicação oficial em lote) | #41, #42, #45 |
| Comunicação | Entrega 3 da fase 1: fotos e documentos no pedido, com o nome original do arquivo | #46 |
| Orçamento | 1D.1 — Tesouraria: contas, saldos do mês, ajustes de conciliação e totais por classe; troca de classe com escolha | #47, #49 |
| Documentação | Repositório renomeado para `plataforma-elo`; ADR-017 (hospedagem até cerca de 5 clientes); Rede R4 (pasta única, ADR-018) | #48, #50, #51 |
