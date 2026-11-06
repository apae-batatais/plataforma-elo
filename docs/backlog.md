# Backlog do Elo

- Atualizado em: 06/11/2026
- Dono: Diretoria. A ordem de prioridade é decidida pela Diretoria.
- Fonte: as especificações em `docs/` e `src/modulos/*/especificacao.md`, inclusive as
  que estão em Pull Requests abertos, e o histórico de Pull Requests. Cada item aponta
  para o documento que o detalha.

Os itens seguem o ciclo de trabalho: especificar, aprovar, construir e conferir na prévia.

## Em andamento

| Item | Frente | Situação | Detalhe |
| --- | --- | --- | --- |
| Avaliação de Serviços Sociais — entrega 1 | Avaliação (Fase 2) | Especificação aprovada em 06/11/2026. Avaliação inicial e anual, comparativo da pessoa, painel por serviço atual, impressão e fundamento legal. Aguarda conferência na prévia e aprovação | PR #39; `src/modulos/avaliacao/especificacao.md`; ADR-016 |
| Comunicação fase 1 — entrega 1 de 5 | Comunicação | Especificação aprovada em 06/11/2026. Calendário, antecedência mínima e cor do app. Aguarda conferência na prévia e aprovação | PR #40; `src/modulos/comunicacao/especificacao.md` |
| Comunicação fase 1 — entregas 2 a 5 | Comunicação | Já planejadas: 2) pedidos, revisão e aprovação; 3) fotos e documentos; 4) contatos, agendamento, e-mail pronto e publicação; 5) indicadores | `docs/superpowers/plans/2026-11-06-comunicacao-fase-1.md` (no PR #40) |

## Agora

| Item | Frente | O que é | Detalhe |
| --- | --- | --- | --- |
| Especificar a Entrega 1C (Execução) | Orçamento | Detalhar a execução para aprovação antes de construir: importação do realizado de 2026 e 2027 sem duplicar lançamentos, fila "a classificar", painel, indicador `execucao_orcamentaria` e prestação de contas por fonte | `src/modulos/orcamento/especificacao.md` (Entrega 1C) |

## Próximo

| Item | Frente | O que é | Detalhe |
| --- | --- | --- | --- |
| Construir a Entrega 1C (Execução) | Orçamento | Construção depois da especificação aprovada. Fecha a Fase 1, cujo critério é "a execução confere com a planilha" | `src/modulos/orcamento/especificacao.md` |
| Capacidade de Indicadores | Capacidades | Cálculo e painel de indicadores compartilhados entre os apps. A pasta `src/capacidades/indicadores` ainda está vazia | `docs/especificacao-plataforma.md` (Situação da Fase 0) |
| Entrega R3 da Rede | Rede | Guia "Como trazer uma instituição para o Elo", termo de adesão (LGPD) e roteiro de transferência da Operadora. É documentação, não código | `docs/especificacao-rede.md` (Entregas) |

## Depois

| Item | Frente | O que é | Detalhe |
| --- | --- | --- | --- |
| Ligar a requisição à execução do orçamento | Requisições | Depende da Entrega 1C pronta | `src/modulos/requisicoes/especificacao.md` (Depois) |
| Aviso por e-mail das requisições | Requisições | Precisa de ligação com o Gmail | `src/modulos/requisicoes/especificacao.md` (Depois) |
| Avaliação — próximas entregas | Avaliação (Fase 2) | A combinar: ligar a avaliação ao Cadastro Único de Pessoas (`pessoa_id`) e usar o motor de avaliação (ADR-006) para instrumentos com escala. Critério da Fase 2: ciclo fechado e enquadramentos justificados | `src/modulos/avaliacao/especificacao.md` (Entregas, no PR #39); ADR-006 e ADR-007 |
| Comunicação fases 2 a 4 | Comunicação | 2) e-mail automático e avisos por e-mail; 3) Instagram automático; 4) resultado das postagens | `src/modulos/comunicacao/especificacao.md` (no PR #40) |
| Fase 3 — Expansão | Novos apps | Educação, Saúde/CER e novos módulos | `docs/especificacao-plataforma.md` (Roteiro) |

## Pendências da Diretoria (fora do código)

| Item | Por que importa |
| --- | --- |
| Definir o DPO (encarregado de dados, LGPD) | É condição para avançar a Fase 1 (Roteiro) |

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
