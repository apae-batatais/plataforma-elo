# Módulo Base de Conhecimento — regras para o agente

Leia antes `especificacao.md` desta pasta (e a ADR-039) e o `CLAUDE.md` da raiz.

- Escopo: altere apenas `src/modulos/conhecimento/` e as rotas `src/app/(elo)/conhecimento/`.
- Armazenamento: abas em `dados/tabelas.ts`, na planilha `conhecimento`. A coluna `versao` das abas é o
  controle de gravação; a versão do conteúdo da publicação se chama `edicao` (e `edicao_em`).
- Pastas: `dominio/` regras puras; `aplicacao/` casos de uso (sempre com `Autorizador` e `registrarAuditoria`);
  `dados/` tabelas e dados fictícios; `telas/`; `testes/`.
- Sigilo: `autor`, `autor_nome` e `usuario` (ciência) são pessoais; `anexo_id` (código do arquivo no Drive) é
  sensível e nunca vai ao navegador. Quem deu ciência só aparece para `conhecimento.acompanhar`, e abrir a lista
  de pessoas registra auditoria de leitura.
- Público-alvo: calculado na hora pelas atribuições do Núcleo (`dominio/publico.ts`); não há tabela de grupos.
- Ciência: gravada só no servidor, com o usuário da sessão e a hora do servidor; uma por edição; nunca alterada.
- Permissões: `conhecimento.acessar`, `.ler`, `.publicar`, `.acompanhar`, `.categorias.gerenciar`.
- Entregas: 1 (publicação e ciência) pronta; faltam 2 (teste de compreensão), 3 (curtir e comentar) e 4 (aviso por
  e-mail). Ao incluir colunas novas, lembre que a Administração precisa rodar "Preparar estrutura".
