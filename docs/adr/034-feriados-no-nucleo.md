# ADR-034 · Feriados no Núcleo

Situação: proposta · Data: 17 de novembro de 2026 · Proposta: #67

## Contexto

O cadastro de feriados nasceu no app Requisições (aba `Feriados` da planilha do módulo) para o
cálculo do SLA em horas úteis. A Comunicação conta a antecedência mínima em dias úteis só de
segunda a sexta, e a agenda única (ADR-024) vai precisar mostrar feriados. Um módulo nunca
importa outro, então a Comunicação não pode ler o cadastro da Requisições.

## Decisão

1. Os feriados passam a ser do **Núcleo**: aba `Feriados` na planilha `nucleo`, declarada com
   `definirTabela`, com colunas `data` e `nome` (não sensíveis). Uma data só pode aparecer uma vez
   entre os feriados ativos.
2. O Núcleo tem o caso de uso do cadastro (incluir, incluir os nacionais de um ano, tirar) e uma
   leitura (`feriadosAtivos`) que devolve o conjunto de datas. Os feriados nacionais e a regra da
   Páscoa saem de `src/modulos/requisicoes/dominio/feriados.ts` para o Núcleo, sem mudar o
   resultado.
3. Os módulos **recebem** o conjunto de datas de feriados lido do Núcleo e o usam em suas contas
   (SLA da Requisições, dias úteis da Comunicação). Nenhum módulo grava feriado.
4. Uma permissão nova do Núcleo, `core.feriados.gerenciar`, concedida ao perfil de Administração
   da plataforma (a mesma regra de quem cadastrava feriados na Requisições).
5. Migração: os feriados já cadastrados na aba `Feriados` da Requisições são copiados para o
   Núcleo por "Preparar estrutura", sem repetir data, e a aba antiga fica só para consulta (nada é
   apagado). A cópia é montada na camada de composição (`src/plataforma/`), para o Núcleo não
   importar módulo.

## Consequências

- Uma única lista vale para todos os apps e para a agenda; mudar um feriado muda todos os prazos.
- Prazos já calculados na Comunicação (urgência) são recalculados só quando o pedido é enviado ou
  reenviado, como já é hoje; não há recálculo retroativo.
- Mexe no Núcleo e em dois módulos (Requisições e Comunicação) de uma vez, por pedido explícito da
  proposta.
- Custo se a decisão estiver errada: voltar a lista para o módulo exige nova migração, mas os
  dados não se perdem (a aba antiga é mantida).
