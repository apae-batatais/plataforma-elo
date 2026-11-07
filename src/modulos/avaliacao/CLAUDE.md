# Módulo Avaliação de Serviços Sociais — regras para o agente

Leia antes `especificacao.md` desta pasta e o `CLAUDE.md` da raiz.

- Escopo: altere apenas `src/modulos/avaliacao/` e as rotas `src/app/(elo)/avaliacao/`.
- Armazenamento: aba `Avaliacoes` em `dados/tabelas.ts`, na planilha própria
  `avaliacao_assistencia` (dados sensíveis separados — ADR-011). Do Núcleo, só lê
  `Servicos` e `Areas` (nomes do cadastro).
- Pastas: `dominio/` regras puras (questionário, índice, painel); `aplicacao/` casos de uso
  (sempre com `Autorizador` e `registrarAuditoria`); `dados/`; `telas/`; `testes/`.
- Dados pessoais: `iniciais`, `nascimento`, `sexo`, `prontuario`, `cuidador`. Sensíveis: saúde,
  dependência, família, barreiras e observações. Nunca grave valores na auditoria nem mostre
  identificação no painel.
- Identificação só por iniciais, nascimento e sexo (ADR-016): não peça nome completo.
- O índice de necessidade de cuidado é calculado na leitura (`indiceDeCuidado`), não guardado.
- Nada é apagado: avaliação retirada fica com `ativo = FALSE` e `motivo_retirada`.
- Permissões: `avaliacao.<acao>`, declaradas no manifesto.
