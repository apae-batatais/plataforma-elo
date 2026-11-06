# Roadmap · Elo

Atualizado em 6 de novembro de 2026 · Diretoria da Apae Batatais

Registra o que ficou combinado para depois em cada app do Elo. Cada fase ganha a sua própria
especificação antes de ser construída.

A ordem de trabalho entre os apps fica no [backlog](backlog.md).

## Comunicação

App para gerenciar os pedidos de publicação: calendário de temas, pedidos de qualquer
funcionário, revisão, aprovação, agendamento e publicação. Cada OSC tem as próprias demandas,
contatos e contas conectadas.

### Fase 1 · especificação em revisão

Fluxo completo sem nenhuma integração externa (especificação:
`src/modulos/comunicacao/especificacao.md` no repositório):

- Calendário (data exata ou período, tipos de peça sugeridos), pedidos (com "fora do
  calendário", data desejada, urgência pela antecedência mínima e aviso de autorização de
  imagem), revisão, aprovação, agendamento e publicação marcada à mão com o link.
- Instagram agendado pela Comunicação no Meta Business Suite.
- Release e artigo: o app abre um e-mail pronto no Gmail (destinatários em cópia oculta, assunto
  e texto); a Comunicação anexa o arquivo.
- Avisos só no Elo (pendências na tela inicial e número no menu).
- Indicadores de volume, prazo e cobertura do calendário, para a coordenação e a Diretoria.

### Fase 2 · ligação com o Gmail

- [ ] Ligação do Elo com o Gmail (peça nova do núcleo e configuração no Google da instituição).
- [ ] Avisos por e-mail quando a pessoa precisa agir e quando o pedido é publicado.
- [ ] Lembrete por e-mail à Comunicação no dia agendado.
- [ ] Rotina agendada no servidor envia release e artigo na data e hora marcadas, pelo Gmail da
      Comunicação, com o anexo.
- [ ] Envio registrado; em caso de falha, a Comunicação é avisada e o pedido não passa para
      "Publicado".
- [ ] Verificação do app no Google para OSCs de outros domínios usarem o envio.
- [ ] Aproveitar a mesma ligação para o aviso por e-mail do app Requisições.

### Fase 3 · publicação automática no Instagram

- [ ] Conexão da conta profissional da OSC (ligada a uma página do Facebook).
- [ ] Liberação temporária da foto ou do vídeo só durante a publicação (a Meta exige endereço
      público).
- [ ] Publicação na hora marcada e gravação do link do post.
- [ ] Em caso de falha, aviso à Comunicação e volta para "Agendado".
- [ ] Confirmar antes se a Meta exige revisão do app.

### Fase 4 · resultado das postagens

- [ ] Alcance e curtidas das postagens do Instagram nos indicadores.

### Melhorias deixadas para depois

- [ ] Considerar feriados no cálculo de dias úteis da antecedência mínima (na fase 1, segunda a
      sexta). Hoje o cadastro de feriados existe só no app Requisições; para usar nos dois, ele
      precisa ir para o núcleo do Elo.
