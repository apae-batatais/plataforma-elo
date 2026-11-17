# ADR-032 · Repositório público

- Situação: aceita
- Data: 2026-11-17
- Complementa: ADR-019 (desenvolvimento automatizado pelo GitHub) e ADR-031 (capacidade da esteira)
- Relaciona-se com: ADR-017 (o Elo será comercializado)

## Contexto

Em 16/11/2026 a cota gratuita de minutos do GitHub Actions acabou e toda a esteira parou até 01/12
(ADR-031). Em repositório público, o GitHub Actions não consome cota. A Diretoria tornou o
repositório `plataforma-elo` público em 17/11/2026.

## Decisão

O repositório é público. Código, histórico de commits, issues, PRs, comentários e anexos ficam
visíveis para qualquer pessoa. Continuam privados: os Secrets e variáveis do repositório, as
planilhas e o Drive da instituição, a Netlify e o site oficial.

Cuidados adotados pelo DevOps (17/11/2026):
- Issue aberta por quem não é a Diretoria não aciona o Arquiteto nem vira proposta no Fluxo (os
  demais agentes e a Aprovação já só aceitam a conta da Diretoria).
- PR de cópia externa (fork) não recebe Secrets, não ganha prévia e não entra na atualização
  automática nem no merge (já era assim).
- Varredura do histórico: nenhuma chave real encontrada (só uma chave fictícia de teste). E-mails
  com o domínio real da instituição nos testes foram trocados por domínios fictícios; versões
  antigas continuam no histórico.

## Consequências

- A esteira volta a rodar sem limite de minutos; a fila de construção (ADR-031) continua valendo
  pelo uso da assinatura do Claude e pela capacidade de revisão da Diretoria, e o raio-x de consumo
  deixa de ser trava enquanto o repositório for público.
- **Dados reais nunca entram no repositório nem em comentários e anexos de issues e PRs** (regra 9
  do `CLAUDE.md`, agora com exposição pública). Anexo já publicado num comentário continua
  acessível pelo link, mesmo apagando o comentário.
- Sem arquivo de licença, o código fica visível mas sem permissão de uso por terceiros (todos os
  direitos reservados). Escolher uma licença é decisão da Diretoria, ligada à comercialização
  (ADR-017).
- Qualquer pessoa pode abrir issues e PRs; a Diretoria pode limitar isso nas configurações do
  repositório (interações e aprovação de workflows de forks).
- Voltar a privado é possível a qualquer momento; aí a cota de minutos volta a valer (ADR-031).
