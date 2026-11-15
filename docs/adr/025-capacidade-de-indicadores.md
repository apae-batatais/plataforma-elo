# ADR-025 — Capacidade de Indicadores e painel da Diretoria pela composição

- Situação: proposta (15/11/2026), a aprovar com a especificação da issue #57
- Data: 15/11/2026

## Contexto
Cada app calcula e mostra os seus indicadores (Orçamento, Requisições, Comunicação), e os manifestos só
listam os nomes em `indicadores`. A pasta `src/capacidades/indicadores/` está vazia. A Diretoria quer um
painel único, só para ela, separado da Ficha do serviço. A regra 3 proíbe um módulo de importar outro, e a
capacidade não pode depender de módulos (`src/capacidades/README.md`). A ADR-024 já resolveu o mesmo
problema para a agenda e a busca.

## Decisão
- A **capacidade** (`src/capacidades/indicadores/`) só define o **molde**: tipos (`DefinicaoDeIndicador`,
  `PontoDeIndicador`, `IndicadorCalculado`), a regra de situação (dentro ou fora da referência) e o
  formato dos valores. Ela não lê planilha nem conhece app.
- Cada módulo continua **dono da conta** dos seus indicadores. Ele exporta no `index.ts`
  `indicadoresDaPlataforma(p, quem, periodo)`, que devolve `IndicadorCalculado[]` reaproveitando as funções
  que a tela do próprio app já usa. Nenhum app recalcula nada: o painel e a tela do app mostram o mesmo
  número porque vêm da mesma função. O `id` de cada indicador é um dos nomes já listados em
  `manifesto.indicadores`; um teste confere que o módulo não devolve id fora do manifesto.
- A plataforma (`src/plataforma/indicadores.ts`) chama as funções dos módulos ativos (lista própria, como
  `fontes-agenda-busca.ts`), junta e entrega à rota `/indicadores`.
- Quem decide o acesso a cada indicador é o próprio módulo (o `Autorizador` do app). Além disso, o painel
  exige a permissão nova `plataforma.indicadores.ver`, só do perfil Diretoria.
- Falha de um app não derruba o painel: ele fica de fora com o aviso "Não foi possível ler: <app>".
- Leitura na hora, sem cópia nem tabela de indicadores. Se ficar lento, vale a ADR-017 e não um índice
  paralelo (mesmo critério da ADR-024).

## Consequências
- Um app novo entra no painel exportando a função e sendo listado na composição.
- Cada módulo é testado sozinho (quem vê, quem não vê); a plataforma é testada com módulos falsos.
- A Ficha do serviço pode passar a usar a mesma função quando a Diretoria pedir (fica no roadmap).
- Custo: cada abertura do painel lê as abas de três apps; se bater no limite da API do Google, o painel
  lê por app só ao abrir a seção.
