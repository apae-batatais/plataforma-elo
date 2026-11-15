# ADR-030 · App Saúde: avaliação do CER pelo motor, planilha própria e mesmo desenho da Educação

- Situação: proposta
- Data: 2026-11-15

## Contexto

A Diretoria pediu a avaliação de evolução de Saúde/CER (issue #68) e trouxe o instrumento validado: 10 itens, escala 0 a 3,
total de 0 a 30, mesmas faixas dos outros eixos, etiqueta CIF por item. A ADR-006 manda o motor ficar em
`src/capacidades/motor-avaliacao/`, a ADR-007 pede instrumentos versionados, a ADR-026 (issue #62) prevê planilha própria
para Saúde/CER e a ADR-029 (issue #163) define o desenho do app Educação, que este repete.

## Decisão

- Novo módulo `src/modulos/saude/` (rota `/saude`, permissões `saude.*`), sem importar os módulos Avaliação ou Educação.
- Planilha própria `avaliacao_saude` para instrumento, aplicações e respostas (dados sensíveis, ADR-011).
- O instrumento do CER é **dado versionado** usado pelo motor; o módulo guarda as respostas e aplica as regras do eixo
  (ciente da coordenação, reavaliação, escopo por serviço da área Saúde).
- Dimensão (Evolução, Adequação, Barreira) é o **domínio** do motor; subtotais, total, faixa e principal barreira são
  calculados na leitura e nunca guardados. A etiqueta CIF é informativa.
- Nenhuma mudança no Núcleo. Se o motor ainda não tiver campo de etiqueta por item (previsto na ADR-029), ele ganha um
  campo opcional, uma só vez, para os dois eixos.

## Consequências

- O app depende da entrega 1 do motor (#62). Pode ser construído antes ou depois da Educação; a ordem de prioridade é da Diretoria.
- O código de telas e casos de uso fica parecido com o da Educação. Duplicar é o preço da regra de fronteiras; se pesar,
  uma peça comum em capacidade será proposta à Diretoria, em nova ADR.
- Mudar o texto de um item cria nova versão; períodos de versões diferentes não se somam sem aviso.
