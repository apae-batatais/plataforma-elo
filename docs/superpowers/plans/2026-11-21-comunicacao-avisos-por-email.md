# Plano: Comunicação, avisos por e-mail (#184)

Especificação: `src/modulos/comunicacao/especificacao.md`, "Fase 2 · entrega 3".

1. Domínio: modelos de texto fixos (`dominio/aviso.ts`) e colunas `modelo` e `origem` em `Envios`.
2. Configuração: `avisos_por_email` em `Parametros` (só `comunicacao.configurar`).
3. Casos de uso: criar o aviso com a mudança de situação; rotina `rodarAvisos` (resumo, lembrete, falha, envio com 3 tentativas).
4. Telas: Configurações, histórico do pedido, contagem da tela inicial.
5. Ajuda, documentos, verificação e build.
