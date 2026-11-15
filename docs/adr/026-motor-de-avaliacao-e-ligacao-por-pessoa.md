# ADR-026 · Motor de avaliação para os três eixos e ligação por `pessoa_id`

- Situação: proposta
- Data: 2026-11-15

## Contexto

A ADR-006 coloca o motor em `src/capacidades/motor-avaliacao/` (hoje vazio) e a ADR-007 exige
instrumentos versionados. A ADR-016 identificou a pessoa por iniciais por falta de atendidos no
Cadastro Único, que agora existe. A Diretoria decidiu (issue #62) que o motor nasce pensado para
Assistência Social, Educação e Saúde/CER, e que a avaliação se liga à pessoa por `pessoa_id`.

## Decisão

- O motor é **código puro** (sem planilha, tela ou permissão): define instrumento, versão, itens,
  escala, escore e faixas e compara ciclos. O módulo de cada eixo guarda as respostas e aplica as regras do eixo.
- Os dados do motor usado pela Assistência Social ficam na planilha `avaliacao_assistencia` (dados sensíveis, ADR-011).
  Educação e Saúde/CER terão planilha própria quando existirem.
- A aplicação guarda `pessoa_id`. A ligação das avaliações antigas por iniciais é **confirmada por
  pessoa**, em aba própria, sem alterar a avaliação original. Enquanto não houver ligação, vale a ADR-016.
- Aplicação fechada não se edita; correção cria nova aplicação (ADR-007).
- Nenhuma mudança no Núcleo: a visibilidade da pessoa vem do `Autorizador` existente.

## Consequências

- Educação e Saúde/CER reutilizam o motor sem mexer nele; mudanças no motor exigem testes de todos os eixos.
- Duas pessoas com as mesmas iniciais deixam de se confundir nas avaliações ligadas.
- O questionário atual continua como está até a Diretoria pedir sua conversão em instrumento.
