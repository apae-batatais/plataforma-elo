# ADR-012 · Várias Apaes no mesmo Elo, com uma operadora independente

- Situação: proposta (aguarda aprovação da Diretoria)
- Data: 2026-10-29 (revista em 2026-10-30)
- Complementa: ADR-011 (camada de aplicação e planilhas)

## Contexto
O Elo nasceu na Apae Batatais e será oferecido a outras Apaes e entidades. Cada
uma tem o próprio domínio (apaebatatais.org.br, apaefranca.org.br…), o próprio
Google Workspace e quer os dados no próprio Drive. A Diretoria decidiu:

1. **Um sistema só** (29/10/2026): uma publicação atende todas; uma atualização vale para todas.
2. **Entrada só com e-mail do domínio** da instituição (29/10/2026).
3. **Propriedade transferível** (30/10/2026): no futuro, o Elo passa a pertencer a
   uma empresa. A Apae Batatais deixa de ser dona e vira **uma instituição usuária
   como as outras**.

Por isso, quem opera o Elo é um papel próprio, a **Operadora**, separado de
qualquer instituição usuária. Hoje a Operadora é a Apae Batatais; depois da
transferência, é a empresa. Trocar a Operadora não muda nada para as instituições.

## Decisão
```
                     Operadora do Elo (hoje Apae Batatais; depois, a empresa)
                     código, publicação, Google Cloud, cadastro da Rede
                                         │
elo.apaebatatais.org.br ─┐               ▼               ┌─► Drive da Apae Batatais
elo.apaefranca.org.br   ─┼─►  Elo (um site, uma versão) ─┼─► Drive da Apae Franca
elo.<entidade>.org.br   ─┘    descobre a instituição    └─► Drive de cada instituição
                              pelo endereço
```
- **Operadora**: dona do código (GitHub), da publicação (Netlify), do projeto
  Google Cloud (conta de serviço e login OAuth), da marca Elo e da planilha
  central `rede`. Tudo isso fica em contas **da Operadora**, nunca em contas de
  uma instituição usuária, para que a transferência seja só uma troca de dono.
- **Instituições**: cada Apae ou entidade é uma instituição usuária, inclusive a
  Apae Batatais. Os dados ficam no Drive dela; ela é a controladora (LGPD).
- **Endereço**: cada instituição acessa por um endereço do próprio domínio,
  sugerido `elo.<domínio>` (CNAME para o site; *domain alias* na Netlify, HTTPS
  automático; recomendação da Netlify: até 50 endereços por site). A Operadora
  tem um endereço próprio para a administração da rede (ex.: `rede.<domínio da
  operadora>`), que não dá acesso aos dados de nenhuma instituição.
- **Cadastro da Rede**: planilha `rede`, no Drive da Operadora, aba
  `Instituicoes`: código, nome, razão social, domínio de e-mail, endereços,
  situação (em preparação, ativa, suspensa), IDs das planilhas e administradores
  iniciais. Perfil **Administração da rede**, que existe só na Operadora, com a
  tela *Rede › Instituições* para cadastrar, conferir, suspender e reativar.
- **Descoberta**: a cada requisição, o servidor acha a instituição pelo
  endereço. Endereço desconhecido ou instituição suspensa: página explicando,
  sem dados. O cadastro da Rede fica em memória por alguns minutos.
- **Dados isolados**: um armazenamento por instituição; nenhuma tela ou caso de
  uso recebe planilhas de outra (teste automático). "Preparar estrutura",
  acessos e auditoria funcionam por instituição.
- **Login**: um cliente OAuth do Google, da Operadora; cada endereço novo entra
  nas "Origens JavaScript autorizadas". O servidor confere que o domínio do
  e-mail é o da instituição do endereço; a sessão leva o código da instituição e
  não vale em outra.
- **Sem nada fixo de uma instituição no código**: nome, domínio, unidades e
  áreas iniciais vêm do cadastro de cada instituição. Hoje há valores da Apae
  Batatais no código (domínio padrão, unidade "Apae Batatais (Sede)", títulos):
  a entrega R1 os move para o cadastro.
- **Compatibilidade**: sem a planilha `rede`, o Elo segue com uma instituição só
  (variáveis `DOMINIO` e `PLANILHAS`). A Apae Batatais migra sem parar.

## Transferência para a empresa (quando acontecer)
Como tudo da Operadora fica em contas próprias, a transferência é uma troca de
dono, sem mexer nos dados das instituições:

| O que | Como transfere |
| --- | --- |
| Código | Transferir a organização ou o repositório do GitHub |
| Publicação | Transferir o site da Netlify para a equipe da empresa |
| Google Cloud | Transferir o projeto (conta de serviço e cliente OAuth) |
| Planilha `rede` | Transferir a propriedade no Drive |
| Marca e domínio da rede | Registro da marca Elo e domínio em nome da empresa |
| Contratos | Termos de adesão passam a ter a empresa como operadora (LGPD) |

Os dados de cada instituição continuam no Drive dela; só o compartilhamento com
a conta de serviço segue valendo. A Apae Batatais passa a ter um termo de adesão
como as demais.

## Consequências
- **LGPD**: cada instituição é controladora; a Operadora é operadora. Antes da
  primeira instituição nova: termo de adesão com obrigações de operador, e a
  transferência internacional (funções nos EUA) registrada. Na transferência, a
  empresa assume o papel de operadora nos termos.
- **Custo**: plano pago da Netlify e acompanhamento da cota do Google ficam com
  a Operadora, com rateio ou mensalidade definidos no termo de adesão.
- **Atualização única**: mudanças de estrutura pedem "Preparar estrutura" em
  cada instituição; a tela da Rede mostra quais faltam (já existe o aviso por
  instituição desde o PR #21).
- **Suporte**: a Administração da rede vê cadastro e situação técnica de cada
  instituição, nunca pessoas, folha ou orçamento. A Apae Batatais, como
  instituição, perde esse acesso de operadora quando a transferência acontecer.
