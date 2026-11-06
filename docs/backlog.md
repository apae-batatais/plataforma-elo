# Backlog do Elo

- Atualizado em: 06/11/2026
- Dono: Diretoria. A ordem de prioridade é decidida pela Diretoria.
- Fonte: as especificações em `docs/` e `src/modulos/*/especificacao.md` e o
  histórico de Pull Requests. Cada item aponta para o documento que o detalha.

Os itens seguem o ciclo de trabalho: especificar, aprovar, construir e conferir na prévia.

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
| Fase 2 — Avaliação | Avaliação | Motor de avaliação e módulo da Assistência Social, com o primeiro ciclo da Apae Rural. Para avançar: ciclo fechado e enquadramentos justificados | `docs/especificacao-plataforma.md` (Roteiro); ADR-006 e ADR-007 |
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
