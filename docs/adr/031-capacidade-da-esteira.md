# ADR-031 · Capacidade da esteira: planejamento semanal, fila de construção e cota de minutos

- Situação: aceita
- Data: 2026-11-16
- Complementa: ADR-019 (desenvolvimento automatizado pelo GitHub)

## Contexto

Em 16/11/2026 a cota gratuita de minutos do GitHub Actions da organização (2.000 por mês, limite de
gasto US$ 0) acabou: agentes, prévias, merges automáticos e publicação pararam até 01/12. A
estimativa de 1º a 16/11 foi de cerca de 1.900 minutos, puxada pelo ritmo de muitas entregas por
dia (verificação, prévias e agentes) e por conflitos em cadeia entre PRs abertos ao mesmo tempo.
Depois da fase inicial, a tendência é estabilizar e trabalhar com prazos. A Diretoria decidiu
(16/11/2026) planejar pelo esforço disponível, sem deixar entrega começada pela metade.

## Decisão

1. **Planejamento semanal**, alinhado com a publicação de sexta: o Scrum Master fecha com a
   Diretoria o que entra na semana seguinte e em que ordem (a ordem é a do quadro "Elo").
2. **Capacidade = minutos do mês.** O DevOps estima o gasto pelas execuções registradas
   (`.github/scripts/consumo.mjs`; o número oficial está só na página de cobrança, que só a
   Diretoria vê) e mede o custo de cada entrega. Reserva fixa para o que roda sempre (verificar a
   `main`, publicar, Fluxo, correções).
3. **No máximo 2 entregas em construção.** Especificação aprovada entra na fila ("Pronta para
   construir"); entrega aprovada abre vaga. O workflow **Fila** (`fila.yml`, chamado pela
   Aprovação) chama o Desenvolvedor das próximas, na ordem do quadro (sem quadro, a mais antiga).
   Issue em construção com "pergunta aberta" não ocupa vaga.
4. **Faixas de consumo.** Acima de 70% da cota: o DevOps avisa o Scrum Master no raio-x. Acima de
   85%: o DevOps abre uma "pendência da Diretoria" com a etiqueta `cota: pausa`; enquanto ela
   estiver aberta, nenhuma entrega nova começa (as em construção terminam). Com o "pode seguir" da
   Diretoria, o DevOps fecha a pendência e chama a Fila.

## Consequências

- O site nunca recebe entrega pela metade (só entra na `main` PR verificado e aprovado); o que a
  decisão evita é entrega travada no meio por falta de minutos.
- Menos conflitos entre PRs e menos minutos gastos com atualizações.
- Entregas esperam mais na fila em semanas de muitas aprovações; furar a fila é pedido da Diretoria
  ao DevOps (chamar o Desenvolvedor à mão).
- A leitura da ordem do quadro não pôde ser testada contra o quadro real na criação (sem a chave do
  quadro no ambiente do DevOps); se falhar, a Fila avisa no log e usa a proposta mais antiga.
- O saldo estimado pode diferir um pouco do oficial; as faixas têm folga para isso.

## Revisão de 20/11/2026

Com o repositório público (ADR-032), a cota de minutos deixou de limitar. A Diretoria subiu o limite
para **3 entregas em construção** e pediu controle de conflitos: a Fila evita chamar duas entregas
do mesmo app ao mesmo tempo (etiqueta "app: …"; "app: novo" não conta) e só repete o app quando não
há alternativa, para a vaga não ficar parada. Se aparecerem falhas por limite de uso da assinatura
do Claude, o DevOps volta para 2 e avisa.
