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
- Teste: abas `Perguntas` (por edição; `correta` é sensível e nunca vai ao navegador) e `TentativasTeste` (só
  inclusão). `enviarTeste` confere no servidor; ciência com teste só depois da aprovação (regra 11).
- Curtir e comentar: `aplicacao/interacao.ts`; abas `Curtidas` (uma linha por pessoa, descurtir = `ativo = FALSE`) e
  `Comentarios` (esconder = `ativo = FALSE`, com `escondido_por` e `escondido_em`). Só quem vê a publicação interage e só
  enquanto está publicada; quem tem `conhecimento.publicar` esconde e reativa.
- Aviso por e-mail: `aplicacao/avisos.ts`; aba `Envios` (um envio por publicação e edição, texto fixo sem título, Cco). `salvarPublicacao`
  agenda ao publicar e a cada nova versão (`emailDisponivel`); a tarefa `conhecimento.avisos` da rotina envia, com 3 tentativas.
- Entregas: 1 a 4 prontas. Ao incluir colunas novas, lembre que a Administração precisa rodar "Preparar estrutura".
