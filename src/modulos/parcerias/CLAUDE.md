# Módulo Parcerias — regras para o agente

Leia antes `especificacao.md` desta pasta, o ADR-020 e o `CLAUDE.md` da raiz.

- Escopo: altere apenas `src/modulos/parcerias/` e as rotas `src/app/(elo)/parcerias/`.
- Armazenamento: abas em `dados/tabelas.ts`, na planilha `parcerias`. Não leia nem grave abas de
  outros módulos. A única leitura fora do módulo é a contagem de atendidos do Núcleo
  (`src/nucleo/pessoas/contagem.ts`, só números). Números de pessoas da Avaliação (meta com fonte automática,
  ADR-023) chegam pela interface `NumerosDePessoas`, entregue por `src/plataforma/ligacoes.ts`; nunca importe a Avaliação.
- Pastas: `dominio/` regras puras (valores em centavos); `aplicacao/` casos de uso (sempre com
  `Autorizador` e `registrarAuditoria`); `dados/`; `telas/`; `testes/`.
- Sem dados pessoais: a equipe do termo é por função, sem nomes.
- Nada é apagado: termo e fonte são encerrados; aporte errado é cancelado e relançado.
- A conta vinculada de cada fonte fica no Orçamento (ADR-020), não aqui.
- O número de parcelas nunca entra no cálculo do valor da fonte (regra 11).
- Permissões: `parcerias.<recurso>.<acao>`, declaradas no manifesto.
- Rascunho de termo (ADR-023): só nasce por `criarRascunhoDeTermo`, chamado pela plataforma a pedido do Projetos. Todo cálculo lê
  os termos pela visão sem rascunhos (`ler()` em `aplicacao/parcerias.ts`); nunca leia `Termos` direto para calcular.
