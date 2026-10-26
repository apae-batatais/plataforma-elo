# ADR-011 · Hospedagem na Netlify e modo demonstração

- Situação: aceita
- Data: 2026-10-26
- Substitui as menções à Vercel na especificação, no README e na ADR-010.

## Contexto
O plano gratuito da Vercel é restrito a "uso pessoal ou não comercial", sem
definir o termo, o que deixa dúvida para uma OSC. A Diretoria escolheu a
Netlify, que oferece o mesmo fluxo: conexão com o GitHub, publicação
automática da `main` e um link de prévia (Deploy Preview) por Pull Request.

Até o Supabase existir, não há banco real. E, na hospedagem, o servidor roda
como função, sem pasta gravável e sem acesso garantido à pasta `supabase/`.

## Decisão
- Hospedagem na Netlify, configurada por `netlify.toml`.
- **A publicação é feita pelo GitHub Actions** (`.github/workflows/publicar.yml`),
  com a CLI da Netlify: a `main` vai para produção e cada Pull Request ganha uma
  prévia em `pr-<número>`, com o link comentado no PR. Motivo: o plano gratuito
  da Netlify não conecta diretamente repositórios privados de organizações do
  GitHub (recurso do plano Pro); a publicação pela CLI é o caminho indicado pela
  própria Netlify e mantém o repositório privado e sem custo.
- A chave de acesso da Netlify fica só nos Secrets do GitHub, cadastrada pela
  Diretoria; o agente nunca a recebe (ADR-008).
- **Modo demonstração**: sem `DATABASE_URL`, na Netlify (ou com
  `MODO_DEMONSTRACAO=1`), cada servidor monta um banco PGlite em memória,
  aplica as migrações e o popula com os dados fictícios.
- As migrações são copiadas para o código (`src/nucleo/db/migracoes.gerado.ts`,
  por `npm run migracoes:gerar`); um teste falha se a cópia ficar desatualizada.
- Usuários fictícios têm identificadores fixos, para que o login da
  demonstração valha em qualquer servidor.

## Consequências
- Toda prévia é navegável sem configurar nada além de conectar o repositório.
- Na demonstração, alterações podem se perder (cada servidor tem seu banco em
  memória); o aviso no topo da página diz isso.
- Quando `DATABASE_URL` for configurada no painel da Netlify para produção, o
  modo demonstração desliga sozinho nesse ambiente; as prévias continuam com
  dados fictícios (ADR-008).
