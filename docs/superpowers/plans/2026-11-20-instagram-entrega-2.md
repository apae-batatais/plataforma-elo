# Plano: Instagram, entrega 2 (#64, ADR-028) — post com imagem

Escopo: aba `Publicacoes`, "Publicar pelo Elo" ao agendar, rota de mídia temporária, tarefa da rotina, falha
com 3 tentativas, "Tentar de novo" e "Publicar à mão". Reel e carrossel ficam para a entrega 3.

Tarefas
1. Adaptador de publicação da Meta e fictício (`nucleo/credenciais/instagram-publicacao.ts`).
2. Aba `Publicacoes`, coluna `publicacao_automatica`, regras puras (`dominio/publicacao.ts`).
3. Casos de uso: agendar com publicação automática, tentar de novo, publicar à mão (`aplicacao/publicacoes.ts`).
4. Rotina (`rodarPublicacoes`) e rota `/api/midia-temporaria/<código>`.
5. Telas: agendar, faixa "Instagram" no pedido, aviso no menu.
6. Testes, documentos, verificação, build e revisão de usabilidade.
