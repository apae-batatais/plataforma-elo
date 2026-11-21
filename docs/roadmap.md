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
- [ ] Casar o realizado da contabilidade pelo código da conta contábil dos grupos e fontes (o campo vem da
      proposta #127, 14/11/2026); código nas Contas da Tesouraria e nos Serviços; somar painéis por código.
- [ ] Realizado por lançamento (fornecedor, documento, fila "A classificar", regras de classificação), se a
      Diretoria quiser o detalhe.
- [ ] Conferência dos termos e do recurso livre (regras 16 e 17 da especificação): entram com a 1D.2, porque
      comparam os saldos com o realizado.

### Entrega 1C.2 · painel de execução e recursos livres, pontas para depois (17/11/2026, issue #185)

Especificado em `src/modulos/orcamento/especificacao-execucao-tesouraria.md`, seção "Entrega 1C.2".

- [ ] Perguntas P1 a P6 sobre o WK Radar (correspondências, nível do grupo, folha por área, "a classificar",
      o que conta como realizado, diferença de cerca de R$ 166 mil): respondê-las junto com a importação.
- [ ] Aba `Adiantamentos` própria, com baixa escolhida a cada ressarcimento, se a baixa automática não servir.
- [ ] Exportar a tabela de execução em CSV; clicar no serviço para ver o detalhe filtrado.

### Folha em caixa, passivo e provisão · para depois (14/11/2026, issue #126)

Especificado em `src/modulos/orcamento/especificacao-folha-caixa-passivo.md`.

- [ ] Importar a provisão e o saldo da reserva junto com o realizado, quando a importação existir (hoje são digitados).
- [ ] Rescisão antecipada de contrato por prazo determinado, reflexos do aviso e encargos patronais sobre a rescisão.
- [ ] Férias fracionadas em até três períodos no caixa.
- [ ] Verba rescisória por fonte conferida com o plano de aplicação do termo (depende de Parcerias).

### Profissionais cedidos · para depois (14/11/2026, issue #125)

Especificado em `src/modulos/orcamento/especificacao-cedidos.md`.

- [ ] Cedido no realizado e na execução (lançamento automático mensal), se a Diretoria quiser.
- [ ] Custo equivalente calculado pelo app (hoje digitado), depois de haver referência salarial.
- [ ] Aviso de fim de cessão também por e-mail; duplicar cedido; cadastro em lote de cedidos.
- [ ] Cobertura por serviço com o cedido atribuído a quem cede (painel de sustentabilidade, issue #131).
- [ ] Confirmar com a contabilidade da instituição como a cessão é reconhecida (gratuidade recebida).

### Rateio e fontes · pontas que ficaram para depois (10/11/2026, issue #91)

- [ ] Rateio R1: item de despesa sem serviço ("Comum"), botão "Dividir igualmente" e prévia com os custos reais lançados.
- [ ] Prestação de contas por termo (no app Parcerias): prazos de prestação parcial (antes de cada
      parcela), anual e final; regras do financiador que suspendem o pagamento (ex.: aluno sem
      frequência acima de 30 dias); gestores e fiscais da parceria (decisão de 11/11/2026, issue #95).
- [ ] Renovar termo copiando o do ano anterior em Parcerias (sugestão, issue #95).
- [ ] Ligar a receita do termo à fonte do termo no Orçamento.
- [ ] Conferência dos termos da Tesouraria usando as fontes de Parcerias.
- [ ] Anexar o arquivo do termo em Parcerias.

## Painel de sustentabilidade financeira · para depois (14/11/2026, issue #131)

Especificado em `src/modulos/orcamento/especificacao-sustentabilidade.md`.

- [ ] Aporte medido sobre o **realizado**, mês a mês: depende de Parcerias registrar o repasse **recebido**.
- [ ] Repasse em atraso calculado pelas datas das parcelas (hoje só pelos adiantamentos da Tesouraria, 1C.2).
- [ ] Painel por coordenação e aporte na Ficha do serviço (plataforma).
- [ ] Custo por serviço nos anos fechados (a importação do histórico, 1E, não traz).
- [ ] Sugestões: baixar o painel, simulador de repasse, número no menu quando passa do limite, texto pronto de negociação.

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
- [x] Aproveitar a mesma ligação para o aviso por e-mail do app Requisições: especificado em
      `src/modulos/requisicoes/especificacao.md` (#61, entrega 7).

Especificada em 15/11/2026 (#63, ADR-027): envio pelo Elo por conta de serviço com delegação no domínio,
remetente "não-responda@" cadastrado na instituição, rotina a cada 15 minutos. Ficam para depois:
verificação do aplicativo pelo Google (só se alguma instituição não usar delegação no domínio) e botão
"Enviar e-mail de teste" (sugestão).

### Fase 3 · publicação automática no Instagram

- [ ] Conexão da conta profissional da OSC (ligada a uma página do Facebook).
- [ ] Liberação temporária da foto ou do vídeo só durante a publicação (a Meta exige endereço
      público).
- [ ] Publicação na hora marcada e gravação do link do post.
- [ ] Em caso de falha, aviso à Comunicação e volta para "Agendado".
- [ ] Confirmar antes se a Meta exige revisão do app.

Especificada em 15/11/2026 (#64, ADR-028): conexão da conta de cada OSC pelo Elo (credenciais cifradas),
post com imagem, Reel e carrossel, rotina compartilhada com a #63. A Meta exige revisão do app e
verificação da empresa para outras OSCs usarem (pendência da Diretoria). Entregue em 20/11/2026 (entrega 3 de 3: Reel e carrossel). Ficam para depois: capa própria do Reel, história
(story), comentários e mensagens, publicar no Facebook, escolher "primeiro comentário" e conta
pessoal (a Meta só aceita conta profissional).

### Fase 4 · resultado das postagens

- [x] Alcance e curtidas das postagens do Instagram nos indicadores: especificado em
      `src/modulos/comunicacao/especificacao.md` (#65), com comentários e salvamentos também, buscados
      sozinhos uma vez por dia pela conexão já feita na Fase 3. Fica de fora a Capacidade de Indicadores
      da plataforma (#57).

### Melhorias deixadas para depois

- [x] Considerar feriados no cálculo de dias úteis da antecedência mínima: feito na entrega #67
      (a lista de feriados agora é do Núcleo e vale para a Comunicação e a Requisições).

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

## Ligações entre apps, onda 2 (issue #116, especificado em 14/11/2026)

Especificação: `src/modulos/projetos/especificacao.md`, seção "Ligações, onda 2" (ADR-023).

- [ ] **Prazos de prestação de contas do termo** no projeto: dependem de Parcerias ter esses prazos (ver "Rateio e
      fontes"). Por ora o projeto mostra fim da vigência e datas das parcelas.
- [ ] Outras contagens e resultados da Avaliação como indicador: entradas e saídas no período, quebra por faixa
      etária ou sexo, % que melhorou e % com suspeita de violação de direitos (a Diretoria aprovou só vínculos
      ativos, índice médio e reavaliação em dia, em 13/11/2026).
- [ ] Mudar o mínimo de 5 pessoas por tela ou por OSC (hoje é fixo e vale para todas).
- [ ] Atualizar o rascunho do termo quando o projeto muda (hoje só avisa a diferença de valor).
- [ ] "Repetir evento da edição anterior" (sugestão): copia série, orçamento de custos e fonte.
- [ ] Número no menu de Parcerias com os rascunhos de termo para completar (sugestão).
- [ ] Sugerir o projeto no Realizado do Orçamento quando o grupo de gasto é de evento (sugestão).

## Ligações entre apps

Issue #115 (onda 1), especificação em `docs/especificacao-ligacoes-entre-apps.md` e ADR-022. Ondas 2 e 3: issues #116 e #117.
Ficou para depois (14/11/2026):

- [ ] Valor na requisição pedido a quem pede e desconto automático das compras aprovadas no saldo (precisa de cotação e preço).
- [ ] Bloqueio de aprovação por falta de saldo ou de fonte (hoje só aviso).
- [ ] Remanejamento e suplementação das linhas de projeto dentro do Orçamento.
- [ ] Cancelar sozinho os pedidos de publicação quando o projeto for cancelado.
- [ ] Bloco de termos de Parcerias na Ficha do serviço (onda 2).
- [ ] Realizado por atividade vindo do Orçamento (hoje, por projeto; por atividade só pelas compras ligadas).
- [ ] Sugestões de experiência na Ficha do serviço: faixa "o que pede ação", atalhos de nova requisição e nova ideia, comparação com o ano anterior e impressão.

## Agenda única e busca única (issue #117, especificação em `docs/especificacao-agenda-e-busca.md`)

Ficou para depois (14/11/2026):

- [ ] Segunda entrega, depois das ondas 1 e 2 (#115 e #116): bloco "Ligado a isto" em projeto, termo e serviço;
      serviços como resultado da busca (precisam da Ficha do serviço); feriados na agenda (#67).
- [ ] Datas do Orçamento, prazos de prestação de contas (Parcerias) e prazo das portas de Projetos na agenda,
      quando existirem.
- [ ] Avisos por e-mail dos prazos (ligação com o Gmail, #63) e assinatura da agenda no Google Agenda.
- [ ] Busca em Avaliação (dado sensível; só com pedido da Diretoria).
- [ ] Sugestões ao digitar e filtro por app nos resultados da busca.

## Painel de indicadores (issue #57, especificação em `docs/especificacao-indicadores.md`)

Ficou para depois (15/11/2026):

- [ ] Indicadores novos que cruzam apps.
- [ ] Avaliação, Parcerias e Projetos no painel (hoje não têm indicador pronto).
- [ ] A Ficha do serviço passar a usar a mesma função de cálculo dos módulos.
- [ ] Foto mensal guardada, painel em PDF, alerta de indicador fora da referência e indicadores por serviço.
- [ ] Painel para coordenações ou Leitura (hoje só a Diretoria).

## Motor de avaliação (issue #62, especificação em `src/modulos/avaliacao/especificacao.md`, ADR-026)

Ficou para depois (15/11/2026):

- [ ] Instrumentos reais com escala (aguardam nome e perguntas da Diretoria, sem dados reais).
- [ ] Converter o questionário diagnóstico atual em instrumento do motor.
- [ ] Editor de instrumentos pela tela.
- [ ] Módulos de Educação e Saúde/CER usando o motor.

## Educação: avaliação de evolução (issue #163, especificação em `src/modulos/educacao/especificacao.md`, ADR-029)

Ficou para depois (15/11/2026):

- [ ] Cadastro de turmas no Núcleo e escopo do educador por turma (hoje, turma = serviço).
- [ ] Texto de cada nível de nota (0 a 3) por item, se a equipe tiver (hoje, legenda geral).
- [ ] Revisão do instrumento: item 6 da Educação Infantil mistura turma, turno e acessibilidade; uniformizar "progresso" e "avanço" (nova versão).
- [ ] Opção "não se aplica" nos itens.
- [ ] Indicadores de Educação como números do serviço em Projetos e Parcerias (ligações entre apps).
- [ ] Sugestões: lembrete de reavaliação, copiar profissional e função da última aplicação, mostrar a nota do período anterior no item.

## Saúde/CER: avaliação de evolução (issue #68, especificação em `src/modulos/saude/especificacao.md`, ADR-030)

Ficou para depois (15/11/2026):

- [ ] Texto de cada nível de nota (0 a 3) por item e opção "não se aplica", se a equipe tiver.
- [ ] Prontuário, evolução clínica e agendamento de sessões do CER (fora do escopo da avaliação).
- [ ] Escopo por equipe dentro do serviço (hoje, o escopo é o serviço).
- [ ] Indicadores de Saúde como números do serviço em Projetos e Parcerias (ligações entre apps).
- [ ] Peça comum de avaliação entre Educação e Saúde, se a repetição de código pesar.
- [ ] Sugestões: lembrete de reavaliação, copiar profissional e função da última aplicação, mostrar a nota do período anterior no item.

## Núcleo: feriados (issue #67, especificação em `docs/especificacao-feriados.md`, ADR-034)

Especificada em 17/11/2026. Ficou para depois:

- [ ] Feriados na agenda única (segunda entrega da agenda, #117).
- [ ] Feriados por unidade ou cidade (hoje a lista é única para a instituição).
- [ ] Recalcular a urgência de pedidos já enviados na Comunicação quando um feriado for incluído.
- [ ] Sugestões: mostrar no pedido da Comunicação o feriado que entrou na conta; incluir vários anos de uma vez.

## Auditoria na leitura de anexos (issue #66, especificação em `docs/especificacao-leitura-de-anexos.md`, ADR-033)

Ficou para depois (17/11/2026):

- [ ] Janela de auditoria (uma linha por pessoa e anexo a cada N minutos) se vídeos encherem a aba de auditoria.
- [ ] Conferir se o arquivo já pertence a anexo de outro módulo na mesma pasta.

## Núcleo: cadastro de pessoa e vínculo com serviço (issue #198, especificação em `docs/especificacao-pessoas-e-vinculos.md`, ADR-035)

Especificada em 18/11/2026. Ficou para depois:

- [ ] Vínculos familiares e responsáveis legais na mesma janela.
- [ ] Importar pessoas coladas de uma planilha (como em Acessos e Serviços).
- [ ] Unir cadastros duplicados e corrigir vínculo lançado por engano pela tela.
- [ ] Pedir à Diretoria, dentro do Elo, a ligação de pessoa fora do escopo.
- [ ] Publicar os eventos `PessoaVinculadaAServico` e `PessoaDesligadaDeServico` em fila quando houver consumidor.
- [ ] Sugestões: "Cadastrar outra pessoa no mesmo serviço"; link "Cadastrar pessoa" nas telas de avaliação sem pessoas.

## Orçamento: plano de contas estruturado (issue #221, especificação em `src/modulos/orcamento/especificacao.md`, ADR-036)

Três entregas (1 de 3 a 3 de 3).

- [ ] Responder P3 (folha por serviço ou área), P5 (o que conta como realizado) e P6 (diferença entre OFICIAL e
      POR ÁREA) da #185 com a contabilidade.
- [ ] Agrupar e somar painéis pelo plano de contas (Área, Grupo e Item), se a Diretoria quiser (outra proposta).
- [ ] Importar o plano de contas de uma planilha (por ora é cadastro manual).
- [ ] Plano de contas, entrega 1 (#221): "Cadastrar em lote" de Áreas e de Itens contábeis e busca por nome ou código na tela do Plano (previstos na especificação; não entraram na entrega 1).
- [ ] Item contábil e Área do plano no realizado importado, quando a importação do realizado existir.

## Avaliações: menu em família e formulários uniformes (issue #223, especificação em `docs/especificacao-plataforma.md`, ADR-037)

Especificada em 21/11/2026. Ficou para depois:

- [ ] Componente único de formulário de avaliação entre os três apps (hoje só o mesmo leiaute).
- [ ] Página própria da família "Avaliações" e painel comum aos três eixos.
- [ ] Busca por nome também no formulário da Saúde (sugestão).

## Requisições: agendamento de veículos (issue #229, especificação em `src/modulos/requisicoes/especificacao.md`)

Especificada em 21/11/2026. Ficou para depois:

- [ ] Campo de passageiros conferido com a capacidade do veículo.
- [ ] Aviso por e-mail ao Transporte (junto com o aviso por e-mail das requisições).
- [ ] Relatório de quilometragem e de usos com problema por veículo e mês.
- [ ] Condutor ligado ao cadastro de pessoas; abastecimento, multas e vistoria com foto.

## Requisições: agendamento de espaços (issue #230, especificação em `src/modulos/requisicoes/especificacao.md`)

Especificada em 21/11/2026. Ficou para depois:

- [ ] Repetição semanal (toda terça às 14h); reserva de mais de um dia.
- [ ] Itens de apoio, taxa de uso, aprovador por espaço e formulário público.
- [ ] Cancelar reserva já aprovada; marcar "não usado"; agenda por dia com filtro de espaço.

## Base de Conhecimento (especificado em 21/11/2026, issue #231)

Especificação: `src/modulos/conhecimento/especificacao.md` (ADR-039). Ordem: publicação e ciência → teste
de compreensão → curtir e comentar → aviso por e-mail.

- [ ] Geolocalização na ciência (sem travar quem negar a permissão do navegador).
- [ ] Carimbo de tempo ICP-Brasil (depende de a Diretoria contratar um prestador credenciado).
- [ ] Prazo de ciência por publicação e lembrete por e-mail para quem segue pendente.
- [ ] Vídeo, mais de um anexo e link externo como formato de publicação.
- [ ] Exportar a lista de ciências; relatório por pessoa entre publicações.
- [ ] Editar o próprio comentário, respostas a comentários e aviso ao editor de novos comentários.
- [ ] Embaralhar a ordem das opções do teste a cada tentativa.
