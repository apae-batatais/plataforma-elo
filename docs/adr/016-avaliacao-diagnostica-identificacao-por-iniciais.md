# ADR-016 · Avaliação Diagnóstica: questionário próprio e identificação por iniciais

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
- Duas avaliações da mesma pessoa só se relacionam pelas iniciais e nascimento; comparar ciclos
  por pessoa e ligar ao Cadastro Único fica para uma próxima entrega (migração das avaliações
  para `pessoa_id` quando os atendidos estiverem no Núcleo).
- Quando o motor de avaliação existir, este questionário pode virar um instrumento versionado
  (ADR-007), mantendo as respostas já gravadas.
