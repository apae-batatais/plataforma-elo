# Plano: ligação com o Gmail, entrega 1 (#63, ADR-027)

Escopo (entrega 1 da especificação em `src/modulos/comunicacao/especificacao.md`, fase 2): peça de e-mail do
Núcleo (Gmail e memória), e-mail de envio no cadastro da instituição, rota e workflow da rotina, e-mail de teste.

Tarefas
1. `src/nucleo/email/email.ts`: contrato, memória, Gmail, MIME. Testes.
2. Coluna `remetente_email` em `Instituicoes`, validação do domínio, formulário da rede.
3. `src/plataforma/email.ts` e `app.email` na `Aplicacao`.
4. Rota `POST /api/rotina`, `src/plataforma/rotina.ts`, workflow `rotina.yml`, `chaves.json`.
5. E-mail de teste na área da rede.
6. Documentos: guia de adesão, transferência, ADR-027.

Entregas 2 (envios da Comunicação) e 3 (avisos e lembrete) seguem em PRs próprios.
