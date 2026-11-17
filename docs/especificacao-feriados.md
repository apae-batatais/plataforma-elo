# Especificação · Feriados no Núcleo (issue #67)

Especificada em 17 de novembro de 2026 · Decisão de arquitetura: ADR-034 · App: plataforma

## Objetivo e para quem

Ter **uma lista de feriados só**, no Núcleo, que vale para todos os apps. Hoje ela existe só na
Requisições (prazos de atendimento); a Comunicação conta a antecedência mínima ignorando feriados,
então um pedido pode ficar "fora da urgência" por causa de um feriado no meio. Para quem cadastra:
a Administração da plataforma. Para quem sente o efeito: quem faz pedidos na Comunicação e quem
acompanha prazos na Requisições.

## Usuários e permissões

| Quem | O que pode | Permissão |
| --- | --- | --- |
| Administração da plataforma (só ela) | Incluir, incluir os nacionais de um ano e tirar feriado | `core.feriados.gerenciar` (nova) |
| Demais perfis | Não veem a lista; sentem o efeito nos prazos | — |

A permissão `requisicoes.tipos.gerenciar` deixa de ser exigida para feriados (continua para tipos,
itens e expediente).

## Entidades

- **`Feriados`** (planilha `nucleo`, nova, registrada em "Preparar estrutura"): `data` (AAAA-MM-DD),
  `nome`. Sem coluna sensível. Encerrar = `ativo = FALSE`.
- A aba `Feriados` de `FeriadosRequisicoes` fica como está, só para consulta, depois da migração.
  O módulo deixa de gravar nela.

## Regras de negócio (com teste)

1. Só quem tem `core.feriados.gerenciar` inclui ou tira feriado; os demais perfis recebem erro de
   permissão (teste: administração pode, diretoria, coordenação e leitura não).
2. Uma data só uma vez entre os feriados ativos; tentar repetir diz a data e o nome já cadastrado.
   Data inválida ou nome vazio é recusado com mensagem.
3. "Incluir feriados nacionais" de um ano inclui os nacionais mais o de São Paulo (9 de julho) que
   ainda não estão cadastrados e informa quantos entraram. Resultado idêntico ao de hoje (teste
   com 2026 e Páscoa).
4. Tirar feriado encerra o registro (`ativo = FALSE`), usa a versão lida e registra auditoria com
   as colunas alteradas (nunca os valores). Incluir registra auditoria de inclusão.
5. `feriadosAtivos(p)` devolve o conjunto de datas dos feriados ativos; é a única fonte para
   os apps. A leitura para as contas de prazo não é "leitura individual de dado sensível": sem
   auditoria de leitura.
6. **Comunicação**: `somarDiasUteis`, `diasUteisEntre` e `ehUrgente` passam a receber o conjunto
   de feriados e pulam essas datas além de sábado e domingo. A urgência é calculada no envio e
   recalculada no reenvio, como hoje, com os feriados vigentes naquele momento. Teste: com feriado
   numa quarta, 2 dias úteis a partir de segunda terminam na sexta; pedido que seria normal vira
   urgente por causa do feriado.
7. **Requisições**: o SLA lê os feriados do Núcleo (`feriadosAtivos`) em vez da aba própria. O
   painel e o contador de feriados no período usam a mesma lista. Os testes atuais de SLA com
   feriado continuam verdes; some um teste de que um feriado incluído no Núcleo muda o prazo.
8. **Migração** ("Preparar estrutura"): copia as datas ativas da aba antiga da Requisições para o
   Núcleo, sem repetir data (rodar duas vezes não duplica) e sem apagar a origem. Só roda quando o
   módulo Requisições está ativo. Teste de idempotência.
9. Um módulo nunca importa outro e o Núcleo não importa módulo: a Requisições exporta a leitura da
   aba antiga e a composição (`src/plataforma/`) passa as linhas ao Núcleo. `npm run fronteiras`
   verde.
10. Nada é apagado e nada na planilha calcula: a lista é só armazenamento.

## Telas

**Administração › Feriados** (`/admin/feriados`, item novo no grupo Administração, visível só
com `core.feriados.gerenciar`; a seção de feriados de `/requisicoes/tipos` sai de lá e a tela passa
a ter um aviso com link para a nova).

1. **Quem e o quê:** a Administração mantém a lista. Caminho mais curto: incluir os nacionais do
   ano em 1 clique (campo de ano já com o ano atual); incluir um feriado local em 3 interações
   (data, nome, "Incluir feriado").
2. **Primeira dobra:** título "Feriados", uma frase ("Estes dias não contam como úteis nos prazos
   dos apps: Requisições e Comunicação."), os dois formulários lado a lado (ano + "Incluir feriados
   nacionais"; data + nome + "Incluir feriado") e a tabela. Ação principal: "Incluir feriado".
3. **Componentes de `src/ui/`** (os mesmos da seção de feriados de hoje): `CabecalhoPagina`,
   `Secao`, `Campo`, `BotaoEnviar`, `TabelaDados`, `FormularioConfirmado`. Nenhuma peça nova.
   Lista ordenada por data, com filtro por ano (sugestão: abre no ano atual).
4. **Estados:** vazio: "Nenhum feriado cadastrado: hoje todos os dias de segunda a sexta contam
   como úteis." Gravando: botão "Incluindo…". Gravou: "Feriado incluído." ou "N feriados de AAAA
   incluídos." / "Os feriados nacionais de AAAA já estavam todos cadastrados." Erro: a mensagem da
   regra 2, no alto, com os campos preenchidos mantidos. Sem permissão: a pessoa é levada para o
   início, sem ver a tela.
5. **Formulários:** data (obrigatória, formato do seletor de data) e nome (obrigatório, dica
   "Por exemplo: feriado municipal, ponto facultativo"); rótulos sempre visíveis.
6. **Ação sem volta:** "Tirar feriado" pede confirmação que explica: "Os prazos voltam a contar
   este dia como útil. Pedidos já enviados não são recalculados." (a Requisições recalcula o
   SLA ao abrir; a Comunicação não).
7. **Celular e teclado:** formulários empilham em coluna única; a ordem de tabulação é ano,
   botão dos nacionais, data, nome, botão; tabela rola na horizontal.
8. Sem gráficos.

**Comunicação › Configurações:** a dica de "Dias úteis" passa de "sem feriados nesta fase" para
"Conta de segunda a sexta, sem os feriados cadastrados em Administração › Feriados." (texto sem
nome próprio). **Requisições › Tipos:** seção de feriados troca por um parágrafo com link para
Administração › Feriados (visível a quem gerencia).

**Sugestões para a Diretoria decidir (não estão na proposta):**
- Mostrar na tela do pedido da Comunicação "Prazo conta N dias úteis (feriado em DD/MM)" quando
  um feriado entrou na conta, para a pessoa entender por que é urgente.
- Importar os feriados de vários anos de uma vez (hoje é um ano por vez).

## Fica de fora

- **Feriados na agenda única**: continua para a segunda entrega da agenda (roadmap, issue #117);
  a lista do Núcleo já fica pronta para ela usar.
- Feriados por unidade ou cidade (hoje a lista é uma só para toda a instituição).
- Recalcular a urgência de pedidos já enviados na Comunicação.
- Edição de feriado (corrige-se tirando e incluindo de novo).

## Frentes

- **regras e dados** (Núcleo: aba, casos de uso, permissão, migração; Requisições e Comunicação
  passam a ler do Núcleo; testes).
- **telas** (Administração › Feriados e os dois ajustes de texto/seção).
- Sem infraestrutura.

## Entrega

Uma entrega só (a mudança é pequena e os três lugares precisam andar juntos para a lista não ficar
duplicada). Se o Desenvolvedor julgar grande, corta em: (a) Núcleo + migração + Requisições;
(b) Comunicação.

## Critérios de pronto (na prévia)

1. Entrando como Administração da plataforma, aparece "Feriados" no menu; entrando com outro perfil,
   não aparece e o endereço direto leva ao início.
2. Em "Incluir feriados nacionais" de 2026, a lista mostra os feriados nacionais e o de 9 de julho;
   repetir diz que já estavam cadastrados.
3. Um feriado repetido é recusado com a data e o nome já cadastrado.
4. Na Comunicação, num pedido com data desejada logo depois de um feriado incluído, a urgência
   considera o feriado.
5. Na Requisições, o prazo de uma requisição aberta muda ao incluir um feriado no período.
6. Os feriados que já existiam na Requisições aparecem na nova lista, sem repetir.
7. Tirar um feriado pede confirmação com o texto da seção "Telas".
