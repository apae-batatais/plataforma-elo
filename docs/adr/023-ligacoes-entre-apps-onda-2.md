# ADR-023 — Ligações entre apps, onda 2: escrita pela plataforma, números de pessoas protegidos e permissão de cada app

- Situação: aceita (especificação aprovada em 14/11/2026); decisões 2 e 3 construídas na entrega L1
- Data: 14/11/2026
- Proposta de origem: issue #116 (onda 2 de 3). Estende a ADR-013 e se apoia nas ADRs 011, 020, 021 e 022 (onda 1).

## Contexto
A ADR-013 define ligações **só de leitura**, sem permissão própria e só com nomes de cadastro; a ADR-020
abriu uma exceção para valores de termo (não pessoais). A onda 2 precisa de três coisas novas:
1. um app **pedir a criação** de um registro em outro (rascunho do termo, a partir do Projetos);
2. levar **números calculados de pessoas** (cadastro e Avaliação) a indicadores e metas, sem expor ninguém;
3. mostrar, num app, dados de outro que têm **permissão própria** (termo, resultado do Orçamento).

## Decisão
1. **Escrita entre apps pela plataforma, com uma função por ação.** O app que pede declara uma interface
   pequena (`CatalogoParcerias.criarRascunhoDeTermo`); o app que oferece exporta a função no `index.ts`; a
   plataforma liga os dois (`src/plataforma/catalogos.ts`). Nenhum módulo importa outro. A função de escrita é
   **idempotente** (chave: projeto de origem), é a **única porta** para aquele registro (nenhuma tela do app dono
   o cria), grava auditoria no app dono com o e-mail de quem agiu e a origem, e usa `inserir`/`atualizar`
   normais. Falha do app dono **não desfaz** a decisão do app que pediu: devolve erro tratado, e o pedido pode ser
   repetido. Cada nova escrita entre apps exige ADR ou atualização desta.
2. **Números de pessoas só como agregado protegido.** O Núcleo exporta uma função pura, `numeroAgregado({ valor,
   base })`, com **mínimo de 5 pessoas** (decisão da Diretoria, 13/11/2026): base de 1 a 4 devolve `valor` vazio e
   `motivo = poucos_casos`; base 0 devolve contagem 0 ou `sem_dados` (média e percentual). A regra é aplicada **na
   origem** (contagem de vínculos no Núcleo; índice médio e reavaliação em dia na Avaliação), nunca no app que
   consome. A resposta tem só `valor`, `base` e `motivo`: sem iniciais, nascimento, ids de pessoa ou de avaliação.
   Só existem os três números aprovados (vínculos ativos, índice médio de necessidade de cuidado, % de
   reavaliação em dia); incluir outro exige nova decisão da Diretoria. Essa leitura é sem permissão própria
   e sem auditoria de leitura individual (não há registro individual), como `termosParaOrcamento`.
3. **Dado com permissão própria continua com ela.** Leituras de termo (`termoParaProjeto`) e do resultado do
   Orçamento (`resultadoDoProjeto`) recebem o contexto de quem consulta e passam pelo `Autorizador` do app dono;
   sem permissão, devolvem "sem permissão" e o app consumidor mostra só o vínculo (nome copiado). Isto vale
   **além** da exceção da ADR-020, que continua só para `termosParaOrcamento` (leitura do Orçamento, sem permissão).
4. **Rascunho de termo é um estado de Parcerias** e fica fora de qualquer cálculo ou catálogo que alimente outro
   app (`termosParaOrcamento` ignora rascunhos).
5. **App ausente vira "ligação indisponível"**, nunca erro (como na ADR-021, decisão 5).

## Consequências
- Projetos funciona e é testado com catálogos falsos, sem Parcerias, Avaliação nem Orçamento.
- O mínimo de 5 não protege contra diferença entre duas leituras próximas (uma pessoa entra e a média muda). O
  risco é aceito: os números são do estado de hoje, e as fotografias gravadas só entram em relatórios internos.
  Se a Diretoria quiser mais proteção (arredondar, faixas), é uma ADR nova.
- Mudar o limite de 5 mexe em uma constante do Núcleo e nos testes (decisão da Diretoria).
- Cada nova ligação com escrita ou com número de pessoas passa pela revisão desta ADR.
- Para cada OSC: colunas e abas novas por "Preparar estrutura"; nenhuma chave nova em `PLANILHAS`.
