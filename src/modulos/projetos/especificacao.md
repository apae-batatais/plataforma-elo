# Especificação — Módulo Projetos

- Situação: aprovada pela Diretoria; entregas P1, P2 e P3 construídas, P4 a P7 pendentes (issue #143: seção "Construção de P2 a P7" no fim deste arquivo)
- Dono do produto: Diretoria
- Proposta de origem: issue #107; ligações da onda 2: issue #116. Arquitetura: ADR-011, ADR-013, ADR-021, ADR-022 e ADR-023.
- Referência do método: Guia Project DPro (PMD Pro), 2ª edição, PM4NGOs, 2020 (licença Creative
  Commons Atribuição-NãoComercial 4.0). O app usa os **conceitos** do método (fases, portas de decisão,
  termo de abertura, tolerâncias, marco lógico) e **não copia o texto do guia**. A fonte é citada na Ajuda
  do app. O guia não entra no repositório. **A confirmar pela Diretoria:** se o Elo vier a ser cobrado das
  OSCs, conferir se a licença "não comercial" afeta modelos ou textos do guia (os conceitos são de uso geral).

## Objetivo

Acompanhar um projeto da OSC **da ideia ao encerramento**: quem propôs, quem avaliou, quem aprovou, o
que foi combinado (escopo, prazo e orçamento), o que mudou no caminho, como terminou e o que se aprendeu.
Serve a projetos internos (serviço novo, obra, evento) e com financiamento externo (edital, emenda,
fundo). Cada OSC configura as portas de decisão e os limites.

Para quem: qualquer funcionário (cadastra a ideia), coordenações (assumem e gerenciam), pareceristas,
Diretoria (decide e acompanha a carteira) e Presidência ou Conselho (decidem acima do limite).

## Usuários e permissões

| Quem | Pode | Permissões |
| --- | --- | --- |
| Funcionário (perfil `funcionario`) | Cadastrar ideia; ver e acompanhar as próprias ideias | `projetos.acessar`, `projetos.propor` |
| Coordenação de serviço | Assumir ideias como responsável; desenvolver e gerenciar os projetos que assumiu; ver os projetos do seu escopo | + `projetos.assumir`, `projetos.gerenciar` |
| Parecerista (técnico, financeiro ou jurídico) | Dar parecer nas portas, só no tipo para o qual foi designado | `projetos.parecer` + designação na configuração |
| Diretoria | Ver a carteira inteira; decidir nas portas; configurar o app; decidir mudanças acima da tolerância | + `projetos.ver_todos`, `projetos.decidir`, `projetos.configurar`, `projetos.carteira` |
| Presidência ou Conselho | Decidir as portas e as mudanças acima do limite de alçada | `projetos.decidir_alcada` + designação na configuração |
| Leitura | Ver a carteira (sem pareceres) | `projetos.acessar`, `projetos.carteira` |

Os perfis `funcionario`, `coordenacao_servico`, `diretoria` e `leitura` já existem; o manifesto lhes liga as
permissões acima (os demais perfis recebem `projetos.acessar` e `projetos.propor`, como na Comunicação).
**Pareceristas e decisores de alçada não são perfis novos**: a Diretoria os designa na configuração do app,
por e-mail e por tipo (técnico, financeiro, jurídico, alçada). Cada OSC monta a sua banca sem mexer em perfis.

**Quem vê o quê**
- Ideia e projeto: quem propôs, o responsável, a equipe do projeto, quem tem `projetos.ver_todos` e quem tem
  `projetos.gerenciar` com escopo que cubra o serviço ou a unidade do projeto.
- **Pareceres**: só o responsável, os pareceristas, a Diretoria e os decisores de alçada. Quem propôs vê o
  resultado e a justificativa da decisão, não o texto do parecer.
- Carteira: números e lista de projetos para quem tem `projetos.carteira`.
- O app **não guarda dados pessoais de atendidos**. Pessoas aparecem só como e-mail institucional
  (proponente, responsável, equipe, pareceristas). Beneficiários e indicadores vêm por contagem, por ligação
  (entrega P7).

## Entidades (planilha `projetos`)

Sem dados pessoais sensíveis; colunas de e-mail têm `sigilo` interno. Todas as abas têm `ativo`; nada é
apagado.

| Aba | O que guarda |
| --- | --- |
| `Projetos` | Código sequencial (PRJ-0001), título, resumo, **tipo** (`interno`, `financiado`), **porte** (`enxuto`, `completo`), **etapa** e **fase**, proponente, responsável, serviço ou unidade (opcional), **valor estimado** e **valor aprovado**, datas previstas de início e fim, desfecho (`concluido`, `cancelado`, `parado`) |
| `ProjetoEquipe` | Projeto × e-mail × função (texto livre), vigência |
| `ProjetoDocumentos` | Conteúdo **versionado** das fases: projeto × tipo (`necessidade`, `partes_interessadas`, `problema_objetivos`, `estimativas`, `proposta`, `termo_abertura`, `plano`, `relatorio_final`, `avaliacao_final`…) × versão × conteúdo estruturado (JSON validado por zod) × situação (`rascunho`, `aprovado`, `substituido`) |
| `MarcoLogico` | Projeto × nível (`impacto`, `objetivo`, `resultado`, `atividade`) × ordem × descrição × indicador × fonte de verificação × pressuposto × item do nível acima |
| `Atividades` | Projeto × descrição × responsável × início e fim previstos × início e fim reais × situação (`a_fazer`, `em_andamento`, `concluida`, `cancelada`; `atrasada` é calculada) × peso opcional |
| `ProjetoOrcamento` | Projeto × linha (categoria, descrição) × valor planejado × fonte (texto) × versão do Termo de Abertura |
| `Riscos` | Projeto × descrição × probabilidade e impacto (`baixo`, `medio`, `alto`) × resposta × dono × situação |
| `Problemas` | Projeto × descrição × gravidade × dono × abertura × solução e data |
| `Portas` | Projeto × tipo de porta × situação (`aberta`, `aguardando_alcada`, `decidida`) × valor considerado × exige alçada (gravado na abertura) × data de abertura |
| `Pareceres` | Porta × tipo (`tecnico`, `financeiro`, `juridico`) × parecerista × resultado (`satisfatorio`, `com_ressalvas`, `insatisfatorio`) × texto × data |
| `Decisoes` | Porta × nível (`diretoria`, `alcada`) × decisor × decisão (`seguir`, `ajustar`, `parar`) × justificativa × data |
| `PedidosMudanca` | Projeto × tipo (`prazo`, `custo`, `escopo`) × valor ou prazo atual × proposto × variação × dentro da tolerância (calculado) × justificativa × quem pediu × quem decidiu × decisão × versão nova do Termo |
| `Relatorios` | Projeto × período × planejado × realizado × situação geral (`verde`, `amarelo`, `vermelho`) × texto × quem enviou |
| `Licoes` | Projeto × categoria (`planejamento`, `execucao`, `financeiro`, `pessoas`, `parceiros`, `outra`) × o que aconteceu × o que fazer diferente |
| `Encerramento` | Projeto × item do check-list (contratual, financeiro, administrativo) × feito, data e quem; transição e sustentabilidade |
| `ConfigProjetos` | Por OSC: pareceres exigidos por porta e por porte; limite de alçada (valor); pareceristas e decisores de alçada (e-mails); tolerâncias padrão; dias de atraso do encerramento |
| `LigacoesProjeto` | Projeto × app ligado (`parcerias`, `orcamento`, `requisicoes`, `avaliacao`, `comunicacao`) × identificador × nome copiado (ADR-013) |

### Ciclo de vida e portas

`rascunho` → `ideia` (assumida por uma coordenação) → **Porta 1** → fase 1 (identificação e definição) →
fase 2 (configuração) → **Porta 2** (Termo de Abertura) → fase 3 (planejamento) → **Porta 3** (plano, opcional)
→ fase 4 (implementação) → fase 5 (encerramento) → **Porta de encerramento** → `encerrado`. Em qualquer ponto:
`cancelado` ou `parado`.

| Porta | Quando | Decide |
| --- | --- | --- |
| 1 · Ideia | A ideia foi assumida e a proposta resumida está preenchida | Vale seguir, ajustar ou parar? |
| 2 · Termo de Abertura | Termo com tolerâncias preenchido | Autoriza o lançamento: **sem Termo aprovado, nada começa** |
| 3 · Plano | Plano da fase 3 preenchido | Aprova o plano (opcional; ligada no porte completo, desligada no enxuto) |
| Encerramento | Relatório final e check-list prontos | Aceita o encerramento |

Cada porta recebe os pareceres exigidos pela configuração (padrão: técnico, financeiro e jurídico nas portas
1 e 2 do porte completo; só o técnico no enxuto). Depois decide a Diretoria. Se o **valor considerado**
(estimado na porta 1, aprovado nas demais) passa do limite de alçada, a decisão **sobe para a Presidência ou o
Conselho**, que dá a decisão final.

## Regras de negócio (com teste)

**Ideia e responsável**
1. Quem tem `projetos.propor` cadastra uma ideia (título, resumo, tipo, porte, valor estimado opcional). Nasce
   `rascunho`, visível só a quem propôs e a `projetos.ver_todos`.
2. A ideia só segue quando alguém com `projetos.assumir` a **assume** e vira responsável. Só `projetos.ver_todos`
   troca o responsável, com registro. Ideia sem responsável não abre porta.
3. Quem propõe escolhe o porte; o responsável pode mudá-lo até a porta 2, nunca depois.
4. Código sequencial por instituição, nunca reaproveitado.

**Fases e documentos**
5. Cada fase tem os **documentos exigidos** por porte. No `completo`: fase 1 (necessidade, partes interessadas,
   problema e objetivos, marco lógico, estimativas, proposta); fase 2 (Termo de Abertura, riscos, partes
   interessadas, lançamento); fase 3 (atividades, cronograma, orçamento, monitoramento e avaliação, comunicação,
   compras, sustentabilidade e encerramento planejados); fase 4 (relatórios, problemas, mudanças); fase 5
   (relatório final, avaliação, lições, check-list). No `enxuto`, um subconjunto mínimo de cada fase (proposta
   resumida, Termo de Abertura simples, atividades com prazos e responsáveis, relatório curto, relatório final e
   lições). A lista exata fica em `dominio/` e é testada.
6. Não se abre porta com documento exigido em branco; a tela lista o que falta.
7. Marco lógico: ao menos 1 impacto, 1 objetivo e 1 resultado; cada resultado tem ao menos uma atividade; cada
   item (exceto atividade) tem indicador e fonte de verificação; cada item aponta para o nível imediatamente acima.

**Portas, pareceres e decisões**
8. Abrir a porta grava o **valor considerado** e se **exige alçada** (calculado uma vez; mudar o limite depois não
   muda portas já abertas).
9. Parecer só por quem foi designado para aquele tipo, **uma vez por porta** (se a porta voltar para ajuste,
   pode ser refeito e o anterior fica no histórico). `com_ressalvas` e `insatisfatorio` exigem texto.
10. A Diretoria só decide com **todos os pareceres exigidos** dados; decide `seguir`, `ajustar` ou `parar`, sempre
    com justificativa. **Quem propôs a ideia não decide a própria porta** (conflito de interesse), salvo se a
    configuração liberar.
11. Com alçada exigida: `seguir` da Diretoria deixa a porta `aguardando_alcada`; só a Presidência ou o Conselho a
    encerra (`seguir`, `ajustar` ou `parar`). `ajustar` e `parar` da Diretoria valem sem subir.
12. `ajustar` devolve o projeto à fase para correção e a porta reabre quando o responsável reenvia; `parar`
    leva o projeto a `parado` (reversível só pela Diretoria, com nova porta 1); `seguir` avança a etapa.
13. **Nenhum projeto entra em implementação sem Termo de Abertura aprovado** (porta 2 com `seguir`). Iniciar a
    implementação ou lançar relatório antes disso é recusado.
14. Todo parecer e toda decisão registram quem, quando e por quê; nunca são editados (uma nova decisão
    substitui) e são auditados com as colunas alteradas.

**Tolerâncias e mudanças**
15. O Termo de Abertura traz as **tolerâncias**: custo (% por linha do orçamento e % do total), prazo (dias de
    atraso no fim e em cada marco) e o que é "escopo livre". O padrão vem da configuração e pode ser mudado
    no Termo.
16. **Pedido de mudança dentro da tolerância**: o responsável registra e aplica sozinho, com justificativa;
    fica no histórico. **Fora da tolerância**: fica `pendente` e vai para a Diretoria (e para a alçada se o novo
    valor total passar do limite); nada muda até a decisão.
17. Mudança de escopo é sempre decidida pela Diretoria, exceto o que o Termo declarar "escopo livre".
18. Mudança aprovada fora da tolerância gera **nova versão do Termo de Abertura**, aprovada na mesma decisão; a
    anterior fica `substituido`, e o orçamento e o cronograma passam a refletir a nova versão.
19. A variação (% de custo e dias de prazo) é calculada sobre a **última versão aprovada**; o projeto é marcado
    "fora da tolerância" se a previsão ou o realizado passar dela sem pedido aprovado.

**Implementação, problemas e relatórios**
20. Atividade `atrasada` é calculada (fim previsto passado e não concluída). Concluir exige a data real. O
    responsável só altera as atividades do próprio projeto.
21. Problema aberto fica na carteira até ter solução e data; gravidade `alta` aparece em destaque.
22. **Relatório de monitoramento** compara planejado × realizado (andamento pelo peso das atividades, prazo e
    gasto). A situação geral é **calculada** pelas tolerâncias e pelos problemas abertos; o responsável pode
    piorá-la, nunca melhorá-la, com justificativa.

**Encerramento e lições**
23. Encerrar exige: atividades concluídas ou canceladas, problemas tratados, check-list completo, relatório final,
    ao menos uma lição aprendida e a decisão da porta de encerramento. Projeto `parado` ou `cancelado` também
    registra relatório resumido e lições.
24. **Lições aprendidas** são consultáveis por quem tem `projetos.acessar` (busca por categoria, tipo, porte e
    texto), sem mostrar o nome do projeto a quem não o vê.
25. Encerramento atrasado: projeto em implementação com a data prevista de fim vencida, ou em encerramento há
    mais dias que o configurado (padrão 30), aparece na carteira.

**Ligações com outros apps (entrega P7)**
26. **Atualizado em 14/11/2026 (issue #115):** as ligações com Orçamento, Requisições e Comunicação passam a ser
    especificadas em `docs/especificacao-ligacoes-entre-apps.md` (ADR-022) e construídas nas entregas L1 a L6 dessa
    especificação. Parcerias, Pessoas e Avaliação ficam com a onda 2 (issue #116). O que segue vale para elas.
    O app **nunca importa outro módulo** (ADR-013). Cada ligação usa um catálogo declarado em `projetos` e
    entregue pela plataforma: Parcerias (termo), Orçamento (fonte, orçamento e realizado do projeto),
    Requisições (compras), Cadastro de pessoas e Avaliação (contagem de beneficiários e indicadores),
    Comunicação (lançamento e divulgação). App ausente vira "ligação indisponível", nunca erro.
27. A ligação guarda identificador e cópia do nome; nenhum cadastro é repetido.

**Acesso e auditoria**
28. Toda leitura passa pelo `Autorizador`; toda gravação usa `inserir`/`atualizar` com a versão lida e chama
    `registrarAuditoria` com as colunas alteradas. Quem não vê o projeto não o vê na carteira nem nas lições.

## Telas

1. **Início**: "Meus projetos e ideias" (propostos, que eu gerencio, em que sou da equipe) e o que espera uma
   ação minha. Botão "Nova ideia".
2. **Nova ideia**: título, resumo, tipo, porte (com dica de quando usar cada um) e valor estimado. "Salvar
   rascunho" e "Enviar para uma coordenação assumir".
3. **Ideias à espera de responsável** (coordenação): botão "Assumir como responsável".
4. **Projeto**: cabeçalho (código, etapa, fase, responsável, situação) e abas: Resumo, Fase atual (formulários
   por passos, com o que falta para a próxima porta), Marco lógico, Atividades, Orçamento, Riscos e problemas,
   Mudanças, Relatórios, Equipe, Ligações e Histórico.
5. **Porta de decisão**: pareceres dados e pendentes, botões "Dar meu parecer" e "Decidir", justificativa
   obrigatória e o aviso "Esta decisão sobe para a Presidência ou o Conselho".
6. **Pedido de mudança**: mostra a tolerância e a variação em palavras ("o custo sobe 3% de 5% permitidos") e
   diz quem decide.
7. **Carteira** (Diretoria e Leitura): projetos por fase, portas pendentes, fora da tolerância, problemas em
   aberto e encerramentos atrasados; cada número leva à lista filtrada.
8. **Lições aprendidas**: busca e filtros.
9. **Configurações** (Diretoria): pareceres exigidos por porta e porte, limite de alçada, pareceristas e
   decisores (por e-mail), tolerâncias padrão.
10. **Ajuda**: explica o método em português simples e cita a fonte (Guia Project DPro, PM4NGOs).

**Melhorias de experiência de uso** (decididas por nós): Termo de Abertura pré-preenchido com a proposta; aviso na
tela (número no menu e na tela inicial) quando algo espera a pessoa; formulários por passos em vez de um
documento único; porte enxuto escondendo o que não precisa.

## Fica de fora (vai para o `docs/roadmap.md`)

- Avisos por e-mail (dependem da ligação com o Gmail, Comunicação fase 2).
- Anexos (edital, contratos) e assinatura eletrônica.
- Gantt interativo e caminho crítico (o cronograma é lista com datas).
- Prestação de contas ao financiador e contratos com fornecedores (ficam em Parcerias).
- Exportar marco lógico e Termo de Abertura em PDF.
- Modelos de projeto por tipo e cópia de projeto.

## Frentes

- **Regras e dados**: abas, regras de portas, tolerâncias, versões, permissões e auditoria.
- **Telas**: todas as listadas.
- **Infraestrutura**: chave nova `projetos` em `PLANILHAS` (Netlify) em cada OSC; permissões ligadas aos perfis
  por "Preparar estrutura".
- Núcleo, capacidades e outros módulos **não mudam**, exceto, na entrega P7, a função de leitura pequena que
  cada app oferece no seu `index.ts` (ADR-013), pedida e aprovada em cada caso.

## Entregas

Proposta grande, dividida em 7 entregas, cada uma conferível na prévia. **Sugestão: uma issue por entrega**,
ligada à #107, nesta ordem.

| # | Entrega | O que a Diretoria confere |
| --- | --- | --- |
| P1 | **Base**: módulo, permissões, ideia, porte, assumir responsável, configurações, portas com pareceres, decisões, alçada e histórico | Ideia → responsável → porta 1 → pareceres → decisão (e alçada) |
| P2 | **Fases 1 e 2**: documentos da proposta, marco lógico, Termo de Abertura com tolerâncias, riscos, porta 2 | Sem Termo aprovado não há implementação |
| P3 | **Fase 3**: atividades, cronograma, orçamento do projeto, planos, porta 3 | Atividades e orçamento do projeto |
| P4 | **Fase 4**: acompanhamento, problemas, relatórios, pedidos de mudança e versões do Termo | Mudança dentro e fora da tolerância |
| P5 | **Fase 5**: check-list, relatório final, lições aprendidas e consulta | Encerrar com lições |
| P6 | **Carteira** da Diretoria | Carteira inteira numa tela |
| P7 | **Ligações** com Parcerias (depende da entrega R2, issue #95), Orçamento, Requisições, Pessoas e Avaliação, Comunicação. Onda 1 (Orçamento, Requisições e Comunicação): `docs/especificacao-ligacoes-entre-apps.md` (issue #115). Onda 2: issue #116, seção "Ligações, onda 2" abaixo | Cada ligação sem cadastro repetido |

## Decisões tomadas sozinho (com o custo se estiverem erradas)

1. **Pareceristas e decisores de alçada designados por e-mail** na configuração, sem perfil novo. Se a Diretoria
   preferir perfis, troca-se a verificação (mexe só neste módulo; custo baixo).
2. **Quem propôs não decide a própria porta** (conflito de interesse); a configuração pode liberar. Custo baixo.
3. **Documentos de fase como conteúdo estruturado numa aba só**, versionada, em vez de uma aba por documento.
   Se errado, migrar para abas próprias (custo médio).
4. **Porta 3 (plano) opcional**: ligada só no porte completo. Se a Diretoria quiser sempre, é configuração.
5. **Situação do relatório calculada** pelas tolerâncias; o responsável só pode piorar. Custo baixo.
6. **Lições aprendidas visíveis a todos com acesso ao app**, sem o nome do projeto para quem não o vê. Se
   restringir, vira permissão (custo baixo).
7. **Mudança de escopo sempre da Diretoria**, salvo "escopo livre" no Termo.
8. **`parado` reversível só pela Diretoria**, com nova porta 1 (nada se apaga).
9. **Sem e-mail e sem anexos** nesta fase (roadmap); avisos só na tela.

## Critérios de pronto (na prévia, com dados fictícios)

- Toda ideia mostra dono, pareceres e decisão registrados no histórico.
- Não dá para iniciar a implementação sem Termo de Abertura aprovado.
- Decisão com valor acima do limite fica "aguardando alçada" até a Presidência ou o Conselho decidir.
- Mudança dentro da tolerância se aplica sozinha; fora dela espera a decisão e gera nova versão do Termo.
- Projeto encerrado tem relatório final e lições, e elas aparecem na consulta.
- A carteira mostra fases, portas pendentes, fora da tolerância, problemas e encerramentos atrasados.
- Nenhum texto de tela cita nome de instituição, unidade, marca ou cidade reais; a Ajuda cita o Guia
  Project DPro (PM4NGOs).
- Regras com testes, incluindo quem vê e quem altera; `npm run verificar` e `npm run build` verdes.

## Ligações, onda 2 (issue #116): termo de parceria, indicadores vindos de pessoas e evento de captação

- Situação: especificação aprovada. **L1 construída** (14/11/2026: `numeroAgregado` no Núcleo, `indicadoresDoServico` na Avaliação, meta com fonte automática em Parcerias). **L2 construída** (21/11/2026, #241: regras L7 a L11 e L14, aba Ligações com o termo e o botão "Criar rascunho do termo"; falta em Parcerias a ficha para completar, concluir e encerrar o rascunho, no roadmap). **L4 construída** (21/11/2026; falta ligar a fotografia `relatorio` ao relatório de monitoramento da P4 e `encerramento` ao encerramento da P5). L3 e L5 aguardam. Arquitetura: ADR-023 e ADR-013.
- Respostas da Diretoria (comentário de 13/11/2026): contagem do cadastro só de **pessoas com vínculo ativo no
  serviço**; da Avaliação só o **índice médio de necessidade de cuidado** e a **% de pessoas com reavaliação em
  dia**; **mínimo de 5 pessoas** para um número aparecer ("poucos casos para divulgar"); evento de captação com
  **porte enxuto por padrão**; rascunho do termo gerado **ao aprovar o Termo de Abertura (porta 2)**. Também
  sem objeção: ligar o evento às edições anteriores pela **série**, resultado líquido = receita − custo
  realizado, e o rascunho sempre completado pelo Financeiro.
- **Premissa:** a onda 1 (issue #115) ainda não tem especificação. Esta onda assume que ela entrega o
  **serviço como chave comum**, as requisições ligadas ao projeto (só o projeto obrigatório, atividade
  opcional) e as linhas do projeto enviadas ao orçamento do serviço, encerradas quando o projeto é cancelado,
  parado ou muda de versão do Termo. Se a #115 mudar algo disso, esta seção é ajustada antes de construir.
- **Ordem:** as entregas abaixo dependem das entregas P2 a P5 do app (ainda não construídas); cada uma diz do
  que depende.

### Usuários e permissões (o que muda)

Nenhum perfil novo. **Cada ligação respeita a permissão do app que guarda o dado** (ADR-023):

| Dado mostrado no projeto | Quem vê |
| --- | --- |
| Números de pessoas (vínculos ativos, índice médio, % reavaliação em dia) | Quem vê o projeto ou o termo; são agregados, sempre com 5 pessoas ou mais, sem nomes |
| Termo (fontes, parcelas, plano de aplicação, prazos) | Quem vê o projeto **e** tem `parcerias.termos.ver` com escopo que cubra o termo; os demais veem só "Ligado ao termo …" |
| Receita, custo e resultado do evento (do Orçamento) | Quem vê o projeto **e** tem `orcamento.painel.ver`; os demais veem só "Ligado ao orçamento" |
| Lista de requisições e pedidos de divulgação ligados | Quem vê o projeto vê **número, título e situação**; abrir o detalhe segue a permissão de cada app |

Quem cria o rascunho do termo é a decisão de seguir da porta 2 (quem tem `projetos.decidir` ou
`projetos.decidir_alcada`), não o Financeiro; o Financeiro (`parcerias.termos.editar`) o completa.

### Entidades (novas colunas e abas em `projetos`; nenhuma coluna pessoal)

| Aba | Mudança |
| --- | --- |
| `Projetos` | + `serie_evento` (texto; só captação), `data_evento`, `meta_receita`, `fonte_receita_id` e `fonte_receita_nome` (Fonte do Orçamento, cópia do nome), `termo_id` e `termo_nome` (cópia, quando há termo ligado); `tipo` ganha o valor `captacao` |
| `MarcoLogico` | + `fonte_numero` (`manual`, `vinculos_ativos`, `indice_cuidado`, `reavaliacao_em_dia`; padrão `manual`), `servico_id` e `servico_nome` (cópia), `meta` (número, opcional) |
| `IndicadoresMedidos` (nova) | Item do marco lógico × data × valor (ou vazio) × base (número de pessoas) × motivo (`poucos_casos`, `sem_dados`, `indisponivel`, vazio) × origem (`relatorio`, `encerramento`, `manual`) × quem registrou; `ativo` |
| `ProjetoDocumentos` (Termo de Abertura, projeto financiado) | + `financiador` (nome do parceiro) e `objeto` (o que o financiamento cobre), obrigatórios para a porta 2 de projeto financiado |
| `LigacoesProjeto` | Ganha os apps `termo` (Parcerias), `fonte_receita` (Orçamento), `requisicao` e `pedido_comunicacao` (o último, com `ligado_em`) |

Valores medidos **não** são guardados a cada leitura: a tela calcula na hora. `IndicadoresMedidos` guarda só a
"fotografia" tirada nos momentos da regra L12, para o histórico e o relatório final.

Mudanças fora do módulo (já listadas em "Frentes"): `Termos`, `Metas` e `TermoFontes` em **Parcerias**, `Realizado`
e `Receitas` no **Orçamento**, função de leitura nova na **Avaliação** e a regra do mínimo no **Núcleo**.
Estão descritas nas seções "Ajustes da onda 2" das especificações desses apps.

### Regras de negócio (com teste)

**Números vindos de pessoas (entrega L1 e L4)**
- L1. Um item do marco lógico, ou uma meta do termo, pode ter **fonte do número** automática: pessoas com vínculo
  ativo no serviço, índice médio de necessidade de cuidado do serviço ou % de pessoas com reavaliação em dia
  do serviço. Escolher fonte automática exige escolher o serviço. Fora essas três, nenhuma outra contagem ou
  resultado é oferecido.
- L2. **Mínimo de 5 pessoas**: o número só aparece se a base (pessoas contadas) for 5 ou mais. De 1 a 4 mostra
  "Poucos casos para divulgar" e nunca o valor, nem arredondado nem em faixa. Base 0: contagem mostra 0 (não
  identifica ninguém); média e % mostram "Sem dados". A regra é aplicada **na origem** (Núcleo e Avaliação
  devolvem o número já protegido), para nenhum app consumidor poder pular.
- L3. **Vínculos ativos** = pessoas com vínculo ativo hoje no serviço (cadastro do Núcleo; é a mesma contagem que
  Parcerias usa para ocupação). **Índice médio** = média do índice de cada pessoa, na avaliação mais recente dela
  no serviço (mesmo cálculo do indicador `avaliacao_indice_medio_cuidado`). **Reavaliação em dia** = pessoas
  cuja avaliação mais recente ainda não venceu (inclui "vence em breve"), dividido pelas pessoas com avaliação
  ativa no serviço.
- L4. **Nada individual atravessa**: a leitura devolve `valor`, `base` e `motivo`, nunca iniciais, datas de
  nascimento, ids de pessoa ou de avaliação. Teste: a resposta não tem nenhum campo além desses.
- L5. Se o app de origem (Avaliação) estiver desligado, o item mostra "Ligação indisponível" e o valor digitado à
  mão continua valendo, se houver. Item `manual` nunca muda sozinho.
- L6. Situação do indicador contra a `meta`: "Dentro da meta" (atingiu), "Abaixo da meta" ou, sem meta,
  só o número. Com "Poucos casos" ou "Sem dados", a situação não é calculada.
- L12. **Fotografia**: ao enviar o relatório de monitoramento, ao encerrar o projeto e quando o responsável
  clica em "Registrar medição", cada item automático grava uma linha em `IndicadoresMedidos` (valor, base,
  motivo, origem). Linha nunca é editada; a nova medição é outra linha. Tudo é auditado com as colunas.

**Projeto financiado e termo (entregas L2 e L3)**
- L7. No Termo de Abertura de projeto `financiado`, **financiador** e **objeto** são obrigatórios (sem eles a
  porta 2 não abre; a tela lista o que falta, como na regra 6).
- L8. Quando a porta 2 de um projeto `financiado` termina com `seguir` (inclusive depois da alçada), o Elo
  **cria o rascunho do termo em Parcerias**, uma única vez por projeto, com: financiador como parceiro, objeto,
  serviço do projeto (se houver), vigência prevista (início e fim previstos do projeto), uma fonte global com o
  **valor aprovado** do projeto e a origem (código do projeto). Número do termo, tipo de instrumento, cronograma
  e plano de aplicação **ficam para o Financeiro**; ninguém redigita valores no projeto.
- L9. A decisão da porta vale mesmo se o rascunho falhar (Parcerias desligado, erro de gravação): a decisão fica
  registrada, a aba Ligações mostra o aviso e o botão **"Criar rascunho do termo"** (só para quem pode decidir
  porta ou `projetos.gerenciar`) refaz a tentativa. Como o rascunho é único, clicar duas vezes não duplica
  (a ligação guarda o `termo_id`).
- L10. Depois de criado, o rascunho **não é reescrito pelo projeto**. Se o valor aprovado mudar (nova versão do
  Termo de Abertura) ou o termo for alterado pelo Financeiro, o projeto mostra o ponto de atenção "O valor
  aprovado do projeto (R$ X) é diferente do valor do termo (R$ Y)". Só informa.
- L11. Projeto `cancelado` ou `parado`: o rascunho **não é apagado**; o projeto avisa o Financeiro pela
  situação ("Projeto de origem cancelado") exibida na lista de termos de Parcerias, e ele decide encerrar o
  rascunho.
- L13. **Termo no projeto (leitura)**: com termo ligado, a aba Ligações mostra, para quem tem permissão (tabela
  acima): fontes e valor atual de cada uma, cronograma de desembolso (mês e valor), plano de aplicação
  (categoria e valor), recursos próprios previstos e **prazos**: próxima parcela a receber, última parcela e fim
  da vigência. Mostra ainda a linha do tempo com as **atividades com prazo** do projeto (entrega P3) e as
  parcelas do termo, em ordem de data. Prazos de **prestação de contas** ainda não existem em Parcerias
  (roadmap): a tela diz "Prazos de prestação de contas: ainda não cadastrados em Parcerias".
- L14. Rascunho de termo **não** entra em orçamento, ocupação, per capita nem alertas (ver Parcerias, regra 24) e não pode ser lido como termo em vigor por nenhum app.

**Evento de captação (entrega L5)**
- L15. Tipo `captacao` (leilão, bazar, festa, campanha, bilhetes) nasce com **porte enxuto**; o porte completo
  continua possível, escolhido por quem propõe. O **modelo curto** do Termo de Abertura traz: objetivo, data do
  evento, meta de receita, série, orçamento de custos (linhas de descrição e valor), responsável e fonte de
  receita. Tolerância de custo e prazo vêm do padrão da configuração.
- L16. **Série do evento**: texto com sugestões das séries já usadas (ex.: "Leilão anual"). Edições da mesma
  série são os projetos `captacao` com o mesmo nome de série, sem diferença de acento ou maiúscula, e a
  comparação ignora o que não foi encerrado. Série em branco = evento único, sem comparação.
- L17. **Fonte da receita**: o projeto escolhe uma Fonte do Orçamento de natureza **própria**. Na porta 2 com
  `seguir`, a meta de receita entra no Orçamento como item de **Receita "A captar"** nessa fonte (como a #115
  faz com os custos); cancelado ou parado encerra o item; nova versão do Termo troca o valor, sem apagar
  (mesma regra da onda 1). Sem fonte própria cadastrada, a tela diz "Peça ao Financeiro para cadastrar a fonte
  do evento" e a porta 2 abre mesmo assim (a ligação com a receita fica pendente e visível).
- L18. **Realizado do evento**: o Orçamento recebe um campo opcional **Projeto** nas linhas do Realizado
  (despesa e receita). **Custo realizado** = soma das despesas realizadas com o projeto; **receita realizada** =
  soma das receitas realizadas com o projeto; **resultado líquido** = receita − custo. Resultado negativo é
  escrito como "Prejuízo de R$ X".
- L19. Ao **encerrar** um evento, o relatório final mostra custo, receita e resultado (fotografia gravada junto
  das lições, não editável) e a **comparação com as edições anteriores da série**: receita, custo e resultado de
  cada edição, e a variação do resultado contra a edição imediatamente anterior. Encerrar não exige que o
  Orçamento tenha lançamentos; sem eles o resultado aparece como "Sem lançamentos no Orçamento" (e não R$ 0,00).
- L20. Compras (requisições) e divulgação (pedidos de publicação) ficam **ligadas ao evento**: a aba Ligações
  lista número, título e situação de cada uma, com a contagem de pendentes. Requisições seguem a ligação da
  onda 1; **Comunicação ganha o campo opcional "Projeto"** no pedido (se a onda 1 já o trouxer, é reaproveitado).
- L21. Acesso e auditoria como na regra 28: toda leitura de ligação passa pelo `Autorizador` do app dono do
  dado; gravações (rascunho do termo, fotografia, receita no Orçamento) usam `inserir`/`atualizar` com a versão
  lida e `registrarAuditoria` com as colunas, nunca os valores.

### Telas (o que muda)

**1. Projeto › Marco lógico: número que vem do cadastro** (quem gerencia o projeto; quer ver o resultado sem
digitar). Caminho mais curto: no item, escolher "De onde vem o número" e o serviço (2 escolhas, salvas ao
escolher); some a digitação.
- Primeira dobra: os itens com indicador, cada um com nome, **meta**, **hoje** e situação; ação principal da
  tela: **"Registrar medição"**. Percentuais usam `Indicadores` (barra de 0 a 100% com a meta tracejada,
  sentido "desde"); contagem e índice usam linha da tabela com o número e a frase ("42 pessoas com vínculo
  ativo"). Cada número tem a etiqueta "Calculado do cadastro" (`Etiqueta`, texto) e a data da leitura.
- Componentes: `Campo` (rótulo "De onde vem o número", dica "Escolha 'Digitado à mão' para informar você
  mesmo"), `SelecaoAutomatica`, `Etiqueta`, `Indicadores`, `TabelaDados` para o histórico ("Ver as medições").
- Estados: sem serviço escolhido → "Escolha o serviço para calcular"; **poucos casos** → "Poucos casos para
  divulgar (menos de 5 pessoas)", sem valor; sem dados → "Sem dados ainda"; Avaliação desligada → "Ligação
  indisponível; informe à mão, se quiser"; gravando (`BotaoEnviar`) e gravou ("Medição registrada", `?ok=`).
- Sem permissão de ver o projeto: não abre a tela.
- Gráficos: pergunta "o serviço está chegando à meta?"; forma `Indicadores` para percentual e número simples
  para contagem (valor único não vira gráfico); título em conclusão ("Reavaliações em dia estão abaixo da
  meta"), leitura ao lado: o que fazer ("Peça à equipe técnica para reavaliar as pessoas vencidas"); sem base
  mínima aparece o texto de poucos casos, nunca barra vazia ou zero.

**2. Porta 2 › decidir** (quem decide). Sem passo novo: a decisão "seguir" de projeto financiado mostra, acima do
botão, "Ao seguir, o Elo cria o rascunho do termo em Parcerias para o Financeiro completar". Confirmação (`?ok=`):
"Decisão registrada e rascunho do termo criado". Falha: `Aviso` "A decisão foi registrada, mas o rascunho do termo
não foi criado (<motivo>). Use 'Criar rascunho do termo' na aba Ligações." Não é ação sem volta além da
decisão, que já tem confirmação própria (P1).

**3. Projeto › Ligações › Termo** (responsável, Financeiro e Diretoria; quer ver parcelas e prazos junto do
projeto). Primeira dobra: situação do termo ("Rascunho, falta o Financeiro completar" ou "Em vigor até
dd/mm/aaaa"), pontos de atenção (valor diferente, projeto cancelado) e o botão **"Abrir termo em Parcerias"**
(só com permissão). Depois: fontes e valores; **Cronograma de desembolso** em `BarrasAgrupadas` (uma série, cor do
app, categoria "Mês", formato moeda), título "O termo repassa R$ X em N parcelas" e leitura "Próxima parcela:
mês e valor"; **Plano de aplicação** em `BarrasHorizontais` (maior primeiro, formato moeda), título
"Pessoal concentra X% do plano"; **Linha do tempo** em tabela (`TabelaDados`) com a coluna "O quê" em
`Etiqueta` ("Parcela do termo" ou "Atividade") e data, mais recente à frente. Todos com "Ver os números" e
`descricao`. Estados: sem termo e porta 2 aprovada → `EstadoVazio` "Este projeto ainda não tem termo" + botão
**"Criar rascunho do termo"**; sem permissão → `Aviso` "Você vê que o projeto está ligado ao termo <nome>.
Os valores aparecem para quem acessa Parcerias"; Parcerias desligado → "Ligação indisponível"; termo sem
parcelas → "O Financeiro ainda não cadastrou o cronograma". Celular: gráficos em coluna única, tabela com rolagem
lateral só dentro do cartão. Teclado: ordem do cabeçalho para os cartões; "Abrir termo" é o primeiro botão.

**4. Evento de captação** (quem propõe e coordena eventos). **Nova ideia**: ao escolher o tipo "Evento de
captação", o porte já vem "Enxuto" e o formulário troca para o modelo curto (objetivo, data, meta de receita,
série, fonte de receita, orçamento de custos). Série tem lista de sugestões (as já usadas); fonte de receita tem
dica "Escolha onde a receita entra no orçamento". Erro nunca apaga o que foi digitado. **Projeto do evento
(aba Resumo)**: no encerramento, o cartão **"Resultado do evento"** mostra o resultado líquido em número grande
(`NumeroQueConta`, texto "Sobrou R$ X" ou "Faltou R$ X"), receita e custo ao lado, e a **comparação com as
edições anteriores** em `BarrasAgrupadas` (categoria "Edição", duas séries: receita e custo, cores 1 e 2,
legenda), título em conclusão ("O resultado de 2027 passou o de 2026 em R$ X") e leitura "Edição com melhor
resultado: …". Primeira edição → texto "Primeira edição da série: ainda não há com o que comparar" (nunca
gráfico com uma barra só). Edição em andamento aparece avisada como "parcial" e fora da comparação. Sem
lançamentos → `Aviso` "O Orçamento ainda não tem lançamentos com este projeto. Peça ao Financeiro para informar
o realizado com o campo Projeto". Sem permissão do Orçamento → "O Financeiro e a Diretoria veem os valores".

**Melhorias de experiência de uso (sugestões, para a Diretoria decidir):**
- "Repetir evento da edição anterior": copia série, orçamento de custos e fonte para a nova edição (roadmap).
- Número no menu de Parcerias para os "Rascunhos de termo para completar", como o do app Projetos.
- Mostrar no Orçamento, ao informar o realizado, o projeto sugerido quando o grupo de gasto é de evento.

### Fica de fora (vai para o `docs/roadmap.md`)

- Prazos de prestação de contas do termo no projeto (dependem de Parcerias, já no roadmap).
- Outras contagens e resultados: entradas e saídas no período, quebra por faixa etária ou sexo, % que melhorou
  e % com suspeita de violação de direitos (decisão da Diretoria de 13/11/2026: só os três números acima).
- Alterar o limite mínimo de 5 pessoas por tela ou por OSC (hoje é fixo, mudar é nova decisão da Diretoria).
- Atualizar o rascunho do termo quando o projeto muda; renovar evento copiando a edição anterior.
- Receita e custo realizados lançados dentro do projeto (a fonte é o Orçamento).

### Frentes

- **Regras e dados**: abas e colunas acima, regras L1 a L21, leitura entre apps (ADR-023), permissões e auditoria.
- **Telas**: as quatro acima e os ajustes de Parcerias e Orçamento descritos nas especificações deles.
  Nenhum componente novo em `src/ui/`; todos os de `telas` e `graficos` já existem.
- **Infraestrutura**: nenhuma planilha nova. Colunas e abas novas entram por "Preparar estrutura".
- **Fora do módulo (aprovação por este PR):** Núcleo (regra `numeroAgregado` e contagem protegida), Avaliação
  (leitura por serviço), Parcerias (rascunho e meta automática), Orçamento (campo Projeto no Realizado e receita
  vinda do projeto) e Comunicação (campo "Projeto" no pedido). Cada app muda **só** o descrito aqui.

### Entregas (sugestão: uma issue por entrega, ligadas à #116)

| # | Entrega | Depende de | O que a Diretoria confere |
| --- | --- | --- | --- |
| L1 | **Números de pessoas protegidos**: regra do mínimo de 5 no Núcleo, leitura por serviço na Avaliação, meta do termo com fonte automática em Parcerias | onda 1 (serviço como chave) | Meta de termo mostra o número do cadastro; serviço com menos de 5 pessoas mostra "Poucos casos para divulgar" |
| L2 | **Rascunho do termo**: estado "rascunho" em Parcerias; criação ao aprovar a porta 2; botão para refazer | P2 | Aprovar o Termo de Abertura de um projeto financiado cria o rascunho para o Financeiro |
| L3 | **Termo dentro do projeto**: fontes, parcelas, plano, prazos e linha do tempo | L2 e P3 | O projeto mostra parcelas e prazos sem redigitação |
| L4 | **Indicadores do marco lógico** com número automático, medição e histórico | L1 e P2 | Indicador se atualiza do cadastro e respeita o mínimo |
| L5 | **Evento de captação**: tipo, modelo curto, série, receita no Orçamento, realizado com projeto, resultado e comparação, ligações de compras e divulgação | P2, P5 e onda 1 | Ao encerrar, custo, receita, resultado e comparação com a edição anterior |

### Decisões tomadas sozinho (com o custo se estiverem erradas)

1. **O mínimo de 5 vale também para a contagem de vínculos** (a Diretoria falou "número agregado"); 0 aparece.
   Em Parcerias, a ocupação por serviço continua como já aprovada (é tela do Financeiro). Se a Diretoria
   quiser contagem livre, é só tirar a regra da contagem (custo baixo).
2. **Números de pessoas aparecem a quem vê o projeto ou o termo**, sem exigir permissão da Avaliação, por serem
   agregados com 5 ou mais pessoas. Se a Diretoria exigir `avaliacao.painel`, o responsável do projeto deixa de
   ver o número (custo baixo, mas muda a utilidade).
3. **Termo e valores do Orçamento respeitam a permissão do app de origem** (proposta: "respeita a permissão de
   cada app"). Quem coordena o evento mas não tem acesso ao Orçamento não vê o resultado; a Diretoria pode
   decidir abrir (custo baixo).
4. **Rascunho de termo é um estado novo em Parcerias**, fora de todos os cálculos. Se errado, o rascunho
   contaminaria o orçamento e os alertas (custo médio, por isso o teste da regra L14).
5. **Escrever em Parcerias a partir do Projetos** (a ADR-013 só previa leitura) por uma função da plataforma,
   descrita na ADR-023. Se a Diretoria preferir só leitura, o rascunho passa a ser criado à mão pelo Financeiro
   (custo médio: perde a economia da ligação).
6. **A decisão da porta vale mesmo se o rascunho falhar**, com botão para refazer. Se errado, a decisão ficaria
   presa a um app auxiliar (custo médio).
7. **Prazos de prestação de contas ficam de fora**: Parcerias ainda não os tem (roadmap). O projeto mostra fim
   da vigência e datas das parcelas. A proposta cita os prazos; adiantar essa parte de Parcerias é uma nova
   proposta (custo médio).
8. **Custo e receita do evento vêm de um campo "Projeto" no Realizado do Orçamento**, porque Requisições não
   guardam valor e o Realizado é por totais mensais. Se a Diretoria preferir lançar dentro do projeto, o
   Financeiro digitaria duas vezes (custo médio: muda o Orçamento e o projeto).
9. **Fotografia da medição** só no relatório, no encerramento e sob pedido, em vez de a cada leitura. Se errado,
   falta histórico fino (custo baixo).
10. **Série = nome igual, sem diferença de acento ou maiúscula**, com sugestões. Se errado, edições se separam
    por erro de digitação (custo baixo: o campo se corrige).
11. **Só edições encerradas entram na comparação** e a série precisa de nome. Custo baixo.
12. **Financiador e objeto passam a ser obrigatórios no Termo de Abertura de projeto financiado.** Custo baixo
    (um campo a mais para quem propõe).
13. **"Em dia" inclui "vence em breve"**; a base é quem tem avaliação ativa no serviço. Se a Diretoria quiser
    contar só quem não está nem perto de vencer, é troca de cálculo (custo baixo).
14. **A fonte da receita é escolhida entre as Fontes de natureza própria** do Orçamento, sem criar fonte
    sozinho. Custo baixo.

### Critérios de pronto (na prévia, com dados fictícios)

- Item do marco lógico e meta do termo mostram o número do cadastro; serviço com 4 pessoas mostra "Poucos casos
  para divulgar"; com 5, mostra o número. Nenhuma resposta traz nome, iniciais, nascimento ou id de pessoa.
- Aprovar a porta 2 de um projeto financiado cria um rascunho em Parcerias (uma vez só); o termo em rascunho não
  aparece no Orçamento nem nos alertas; sem Parcerias, a decisão vale e o botão refaz depois.
- A aba Ligações mostra fontes, parcelas, plano, prazos e linha do tempo a quem tem permissão, e o aviso a quem
  não tem.
- Evento de captação nasce enxuto com modelo curto; ao encerrar mostra custo, receita, resultado líquido e a
  comparação com a edição anterior da mesma série; primeira edição diz que não há com o que comparar.
- Regras L1 a L21 com testes, incluindo quem vê e quem altera; `npm run verificar` e `npm run build` verdes.
- Nenhum texto cita nome de instituição, unidade, marca ou cidade reais.

## Construção de P2 a P7 (issue #143)

- Situação: **detalhamento para construir; não muda nenhuma decisão aprovada** (seções acima e "Ligações, onda 2").
  Sem dúvida pendente para a Diretoria. Cada entrega abaixo é um PR de entrega; a Diretoria pode pedir uma issue
  por entrega, mas a #143 já autoriza construí-las **na ordem P2, P3, P4, P5, P6, P7**.
- **Premissa da onda 2 atualizada:** a seção "Ligações, onda 2" dizia que a onda 1 ainda não tinha especificação.
  Hoje a onda 1 (`docs/especificacao-ligacoes-entre-apps.md`) está aprovada e a L1 dela está construída. As
  entregas L2 a L5 da onda 2 e L4 e L5 da onda 1 continuam esperando P2 a P5, como já estava dito.

### O que já existe e o que cada entrega acrescenta

P1 entregou: `Projetos`, `ConfigProjetos`, `Portas`, `Pareceres`, `Decisoes`, ideia, responsável, porta 1,
alçada e histórico, a leitura para a Ficha do serviço e para a agenda e a busca únicas (ADR-024). Cada entrega
abaixo declara as abas novas com `definirTabela` e as registra em "Preparar estrutura" (regra 5 do `CLAUDE.md`).
`projetos.carteira` e `ProjetoEquipe` entram com as entregas que os usam (P6 e P2).

| # | Abas novas | Regras (da lista numerada acima) | Telas | Depende de |
| --- | --- | --- | --- | --- |
| P2 | `ProjetoDocumentos`, `MarcoLogico`, `Riscos`, `ProjetoEquipe` | 5 a 7 (fases 1 e 2), 13 a 15, 8 a 12 e 14 para a porta 2 | Aba "Fase atual" por passos, "Marco lógico", "Riscos", "Equipe", porta 2 | P1 |
| P3 | `Atividades`, `ProjetoOrcamento` | 5 (fase 3), 20 (cadastro e prazos), 8 a 12 para a porta 3 opcional | Abas "Atividades" (lista com datas, sem Gantt) e "Orçamento" | P2 |
| P4 | `Problemas`, `Relatorios`, `PedidosMudanca` | 13, 16 a 22 | Abas "Riscos e problemas", "Mudanças", "Relatórios"; tela "Pedido de mudança" | P3 |
| P5 | `Licoes`, `Encerramento` | 23 a 25 | Check-list, relatório final, porta de encerramento, tela "Lições aprendidas" | P4 |
| P6 | nenhuma (lê as anteriores) | 21, 25 e 28 | Tela "Carteira" | P2 a P5 |
| P7 (**pronta**, #248) | `LigacoesProjeto` (e colunas da onda 2) | 26 e 27 | Aba "Ligações" | L1 da onda 2 (pronta); o resto das ligações é construído pelas entregas L2 a L5 de cada onda |

A P7 **não reconstrói** o que as entregas de ligação das ondas 1 e 2 já descrevem: ela entrega a aba "Ligações"
do projeto, a aba `LigacoesProjeto` e o catálogo de leitura de cada app (ADR-013 e ADR-022), de modo que L2 a L5
só preencham a aba. Antes de construir a P7, o Desenvolvedor confere no código o que as ondas já entregaram.

### Telas e usabilidade (comuns a P2 a P6)

Componentes de `src/ui/` (tabela da habilidade `telas`): `pagina`, `campo`, `botao`, `botao-enviar`,
`confirmar`, `aviso`, `tabela-dados`, `numero-que-conta`, `campo-de-busca`. **Nenhuma peça nova no Núcleo.** A
carteira usa os componentes de `graficos.tsx` só se a Diretoria pedir gráfico; por padrão são números que levam à lista.

1. **Quem usa e caminho mais curto.** O responsável do projeto preenche o que a porta seguinte exige: da página
   do projeto à porta aberta, no máximo 2 cliques ("Fase atual" já mostra "O que falta para a próxima porta", e
   cada item da lista leva direto ao formulário). Quem decide chega pela mensagem "Espera uma ação sua" no menu e
   na tela inicial.
2. **Primeira dobra do projeto:** cabeçalho (código, etapa, fase, responsável, situação) e o bloco "O que falta
   para a próxima porta". Ação principal da fase: "Preencher <documento>" e, com tudo pronto, "Abrir porta de
   decisão". Na carteira: os números que pedem ação (portas pendentes, fora da tolerância, problemas altos,
   encerramentos atrasados) vêm antes da lista.
3. **Formulários por passos**, um documento por passo, com "Salvar rascunho" sempre disponível e
   "Marcar como pronto". Rótulo sempre visível, dica do formato ("ex.: 10 dias de atraso") e obrigatórios
   marcados. Termo de Abertura vem pré-preenchido com a proposta. No porte enxuto, só os passos mínimos.
4. **Estados** (cada tela):
   - vazio: "Nada aqui ainda." + o botão da ação ("Adicionar atividade", "Registrar problema", "Registrar lição");
   - gravando: botão desabilitado com "Salvando…"; gravou: aviso "Salvo." na mesma tela;
   - erro: o texto do que falhou ("Faltou o indicador do resultado 2") e **o que a pessoa digitou fica na tela**;
     conflito de versão: "Outra pessoa alterou isto agora. Veja a versão atual e refaça a alteração.";
   - sem permissão: "Você não tem acesso a este projeto." (sem revelar título) ou, na aba, "Só quem gerencia
     o projeto altera esta aba" com o conteúdo em leitura.
5. **Ações sem volta**, todas com confirmação que diz a consequência: abrir porta ("Depois de aberta, os documentos
   da fase ficam travados até a decisão"), decidir (justificativa obrigatória; "Esta decisão sobe para a
   Presidência ou o Conselho" quando houver alçada), aplicar mudança, encerrar projeto ("O projeto passa a
   somente leitura"), parar ou cancelar.
6. **Pedido de mudança:** mostra a tolerância e a variação em palavras ("o custo sobe 3% de 5% permitidos") e
   diz quem decide ("Dentro da tolerância: você aplica" ou "Fora da tolerância: vai para a Diretoria").
7. **Celular e teclado:** abas viram lista rolável de seções; tabelas de atividades e orçamento viram cartões por
   linha; todo botão alcançável por Tab na ordem da tela; aviso de erro leva o foco ao primeiro campo com problema.
8. **Gráficos:** nenhum na P2 a P5. Na P6, a situação do relatório (verde, amarelo, vermelho) **sempre vem com a
   palavra**, nunca só a cor.
9. **Sugestões de experiência de uso** (para a Diretoria decidir; **não entram** sem aprovação):
   a) datas das portas e fins previstos de atividade entrarem na agenda única (já está no roadmap, linha da
   agenda); b) lembrete na tela quando uma atividade passa do prazo; c) copiar a linha do orçamento ao criar outra
   parecida.

### Regras de borda que a construção precisa fixar (decididas sozinho)

1. **Documento aprovado fica travado:** editar cria nova versão em `rascunho` e a anterior continua `aprovado` até
   a nova ser aprovada (então vira `substituido`). Coerente com as regras 14 e 18. Custo se errado: baixo.
2. **Fechar a fase antes da porta:** só se abre a porta com todos os documentos da fase `prontos` (regra 6); "pronto"
   é uma marca do próprio documento, não aprovação. Custo baixo.
3. **Orçamento do projeto e Orçamento da instituição são coisas separadas** até a L4: `ProjetoOrcamento` é só o
   plano do projeto. Nada é enviado ao Orçamento antes da onda 1 L4. Custo baixo.
4. **Valor aprovado** do projeto = total do orçamento da última versão aprovada do Termo; a alçada usa esse valor
   nas portas 2 em diante (regra 8). Custo médio se a Diretoria preferir digitar o valor.
5. **Quem assume o projeto como equipe** (`ProjetoEquipe`) só vê o projeto e as atividades; não altera nada e não vê
   pareceres. Altera quem tem `projetos.gerenciar` no escopo. Custo baixo.
6. **Carteira sem nome para quem não vê o projeto:** números agregados contam só projetos que a pessoa vê (regra
   28). Custo baixo.

### Fica de fora (continua no `docs/roadmap.md`)

Tudo o que a seção "Fica de fora" já lista (e-mails, anexos, Gantt, PDF, modelos). Nesta construção também fica
para depois: Gantt, caminho crítico, prestação de contas ao financiador e contratos com fornecedores (Parcerias).

### Frentes

- **Regras e dados:** abas, portas 2 e 3 e de encerramento, tolerâncias, versões do Termo, pedidos de mudança,
  permissões, auditoria (colunas alteradas, nunca valores; **texto de parecer nunca na auditoria**) e testes de quem vê e quem altera.
- **Telas:** as listadas acima, com a habilidade `telas`.
- **Infraestrutura:** nenhuma nova (a chave `projetos` em `PLANILHAS` e as permissões já existem desde a P1).
- Núcleo, capacidades e outros módulos **não mudam**, exceto, na P7, a função de leitura pequena de cada app no
  seu `index.ts` (ADR-013 e ADR-022), pedida e aprovada em cada caso.

### Critérios de pronto (na prévia, com dados fictícios)

- **P2:** projeto completo preenche proposta, marco lógico (com as validações da regra 7) e Termo com tolerâncias;
  sem Termo aprovado a implementação é recusada.
- **P3:** atividades com datas e responsável; atrasada aparece como "Atrasada"; orçamento do projeto soma e mostra o total.
- **P4:** mudança dentro da tolerância se aplica sozinha; fora dela fica pendente e, aprovada, gera nova versão do Termo.
- **P5:** projeto só encerra com check-list, relatório final e uma lição; a lição aparece na consulta.
- **P6:** carteira com os cinco números e cada um levando à lista filtrada; Leitura vê a carteira sem pareceres.
- **P7:** aba "Ligações" mostra "ligação indisponível" com o app desligado e nunca erro.
- Em todas: nenhum texto de tela cita nome real de instituição, unidade, marca ou cidade; `npm run verificar` e
  `npm run build` verdes.
