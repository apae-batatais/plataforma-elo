# ADR-018 · Uma pasta por instituição: o Elo cria as próprias planilhas

- Situação: proposta (aguarda aprovação da Diretoria)
- Data: 2026-11-07
- Complementa: ADR-011 (planilhas), ADR-012 (várias Apaes) e ADR-014 (anexos no Drive)

## Contexto

Hoje cada instituição cria à mão até sete planilhas (Núcleo, Auditoria, Orçamento, Folha,
Requisições, Avaliação de Serviços Sociais, Comunicação) e a pasta de anexos, compartilha cada uma
com a conta de serviço, e a Administração da rede cola os IDs no cadastro. Cada app novo exige
repetir o processo em todas as instituições. A Diretoria quer informar só o link de uma pasta.

## Decisão

- O cadastro da instituição passa a ter **um campo só: o link da pasta** num Drive compartilhado
  da instituição ("Elo · <instituição>"), onde a conta de serviço é Gerente de conteúdo.
- **Um Drive compartilhado por instituição, com membros restritos** (decisão da Diretoria,
  07/11/2026): a conta de serviço e uma ou duas pessoas da TI ou da Diretoria. A equipe usa só o
  Elo. Assim a planilha sensível (Avaliação) fica no mesmo drive sem ficar visível à equipe.
- **"Preparar estrutura" cria o que falta**: as planilhas do Núcleo e dos apps ativos e a pasta de
  anexos, dentro da pasta informada, e grava os IDs no cadastro. Depois cria as abas, como hoje.
- O Elo continua achando cada planilha **pelo ID**. Cada planilha criada recebe uma marca invisível
  (propriedade de app do Drive com a chave da planilha), para nunca criar duplicata, mesmo que o
  arquivo seja renomeado.
- A planilha nasce direto no Drive compartilhado porque a conta de serviço não tem espaço próprio
  no Drive. A área da Rede passa a usar a permissão de Drive, além da de planilhas.
- Nada é apagado: o Elo nunca apaga nem move planilha.

## Consequências

- Trazer uma instituição nova passa a ter um passo de Drive só: criar o drive, incluir a conta de
  serviço e enviar o link.
- App novo: o próximo "Preparar estrutura" (ou "de todas") cria a planilha dele em cada instituição.
- Instituições já cadastradas (Apae Batatais) mantêm as planilhas atuais; basta informar a pasta.
- Quem é membro do Drive compartilhado vê todas as planilhas. A restrição de membros é
  responsabilidade da instituição e entra no guia e no termo de adesão (R3).
