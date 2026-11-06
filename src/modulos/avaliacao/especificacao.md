# Especificação — Módulo Avaliação de Serviços Sociais

- Situação: entrega 1 aprovada em 06/11/2026 pela Diretoria (formulário e painel validados no protótipo e na prévia)
- Dono do produto: Diretoria
- Nome: era "Avaliação Diagnóstica" até 06/11/2026; a rota continua `/avaliacao`.

## Objetivo

A equipe técnica da Assistência Social avalia cada pessoa atendida **quando ela é encaminhada ao
serviço (avaliação inicial)** e **uma vez por ano (acompanhamento anual)**, direto no Elo. Com as
avaliações da mesma pessoa lado a lado, a equipe vê se está havendo evolução na qualidade de vida;
a Diretoria e as coordenações acompanham os indicadores por serviço atual, sem identificar ninguém.

## Base técnica e legal

Cada grupo de perguntas tem fundamento em norma federal (LOAS, Tipificação Nacional — Resolução
CNAS 109/2009, NOB-SUAS 2012, LBI, Estatuto da Pessoa Idosa, RDC Anvisa 502/2021 e LGPD). O
quadro completo está em `dominio/fundamentos.ts` e na tela **Sobre o instrumento**. A periodicidade
anual e o índice de necessidade de cuidado são decisões técnicas da instituição, escritas como tal.

## Entregas

1. **Avaliação inicial e anual, comparativo da pessoa, painel por serviço atual, impressão e
   fundamento legal** — esta entrega.
2. Próximas (a combinar): ligação com o Cadastro Único de Pessoas (`pessoa_id`); uso do motor de
   avaliação (ADR-006) para instrumentos com escala.

## Usuários e permissões

| Perfil                                           | Pode                                                                                      | Permissão                                                             |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Diretoria                                        | Avaliar, abrir, corrigir, imprimir e comparar em todos os serviços; ver o painel de todos | `avaliacao.acessar`, `avaliacao.avaliar`, `avaliacao.painel` (global) |
| Coordenação de serviço                           | O mesmo, só nos serviços do seu escopo (serviço, área ou unidade)                         | as três, no escopo                                                    |
| Técnico avaliador                                | O mesmo, só nos serviços do seu escopo                                                    | as três, no escopo                                                    |
| Leitura (Conselho)                               | Só o painel, com números agregados, e a tela Sobre o instrumento                          | `avaliacao.acessar`, `avaliacao.painel`                               |
| Administração da plataforma, Financeiro e demais | Nada neste módulo (não veem atendidos)                                                    | —                                                                     |

## Entidades (planilha própria `avaliacao_assistencia`)

| Aba        | O que guarda                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Sigilo                                                                                            |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Avaliacoes | Tipo (inicial ou acompanhamento anual), iniciais, nascimento, sexo, prontuário (opcional), serviço atual (código e nome no dia), data da avaliação, evolução da pessoa e da família, principal cuidador, BPC, mãe solo, rede de apoio, cuidador idoso, mais de 1 PcD no núcleo, adultos acima de 30, isolamento, apoio de enfermagem, graus de deficiência e de dependência, ostomia (e qual), transporte, barreiras (códigos), observações, profissional, registro profissional, motivo da retirada | pessoal: identificação e cuidador; sensível: saúde, dependência, família, barreiras e observações |

A planilha é separada das demais porque guarda dados sensíveis de atendidos (ADR-011). O índice
de necessidade de cuidado não é guardado: a camada de aplicação calcula a cada leitura. Linhas
gravadas antes da coluna `tipo` contam como avaliação inicial.

## Regras de negócio (com teste)

1. Identificação só por iniciais (2 a 8 letras, guardadas em maiúsculas), data de nascimento e
   sexo. O nome completo não é pedido. Prontuário é opcional.
2. Tipo de avaliação obrigatório: **Inicial** (entrada no serviço) ou **Acompanhamento anual**.
3. Todas as perguntas são obrigatórias, menos prontuário e registro técnico. Ostomia "Sim" pede qual.
4. Barreiras: ao menos uma, ou "Nenhum dos itens" (que desmarca as demais). Abandono familiar,
   apropriação de rendimentos e as suspeitas de violência física, psicológica e sexual contam
   como **suspeita de violação de direitos** (aviso para seguir o fluxo de notificação e o CREAS).
5. A data da avaliação não pode ser futura; o nascimento precisa dar idade entre 0 e 129 anos.
6. Serviço atual: qualquer serviço ativo do Núcleo em que a pessoa avalia (escopo). Na correção,
   é preciso avaliar também no serviço anterior.
7. **Índice de necessidade de cuidado (0 a 12)**: grau de dependência II = 1 e III = 2; soma 1 cada
   um destes: isolamento, sobrecarga do cuidador, ausência de apoio adequado, sem rede de apoio,
   cuidador idoso, mãe solo, pessoa regrediu, família regrediu, suspeita de violação de direitos,
   cuidados de saúde (enfermagem ou ostomia). Mesmo cálculo do painel dos Novos Serviços 2027.
8. **Mesma pessoa** = mesmas iniciais, data de nascimento e sexo.
9. **Reavaliação anual**: vence 12 meses depois da avaliação mais recente da pessoa; "vence em
   breve" a partir de 30 dias antes; "atrasada" depois do vencimento.
10. **Comparativo**: avaliações da mesma pessoa nos serviços em que quem consulta avalia, da mais
    antiga para a mais recente; tendência da primeira para a última (índice menor = melhorou) e,
    item a item, o que melhorou ou piorou (perguntas descritivas, como BPC, sem tendência).
11. Correção grava só com a versão lida (outra pessoa alterou → aviso, nada é sobrescrito).
12. Nada é apagado: "Retirar avaliação" pede motivo, deixa `ativo = FALSE` e tira da lista e do painel.
13. Auditoria: inclusão; leitura ao abrir uma avaliação e ao abrir o comparativo; exportação ao
    abrir a ficha para imprimir; alteração com as colunas (nunca os valores); encerramento na retirada.
14. **Painel**: só números agregados das avaliações ativas dos serviços com `avaliacao.painel`.
    Retrato atual: cada pessoa conta uma vez, pela avaliação mais recente do período. Evolução
    entre avaliações: pessoas com duas ou mais, comparando a primeira e a última.

## Telas

1. **Avaliações** (`/avaliacao`): lista com tipo, índice, grau, violação e próxima avaliação
   (em dia, vence em breve, atrasada); cartões de reavaliações atrasadas e vencendo; filtros por
   iniciais, serviço e visão (todas, só a mais recente de cada pessoa, atrasadas, vencendo);
   ações Abrir, Ficha, Comparar (com 2+ avaliações) e Reavaliar.
2. **Nova avaliação** (`/avaliacao/nova`): o formulário em uma tela, em três colunas no computador.
   Com `?de=<avaliação>`, vira **Acompanhamento anual** com identificação, serviço e cuidador já
   preenchidos.
3. **Avaliação** (`/avaliacao/<id>`): corrigir, comparativo, imprimir ficha e retirar com motivo.
4. **Comparativo da pessoa** (`/avaliacao/<id>/comparativo`): cartões (avaliações, índice na
   primeira e na última, próxima avaliação), resumo da tendência, barras do índice por avaliação e
   tabela pergunta a pergunta; pronto para imprimir.
5. **Ficha para imprimir** (`/avaliacao/<id>/ficha`): folha A4 com tipo, próxima avaliação, todas
   as respostas, índice, assinatura e aviso de sigilo.
6. **Painel** (`/avaliacao/painel`): filtros de serviço e período; seis cartões; quatro partes —
   necessidade de cuidado (índice por pessoa com mediana; indicadores), evolução (entre avaliações
   da mesma pessoa; percebida pela equipe), dependência e transporte, análise por sexo (pirâmide
   por geração; indicadores entre mulheres e homens). Cada gráfico com "Ver os números".
7. **Painel para imprimir** (`/avaliacao/painel/imprimir`): o painel inteiro em uma coluna, com as
   tabelas abertas, cores no papel e nenhum quadro cortado na troca de página.
8. **Sobre o instrumento** (`/avaliacao/sobre`): quando avaliar, fundamento de cada grupo de
   perguntas, normas de referência, graus de dependência, cálculo do índice e decisões técnicas.

## Eventos

Nenhum nesta entrega.

## Indicadores

| Código                         | Cálculo                                                                            | Referência |
| ------------------------------ | ---------------------------------------------------------------------------------- | ---------- |
| avaliacao_indice_medio_cuidado | Média do índice de necessidade de cuidado na avaliação mais recente de cada pessoa | —          |

## Critérios de pronto

- [x] Regras de negócio com testes
- [x] Testes de acesso (quem avalia, quem só vê o painel, quem não vê nada)
- [x] `npm run verificar` verde
- [ ] Conferido pela Diretoria na prévia com dados fictícios
