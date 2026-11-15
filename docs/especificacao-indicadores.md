# Painel de indicadores da Diretoria · especificação

Issue #57 · 15/11/2026 · ADR-025

Decisões da Diretoria (comentários da issue): o painel é **separado** da Ficha do serviço (não a substitui
nem a complementa) e é **só da Diretoria**. Os indicadores que entram são os que **já existem** em
Orçamento, Requisições e Comunicação, reunidos num painel único.

## Objetivo e para quem

Ver, num lugar só, como a instituição está indo em cada app, e como isso mudou ao longo do tempo, sem abrir
app por app. Para a Diretoria. A Ficha do serviço continua olhando **um serviço**; este painel olha a
**instituição toda**, com a evolução mês a mês (ou ano a ano).

## Usuários e permissões

- Permissão nova `plataforma.indicadores.ver`, ligada só ao perfil **Diretoria** (em `PERMISSOES_INICIAIS`,
  criada por "Preparar estrutura"). Administração da plataforma, coordenações, Financeiro e Leitura **não** veem.
- Cada app ainda confere a própria permissão: Orçamento `orcamento.painel.ver`, Requisições
  `requisicoes.painel` (em algum escopo), Comunicação `comunicacao.indicadores`. Se a Diretoria não a tiver
  num app, o bloco daquele app mostra "Sem acesso a este app" (nunca amplia o acesso).
- Quem não tem `plataforma.indicadores.ver` e abre `/indicadores` vê a tela de sem permissão e o item não
  aparece no menu.
- Nenhum dado pessoal: só contagens, percentuais, médias e valores já somados.

## O que entra (só o que já existe)

| App | Indicador (id do manifesto) | Como lê | Periodicidade |
| --- | --- | --- | --- |
| Requisições | `requisicoes_aprovacao_no_prazo` | % aprovadas no prazo (e quantas) | por mês |
| Requisições | `requisicoes_atendimento_no_prazo` | % atendidas no prazo (e quantas) | por mês |
| Comunicação | `comunicacao_volume` | pedidos no período | por mês |
| Comunicação | `comunicacao_tempo_aprovacao`, `comunicacao_tempo_publicacao`, `comunicacao_tempo_revisao` | média em dias úteis | por mês |
| Comunicação | `comunicacao_publicados_com_atraso` | % publicados com atraso | por mês |
| Comunicação | `comunicacao_urgentes` | pedidos urgentes | por mês |
| Orçamento | `folha_sobre_receita`, `dependencia_recursos_publicos`, `recursos_livres` | % da receita do exercício | por ano |
| Orçamento | `resultado_previsto` | receita menos despesa previstas | por ano |

**Fora desta entrega:** `comunicacao_temas_sem_publicacao` (é uma lista, não um número; continua na tela do
app), os indicadores do Orçamento que dependem de tela própria (`custo_folha_centro`, `folha_sem_rateio`,
`passivo_trabalhista`, `ferias_em_dobro`), Avaliação, Parcerias e Projetos (não têm indicador hoje), e
**indicadores novos que cruzam apps** (ficam para depois de validar o molde).

## Entidades

Nenhuma aba nova nem coluna nova: tudo é leitura das abas que os apps já têm. O painel não grava nada e
não registra auditoria de leitura (não há dado pessoal nem individual).

## Regras de negócio (com teste)

1. A capacidade (`src/capacidades/indicadores/`) define o molde e não importa módulo nem lê planilha
   (`npm run fronteiras` confere). Tipos: definição (id, nome, explicação, formato `numero`/`pct`/`dias`/`moeda`,
   sentido "quanto mais, melhor" ou "quanto menos, melhor" ou neutro, referência opcional) e pontos
   (período, valor ou `null`, base de cálculo, ex.: "12 de 15").
2. Cada módulo exporta `indicadoresDaPlataforma(p, quem, periodo)` com o **mesmo cálculo** da tela do app
   (reaproveitando `painelDePrazos`, `montarIndicadores`, `painelGeral`). Teste: o valor do painel é igual ao
   da tela do app para os mesmos dados.
3. Todo `id` devolvido existe em `manifesto.indicadores` do módulo; todo id do manifesto desta tabela é devolvido.
4. Sem dado no período, o valor é `null` e a tela escreve "Sem dados", nunca 0 nem 100%.
5. A situação (dentro ou fora da referência) vem sempre **escrita**, nunca só pela cor. Só há referência onde o
   app já tem uma; o painel não inventa meta. Indicador sem referência não recebe "bom" nem "ruim".
6. Mês corrente é **parcial**: aparece marcado "até hoje" e não entra na comparação com o mês anterior.
7. Períodos: meses de um ano civil (padrão: ano atual; mudar pelo seletor de ano). Orçamento mostra um ponto
   por exercício existente. Datas no horário de Brasília, com relógio injetável nos testes.
8. Acesso: só quem tem `plataforma.indicadores.ver` abre; o app que a pessoa não pode ler é omitido do cálculo
   e avisado ("Sem acesso a este app"). Teste: Diretoria vê; Administração, coordenação, Financeiro e Leitura não.
9. Falha de leitura de um app: o painel mostra os demais e `Aviso` "Não foi possível ler: <app>".
10. Perfil novo ou permissão nova não muda quem vê os apps; "Preparar estrutura" só acrescenta a permissão
    à Diretoria e não a retira de ninguém.

## Telas

### Painel de indicadores (`/indicadores`, item "Indicadores" no menu, só para a Diretoria)

1. **Quem usa e o que quer:** a Diretoria, saber se a instituição está no rumo. Caminho mais curto: abrir
   "Indicadores" (1 clique) e ler o resumo; abrir o app de origem para agir é mais 1 clique.
2. **Primeira dobra:** `CabecalhoPagina` "Indicadores da instituição" com o seletor de ano; logo abaixo uma
   faixa de números de destaque (`NumeroQueConta`), um por app, o mais importante de cada um: "Aprovadas no
   prazo", "Pedidos de comunicação no ano" e "Resultado previsto"; em cada um, a situação escrita e o mês (ou
   ano) anterior para comparar. Ação principal: "Abrir <app>" em cada bloco (link para a tela do app).
3. **Componentes de `src/ui/`:** `CabecalhoPagina`, `Secao`, `Aviso`, `EstadoVazio`, `Etiqueta`,
   `SeletorAno`, `NumeroQueConta`, `Linhas` (evolução), `BarrasAgrupadas` (Orçamento por ano), `Indicadores`
   (barra com referência) e `TabelaDados` (a mesma série em tabela). **Peça nova (mudança no Núcleo, a
   aprovar):** `IconeIndicadores` em `icones.tsx` e o item no menu da plataforma.
4. **Estados:** sem dados no período ("Sem dados em 2026" + "Ver outro ano"); app sem acesso ou que falhou
   (`Aviso` com o nome do app); sem permissão ("Este painel é da Diretoria" + quem procurar). Não há gravação.
5. **Formulário:** só o seletor de ano, aplicado na hora pelo endereço (`?ano=AAAA`); ano inválido volta ao atual.
6. **Ação sem volta:** nenhuma.
7. **Celular e teclado:** blocos em coluna única; a tabela da série fica ao lado do gráfico no computador e
   abaixo no celular. Ordem de tabulação: seletor de ano, blocos na ordem do menu dos apps.
8. **Gráficos** (um por pergunta; ao lado, a leitura do que fazer):
   - *Requisições — "Estamos aprovando e atendendo dentro do prazo?"* **Linhas**, duas séries (aprovação e
     atendimento), eixo em %, mês no eixo X. Título em conclusão, ex.: "Atendimento no prazo caiu em outubro".
     Referência só se o app tiver uma. Mês corrente parcial marcado; sem dados, "Sem requisições decididas no mês".
   - *Comunicação — "Quanto pedimos e quanto demoramos?"* **Linhas** do volume por mês e, ao lado, três
     números com `Indicadores` (tempo médio em dias úteis de revisão, aprovação e publicação) e o % com atraso.
   - *Orçamento — "A receita sustenta a folha?"* **BarrasAgrupadas** por exercício: folha sobre receita,
     dependência de recursos públicos e recursos livres (3 séries, em %); `resultado_previsto` como número de
     destaque em `moeda`. Leitura ao lado: o que cada percentual significa, com o texto que o Orçamento já usa.
   - Todo gráfico tem a tabela equivalente (`TabelaDados`) e descrição para leitor de tela.
9. **Sugestões de melhoria (não incluídas):** guardar a foto do mês para o painel nunca mudar o passado depois
   de uma correção nos dados; "baixar o painel em PDF" para reuniões; indicadores por serviço (ligação com a
   Ficha do serviço); alerta quando um indicador sair da referência.

Textos sem nome de instituição, unidade, marca ou cidade reais.

## Fica de fora (vai para o `docs/roadmap.md`)

- Indicadores novos que cruzam apps; Avaliação, Parcerias e Projetos no painel.
- A Ficha do serviço usar a mesma função dos módulos (hoje cada uma calcula do seu jeito).
- Foto mensal guardada, PDF, alertas e indicadores por serviço.
- Painel para coordenações ou Leitura (hoje só Diretoria, por decisão).

## Frentes

- **Regras e dados:** capacidade `src/capacidades/indicadores/`, função `indicadoresDaPlataforma` nos três
  módulos, composição em `src/plataforma/indicadores.ts`, permissão nova e testes (habilidade `regras-e-dados`).
- **Telas:** `/indicadores`, item no menu, gráficos (habilidades `telas` e `graficos`).
- **Infraestrutura:** nenhuma (sem chave nem planilha nova).
- **Mudanças fora de módulo (exigem aprovação deste PR):** capacidade nova, `src/plataforma/`, Núcleo
  (`PERMISSOES_INICIAIS`, menu), `src/ui/icones.tsx` e o `index.ts` dos três apps (Orçamento, Requisições,
  Comunicação), que só **ganham** uma função exportada, sem mudar o cálculo.

## Entregas

Uma entrega só, construída nesta ordem dentro do plano: (1) molde e permissão, (2) Requisições,
(3) Comunicação, (4) Orçamento. Se ficar grande, o Desenvolvedor propõe dividir em sub-issues da #57.

## Critérios de pronto

Na prévia, entrando como Diretoria fictícia: o item "Indicadores" aparece e abre o painel com os três blocos;
o número de cada bloco é igual ao da tela do app; mudar o ano troca as séries; com outro perfil o item some e
o endereço direto mostra "sem permissão"; cada gráfico tem tabela; o mês corrente aparece como "até hoje".
