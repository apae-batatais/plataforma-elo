# Roadmap · Elo

Atualizado em 7 de novembro de 2026 · Diretoria (dona do produto)

Registra o que ficou combinado para depois em cada app do Elo. Cada fase ganha a sua própria
especificação antes de ser construída.

A ordem de trabalho entre os apps fica no [backlog](backlog.md).

## Orçamento

Especificação de Execução, Tesouraria e Histórico aprovada em 07/11/2026
(`src/modulos/orcamento/especificacao-execucao-tesouraria.md`). Ordem: 1D.1 → 1E → 1C.1 → 1C.2 → 1D.2.

### Histórico (1E) · pontas que ficaram para depois (09/11/2026)

- [ ] **Painel geral da 1B** usar o Histórico para mostrar todos os anos (hoje mostra até 4 exercícios).
- [ ] **Histórico vindo do realizado** (regra 25): a partir do primeiro ano com a Execução no app, o histórico
      desse ano vem do realizado, e não da importação. Depende da 1C.1.
- [ ] Confirmar com a Diretoria a associação das linhas antigas às fontes (pendência 4 da especificação):
      hoje a pessoa escolhe a fonte de cada linha na importação.

### Entrega 1C · realizado informado à mão (especificado em 10/11/2026, issue #59)

A primeira versão não importa o WK Radar: o realizado é digitado por mês, serviço, grupo, fonte e natureza
(`src/modulos/orcamento/especificacao-execucao-tesouraria.md`, seção "Revisão de 10/11/2026").
Ordem: 1C.1 → 1C.2 → 1D.2.

- [ ] **Importar o realizado a partir de um modelo**, ou criar uma ferramenta que mapeia as colunas da
      planilha de origem com base na estrutura do Elo (decisão da Diretoria em 09/11/2026). As linhas entram
      na mesma aba `Realizado`. Depende de a Diretoria definir o modelo ou de uma amostra da exportação do
      WK Radar (com dados fictícios ou anonimizados).
- [ ] Realizado por lançamento (fornecedor, documento, fila "A classificar", regras de classificação), se a
      Diretoria quiser o detalhe.
- [ ] Conferência dos termos e do recurso livre (regras 16 e 17 da especificação): entram com a 1D.2, porque
      comparam os saldos com o realizado.

### Rateio e fontes · pontas que ficaram para depois (10/11/2026, issue #91)

- [ ] Rateio R1: item de despesa sem serviço ("Comum"), botão "Dividir igualmente" e prévia com os custos reais lançados.
- [ ] Prestação de contas por termo (no app Parcerias): prazos de prestação parcial (antes de cada
      parcela), anual e final; regras do financiador que suspendem o pagamento (ex.: aluno sem
      frequência acima de 30 dias); gestores e fiscais da parceria (decisão de 11/11/2026, issue #95).
- [ ] Renovar termo copiando o do ano anterior em Parcerias (sugestão, issue #95).
- [ ] Ligar a receita do termo à fonte do termo no Orçamento.
- [ ] Conferência dos termos da Tesouraria usando as fontes de Parcerias.
- [ ] Anexar o arquivo do termo em Parcerias.

## Comunicação

App para gerenciar os pedidos de publicação: calendário de temas, pedidos de qualquer
funcionário, revisão, aprovação, agendamento e publicação. Cada OSC tem as próprias demandas,
contatos e contas conectadas.

### Fase 1 · especificação aprovada (06/11/2026), em construção

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

## Plataforma (arquitetura)

### Depois de cerca de 5 clientes · banco relacional (ADR-017, 07/11/2026)

- [ ] Migrar o armazenamento das Google Planilhas para Postgres relacional, app por app.
- [ ] Hospedagem e banco na região de São Paulo.
- [ ] Decidir entre banco compartilhado e banco por cliente, com os preços da época (nova ADR).
- [ ] Copiar os dados reais das planilhas para o banco pelo GitHub Actions, sem acesso do agente.
- [ ] Decidir onde ficam fotos e vídeos (hoje no Drive, ADR-014).

## Projetos

App novo (issue #107; especificação em `src/modulos/projetos/especificacao.md`), em 7 entregas (P1 a P7).
Ficou para depois (12/11/2026):

- [ ] Avisos por e-mail quando a pessoa precisa agir (depende da ligação com o Gmail, Comunicação fase 2).
- [ ] Anexos (edital, contratos) e assinatura eletrônica.
- [ ] Gantt interativo e caminho crítico.
- [ ] Exportar o marco lógico e o Termo de Abertura em PDF.
- [ ] Modelos de projeto por tipo e cópia de projeto.
- [ ] Conferir a licença do Guia Project DPro (Creative Commons não comercial) se o Elo vier a ser cobrado.

## Agenda única e busca única (issue #117, especificação em `docs/especificacao-agenda-e-busca.md`)

Ficou para depois (14/11/2026):

- [ ] Segunda entrega, depois das ondas 1 e 2 (#115 e #116): bloco "Ligado a isto" em projeto, termo e serviço;
      serviços como resultado da busca (precisam da Ficha do serviço); feriados na agenda (#67).
- [ ] Datas do Orçamento, prazos de prestação de contas (Parcerias) e prazo das portas de Projetos na agenda,
      quando existirem.
- [ ] Avisos por e-mail dos prazos (ligação com o Gmail, #63) e assinatura da agenda no Google Agenda.
- [ ] Busca em Avaliação (dado sensível; só com pedido da Diretoria).
- [ ] Sugestões ao digitar e filtro por app nos resultados da busca.
