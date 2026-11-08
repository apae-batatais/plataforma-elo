# ADR-017 · Manter Netlify e Google Planilhas até cerca de 5 clientes; banco relacional depois

- Situação: aceita
- Data: 2026-11-07
- Complementa: ADR-011 (camada de aplicação e planilhas) e ADR-012 (várias Apaes)

## Contexto

O Elo vai ser comercializado para outras organizações. A Diretoria avaliou trocar a hospedagem
(Netlify, Vercel ou outra) e migrar o armazenamento das planilhas para um Postgres gerenciado.
O repositório passou a se chamar `plataforma-elo` na mesma data.

Diretrizes informadas pela Diretoria:

- Orçamento inicial de até R$ 500 por mês para hospedagem e banco.
- Dar preferência a fornecedores com região no Brasil (São Paulo). Os apps guardam dados
  pessoais (folha, Cadastro de Pessoas, quem pede) e dados pseudonimizados de atendidos
  (avaliação por iniciais, nascimento e sexo), que continuam sendo dados pessoais pela LGPD.
- Comparar banco único para todos os clientes com banco por cliente.

Levantamento de 07/11/2026 (preços em dólar, cotação de R$ 5,49 em 05/11/2026):

| Item | Preço | São Paulo |
| --- | --- | --- |
| Netlify Personal / Pro | US$ 9 (1.000 créditos) / US$ 20 (3.000 créditos) | Sim, região das funções `gru` |
| Vercel Pro | US$ 20 + uso | Sim, região `gru1` (padrão `iad1`) |
| Vercel Hobby | Gratuito | Fora: só uso pessoal e não comercial |
| Supabase Pro | US$ 25 por organização + US$ 10 por projeto (US$ 10 de crédito incluso) | Sim, `sa-east-1` |
| Neon Launch | US$ 0,106 por hora de computação + US$ 0,35 por GB-mês, sem mínimo | Sim, `aws-sa-east-1` |

Estimativa mensal com Netlify Pro: banco compartilhado ≈ R$ 250 (Supabase) ou R$ 145 a 220
(Neon); um banco por cliente com 5 clientes ≈ R$ 470 (Supabase) ou R$ 270 (Neon).

A camada de armazenamento (`src/nucleo/armazenamento`, cerca de 850 linhas) já isola os apps das
planilhas, mas tem o formato de planilha (planilha, aba, número da linha). Migrar teria dois
caminhos: trocar só essa camada, ou redesenhar os dados como banco relacional, app por app.

## Decisão

- **Manter a arquitetura da ADR-011** (Next.js na Netlify e Google Planilhas como armazenamento)
  até o Elo ter **cerca de 5 clientes**, para amadurecer os apps com uso real.
- Depois disso, **migrar para Postgres relacional**, com hospedagem e banco na região de São Paulo,
  numa versão mais robusta. A escolha entre banco compartilhado e banco por cliente, e entre os
  fornecedores, será refeita com os preços da época e registrada em nova ADR.
- A Vercel no plano gratuito fica descartada para o Elo, porque o uso é comercial.

## Consequências

- Nenhum custo novo agora; a regra de publicação em lote do `CLAUDE.md` continua valendo
  enquanto o plano gratuito da Netlify for usado.
- Até a migração, a preferência por dados no Brasil não é atendida: as funções gratuitas da
  Netlify rodam nos EUA e as planilhas ficam no Google Drive. Isso precisa constar da análise de
  LGPD (transferência internacional) antes do primeiro cliente com dados reais, e deve ser
  revisto pelo jurídico.
- A Netlify permite trocar a região das funções para São Paulo (`gru`), mas a Diretoria conferiu
  (07/11/2026) que o plano gratuito não oferece a troca. Ela só fica disponível com plano pago.
- Com mais clientes, acompanhar o consumo de créditos em "Usage & billing" da Netlify. Se faltar,
  o plano Personal (US$ 9) cabe no orçamento.
- Novas abas e módulos continuam seguindo a ADR-011, mas devem evitar depender do número da
  linha fora da camada de armazenamento, para facilitar a migração futura.
