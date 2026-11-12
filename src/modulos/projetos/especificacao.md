# Especificação — Módulo Projetos

- Situação: rascunho, aguardando aprovação da Diretoria
- Dono do produto: Diretoria
- Proposta de origem: issue #107. Arquitetura: ADR-011, ADR-013 e ADR-021.
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
26. O app **nunca importa outro módulo** (ADR-013). Cada ligação usa um catálogo declarado em `projetos` e
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
| P7 | **Ligações** com Parcerias (depende da entrega R2, issue #95), Orçamento, Requisições, Pessoas e Avaliação, Comunicação | Cada ligação sem cadastro repetido |

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
