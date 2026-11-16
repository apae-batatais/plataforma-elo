# Capacidades compartilhadas

Código usado por vários módulos. Não depende de módulos (regra de fronteira).

- `motor-avaliacao/` — instrumentos versionados, ciclos, aplicações e escores (Fase 2, ADR-006, ADR-007 e ADR-026). Código puro: instrumento, respostas, escore, enquadramento e comparação entre ciclos; quem guarda e autoriza é o módulo de cada eixo.
- `indicadores/` — cálculo e leitura de indicadores declarados nos manifestos (portão da Fase 0).
