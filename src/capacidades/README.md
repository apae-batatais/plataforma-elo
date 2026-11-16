# Capacidades compartilhadas

Código usado por vários módulos. Não depende de módulos (regra de fronteira).

- `motor-avaliacao/` — instrumentos versionados, ciclos, aplicações e escores (Fase 2, ADR-006, ADR-007 e ADR-026). Código puro: instrumento, respostas, escore, enquadramento e comparação entre ciclos; quem guarda e autoriza é o módulo de cada eixo.
- `indicadores/` — molde dos indicadores do painel da Diretoria: tipos, situação e formato (ADR-025). Cada módulo calcula os seus.
