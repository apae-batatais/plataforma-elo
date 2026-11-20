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

## Aplicação de instrumentos (issue #62, entregas 1 e 2)

- Motor puro em `src/capacidades/motor-avaliacao/` (não altere; só use). Casos de uso em
  `aplicacao/aplicacoes.ts`; abas `Instrumentos`, `Aplicacoes` e `Respostas` na mesma planilha.
- A pessoa é a do Cadastro Único (`pessoa_id`): só entra quem `podeVerPessoa` permite **e** tem vínculo
  ativo num serviço em que quem avalia tem `avaliacao.avaliar`. Telas mostram iniciais, nunca o nome.
- Aplicação concluída não se edita: `corrigirAplicacao` cria outra (`corrige`). Instrumento usado só muda
  por nova versão. Instrumentos entram por `cadastrarInstrumento` (sem editor em tela).
- O comparativo ignora aplicação já corrigida e ciclos de outra versão do instrumento.

## Ligação das avaliações antigas (issue #62, entrega 3)

- Aba `LigacoesPessoa` (`avaliacao_id`, `pessoa_id`; quem confirmou e quando = `criado_por`/`criado_em`). Casos de uso em
  `aplicacao/ligacoes.ts`; tela `/avaliacao/ligar`. A avaliação original nunca muda.
- Com ligação, o comparativo e a contagem "Comparar (n)" usam `pessoa_id`; sem ela, iniciais + nascimento + sexo.
  O painel e os indicadores continuam por iniciais.
- Desfazer a ligação deixa `ativo = FALSE` (nada é apagado).
