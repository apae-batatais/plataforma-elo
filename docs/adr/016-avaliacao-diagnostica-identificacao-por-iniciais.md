# ADR-016 · Avaliação de Serviços Sociais: questionário próprio, identificação por iniciais e comparação anual

- Situação: aceita
- Data: 2026-11-06

## Contexto

A equipe da Assistência Social já aplica um questionário diagnóstico (aba TODOS da planilha
dos Novos Serviços 2027) e identifica as pessoas por iniciais, data de nascimento e sexo, para
manter sigilo. A Diretoria validou o formulário e o painel num protótipo e pediu a versão no Elo,
com telas separadas para avaliar e para o painel. O Cadastro Único de Pessoas ainda não tem os
atendidos cadastrados, e o motor de avaliação (ADR-006) ainda não existe.

## Decisão

- O módulo `avaliacao` tem o questionário próprio, com as perguntas fixas no domínio
  (`dominio/avaliacao.ts`), em vez de esperar o motor de avaliação.
- A pessoa avaliada é identificada só por **iniciais, data de nascimento e sexo** (prontuário
  opcional). O nome completo não é pedido nem guardado. Não há ligação com `Pessoas` nesta entrega.
- O serviço atual vem do cadastro de Serviços do Núcleo e define quem vê: `avaliacao.avaliar`
  e `avaliacao.painel` valem no escopo do serviço.
- Planilha própria `avaliacao_assistencia` para os dados sensíveis.
- O índice de necessidade de cuidado é calculado na camada de aplicação a cada leitura.

## Consequências

- A equipe usa o Elo já, com o mesmo questionário e o mesmo cálculo do painel dos Novos Serviços.
- Duas avaliações da mesma pessoa se relacionam por iniciais + nascimento + sexo. Isso basta para
  a avaliação inicial e o acompanhamento anual e para o comparativo da pessoa, mas duas pessoas
  com os mesmos três dados seriam tratadas como uma (raro; o prontuário ajuda a conferir). Ligar ao
  Cadastro Único fica para uma próxima entrega (migração para `pessoa_id`).
- Quando o motor de avaliação existir, este questionário pode virar um instrumento versionado
  (ADR-007), mantendo as respostas já gravadas.

## Atualização (06/11/2026)
- O módulo passou a se chamar **Avaliação de Serviços Sociais** (rota e permissões não mudaram).
- Cada avaliação tem tipo: **inicial** (encaminhamento ao serviço) ou **acompanhamento anual**. A
  reavaliação vence 12 meses depois da última (decisão técnica da instituição).
- O painel conta cada pessoa uma vez (avaliação mais recente) e mostra a evolução entre a primeira e
  a última avaliação de quem tem duas ou mais.
- A base legal de cada grupo de perguntas fica em `dominio/fundamentos.ts` e na tela Sobre o instrumento.
