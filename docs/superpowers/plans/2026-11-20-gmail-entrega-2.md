# Plano: ligação com o Gmail, entrega 2 (#63, ADR-027)

Escopo: aba `Envios`, agendar release e artigo com envio automático, rotina de envio, falha com 3 tentativas e
"tentar de novo". Avisos e lembrete por e-mail ficam na proposta #184.

Tarefas
1. Aba `Envios`, coluna `envio_automatico`, regras de domínio (`dominio/envio.ts`).
2. Casos de uso (`aplicacao/envios.ts`) e ligação em `agendarPedido` e `publicarPedido`.
3. Tarefa `comunicacao.envios` na rotina.
4. Telas: "Como enviar", faixa "Envio", aviso na tela inicial.
5. Testes (`testes/envios.test.ts`), documentos, verificação e PR.
