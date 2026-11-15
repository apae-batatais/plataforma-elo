# ADR-029 · App Educação: avaliação pelo motor, planilha própria e subtotais por dimensão

- Situação: proposta
- Data: 2026-11-15

## Contexto

A Diretoria pediu a avaliação de evolução do eixo Educação (issue #163), com o instrumento validado em três versões (Educação
Infantil, Ensino Fundamental e Educação para o Trabalho): 10 itens, escala 0 a 3, total de 0 a 30, faixas de corte e
etiqueta CIF por item. A ADR-006 manda o motor ficar em `src/capacidades/motor-avaliacao/`, a ADR-007 pede instrumentos
versionados e a ADR-026 (issue #62) define o motor e prevê planilha própria para Educação. A Diretoria também pediu
subtotais por dimensão (Evolução, Adequação, Barreira) ao lado do total.

## Decisão

- Novo módulo `src/modulos/educacao/` (rota `/educacao`, permissões `educacao.*`), sem importar o módulo Avaliação.
- Planilha própria `avaliacao_educacao` para instrumentos, aplicações e respostas (dados sensíveis, ADR-011).
- Os três instrumentos são **dados versionados** usados pelo motor; o módulo guarda as respostas e aplica as regras do eixo
  (ciente da coordenação, reavaliação, escopo por serviço).
- **Dimensão** (Evolução, Adequação, Barreira) é o **domínio** do motor; o subtotal é o escore por domínio que o motor já
  calcula. A etiqueta CIF é um campo informativo do item e não entra no cálculo.
- Total, subtotais e faixa são calculados na leitura, nunca guardados.
- "Turma" é o **serviço** do Núcleo; não há cadastro de turmas.
- Se o motor da ADR-026 não tiver campo de etiqueta por item, ele ganha um campo opcional (mudança em capacidade, que exige
  aprovação da Diretoria no PR de entrega e testes de todos os eixos).

## Consequências

- O app depende da entrega 1 do motor (#62); a construção só começa depois que ela entrar na `main`.
- Saúde/CER repete o mesmo desenho: instrumento como dado, módulo próprio e planilha própria.
- Mudar o texto de um item cria nova versão do instrumento; períodos de versões diferentes não se somam sem aviso.
- Se a Diretoria quiser escopo por turma, será nova ADR e mudança no Núcleo.
