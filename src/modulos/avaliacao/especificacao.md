# Especificação — Módulo Avaliação Diagnóstica

- Situação: entrega 1 aprovada em 06/11/2026 pela Diretoria (questionário e painel validados no protótipo)
- Dono do produto: Diretoria

## Objetivo

A equipe técnica da Assistência Social aplica o questionário diagnóstico das pessoas atendidas
direto no Elo, e a Diretoria e as coordenações acompanham os indicadores por serviço atual,
sem planilha intermediária e sem identificar ninguém nos números.

## Entregas

1. **Questionário diagnóstico e painel por serviço atual** — esta entrega.
2. Próximas (a combinar): ciclos de avaliação e comparação entre ciclos; ligação com o Cadastro
   Único de Pessoas; uso do motor de avaliação (ADR-006) para instrumentos com escala.

## Usuários e permissões

| Perfil                                           | Pode                                                                             | Permissão                                                             |
| ------------------------------------------------ | -------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Diretoria                                        | Aplicar, abrir e corrigir avaliações de todos os serviços; ver o painel de todos | `avaliacao.acessar`, `avaliacao.avaliar`, `avaliacao.painel` (global) |
| Coordenação de serviço                           | O mesmo, só nos serviços do seu escopo (serviço, área ou unidade)                | as três, no escopo                                                    |
| Técnico avaliador                                | O mesmo, só nos serviços do seu escopo                                           | as três, no escopo                                                    |
| Leitura (Conselho)                               | Só o painel, com números agregados                                               | `avaliacao.acessar`, `avaliacao.painel`                               |
| Administração da plataforma, Financeiro e demais | Nada neste módulo (não veem atendidos)                                           | —                                                                     |

## Entidades (planilha própria `avaliacao_assistencia`)

| Aba        | O que guarda                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Sigilo                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Avaliacoes | Iniciais, nascimento, sexo, prontuário (opcional), serviço atual (código e nome no dia), data da avaliação, evolução da pessoa e da família, principal cuidador, BPC, mãe solo, rede de apoio, cuidador idoso, mais de 1 PcD no núcleo, adultos acima de 30, isolamento, apoio de enfermagem, graus de deficiência e de dependência, ostomia (e qual), transporte, barreiras (códigos), observações, profissional, registro profissional, motivo da retirada | pessoal: identificação e cuidador; sensível: saúde, dependência, família, barreiras e observações |

A planilha é separada das demais porque guarda dados sensíveis de atendidos (ADR-011). O índice
de necessidade de cuidado não é guardado: a camada de aplicação calcula a cada leitura.

## Regras de negócio (com teste)

1. Identificação só por iniciais (2 a 8 letras, guardadas em maiúsculas), data de nascimento e
   sexo. O nome completo não é pedido. Prontuário é opcional.
2. Todas as perguntas são obrigatórias, menos prontuário e registro técnico. Ostomia "Sim" pede qual.
3. Barreiras: ao menos uma, ou "Nenhum dos itens" (que desmarca as demais). Abandono familiar,
   apropriação de rendimentos e as suspeitas de violência física, psicológica e sexual contam
   como **suspeita de violação de direitos** (aviso para seguir o fluxo de notificação e o CREAS).
4. A data da avaliação não pode ser futura; o nascimento precisa dar idade entre 0 e 129 anos na
   data da avaliação.
5. Serviço atual: qualquer serviço ativo do Núcleo em que a pessoa avalia (escopo). Na correção,
   é preciso avaliar também no serviço anterior.
6. **Índice de necessidade de cuidado (0 a 12)**: grau de dependência II = 1 e III = 2; soma 1 cada
   um destes: isolamento, sobrecarga do cuidador, ausência de apoio adequado, sem rede de apoio,
   cuidador idoso, mãe solo, pessoa regrediu, família regrediu, suspeita de violação de direitos,
   cuidados de saúde (enfermagem ou ostomia). Mesmo cálculo do painel dos Novos Serviços 2027.
7. Correção grava só com a versão lida (outra pessoa alterou → aviso, nada é sobrescrito).
8. Nada é apagado: "Retirar avaliação" pede motivo, deixa `ativo = FALSE` e tira da lista e do painel.
9. Auditoria: inclusão; leitura ao abrir uma avaliação; exportação ao abrir a ficha para imprimir;
   alteração com as colunas (nunca os valores); encerramento na retirada.
10. O painel mostra só números agregados das avaliações ativas dos serviços em que a pessoa tem
    `avaliacao.painel`; nenhuma iniciais, data ou prontuário sai no painel.

## Telas

1. **Avaliações** (`/avaliacao`): lista das avaliações dos serviços do escopo, da mais recente
   para a mais antiga (iniciais · nascimento · sexo · idade, serviço, índice, grau, data, marca de
   violação), filtro por iniciais e por serviço. Quem só tem painel vai direto para o painel.
2. **Nova avaliação** (`/avaliacao/nova`): o questionário em uma tela, em três colunas no
   computador (identificação e evolução; família e cuidado; deficiência, dependência e saúde),
   barreiras e registro técnico embaixo. Mostra a idade, a definição do grau de dependência
   (RDC Anvisa 502/2021) e o índice enquanto a pessoa responde; o que faltar fica em vermelho.
3. **Avaliação** (`/avaliacao/<id>`): o mesmo questionário preenchido para corrigir, e "Retirar
   avaliação" com motivo.
4. **Painel** (`/avaliacao/painel`): filtro por mês da avaliação; cartões (pessoas avaliadas,
   índice médio, dependência grau III, regrediram, suspeitas de violação); índice por serviço
   (cada ponto uma pessoa, com mediana); indicadores por serviço (tabela de calor, com coluna
   Todos); grau de dependência por serviço; evolução da pessoa e da família. Cada gráfico tem
   "Ver os números".

5. **Ficha para imprimir** (`/avaliacao/<id>/ficha`): folha A4 branca (também no tema escuro) com
   identificação, todas as respostas, barreiras marcadas, índice com os fatores, registro técnico,
   campo de assinatura e aviso de sigilo. "Imprimir ou salvar em PDF" usa a janela do navegador.
6. **Painel para imprimir** (`/avaliacao/painel/imprimir`, com o mesmo período): cartões e os
   quatro gráficos em uma coluna, cada um com a tabela de números aberta. Nenhum quadro é cortado
   na troca de página (se não couber, começa na página seguinte) e as cores saem no papel.

## Eventos

Nenhum nesta entrega.

## Indicadores

| Código                         | Cálculo                                                         | Referência |
| ------------------------------ | --------------------------------------------------------------- | ---------- |
| avaliacao_indice_medio_cuidado | Média do índice de necessidade de cuidado das avaliações ativas | —          |

## Critérios de pronto

- [x] Regras de negócio com testes
- [x] Testes de acesso (quem avalia, quem só vê o painel, quem não vê nada)
- [x] `npm run verificar` verde
- [ ] Conferido pela Diretoria na prévia com dados fictícios
