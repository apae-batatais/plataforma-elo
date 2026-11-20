# Módulo Comunicação — regras para o agente

Leia antes `especificacao.md` desta pasta e o `CLAUDE.md` da raiz.

- Escopo: altere apenas `src/modulos/comunicacao/` e as rotas `src/app/(elo)/comunicacao/`.
- Armazenamento: abas em `dados/tabelas.ts`, na planilha `comunicacao`. Não leia nem grave
  abas de outros módulos; se precisar de dado de outro módulo, siga a ADR-013.
- Pastas: `dominio/` regras puras; `aplicacao/` casos de uso (sempre com `Autorizador`,
  histórico e `registrarAuditoria`); `dados/`; `telas/`; `testes/`.
- Dados pessoais: `Pedidos.solicitante`, `solicitante_nome` e `imagem_confirmada_por`;
  `Historico.usuario`; `Contatos.nome` e `email`; `Anexos.nome`; `Envios.destinatarios`. Sensível: `Anexos.arquivo_id`
  (a foto pode mostrar pessoas: leitura só pelo Elo, com auditoria).
- Nada é apagado: pedido cancelado, recusado ou juntado fica com a situação; o histórico só
  recebe inclusões; calendário e contatos são encerrados com `ativo = FALSE`.
- Datas do dia sempre no horário de Brasília (`diaEmBrasilia`), nunca `toISOString().slice(0, 10)` direto.
- Permissões: `comunicacao.<recurso>.<acao>`, declaradas no manifesto.
- Instagram (ADR-028): `aplicacao/instagram.ts` usa a peça `src/nucleo/credenciais/`. O token nunca sai da camada de
  aplicação (tela, rota, log, erro e auditoria não o mostram); só `comunicacao.configurar` conecta e desconecta.
- Envios por e-mail (ADR-027): `aplicacao/envios.ts`. Release e artigo agendados com "Enviar pelo Elo" criam um `Envio`
  pendente; a tarefa `comunicacao.envios` da rotina (em `src/plataforma/rotina.ts`) envia, com 3 tentativas. O corpo da
  mensagem nunca é gravado e o erro gravado é resumido (sem endereço nem texto). Só `comunicacao.revisar` vê e tenta de novo.
