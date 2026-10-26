# ADR-011 · Hospedagem no Render e banco de demonstração no Supabase

- Situação: aceita
- Data: 2026-10-26
- Substitui as menções à Vercel na especificação, no README e na ADR-010.

## Contexto
A Diretoria quer prévias navegáveis de cada Pull Request, sem custo e sem
cartão de crédito, com o repositório privado na organização `apae-batatais`.

Alternativas avaliadas e descartadas:
- **Vercel** (plano gratuito): restrito a "uso pessoal ou não comercial" e não
  publica repositórios privados de organizações.
- **Netlify** (plano gratuito): não conecta repositórios privados de
  organizações e passou a exigir cartão ou plano pago para criar o projeto.
- **Banco embutido (PGlite) no servidor da hospedagem**: consome cerca de
  900 MB de memória, acima dos 512 MB do Render gratuito e no limite das
  funções da Netlify.
- **Cloudflare Workers**: limite de 10 ms de processamento por requisição no
  plano gratuito e adaptador do Next.js com compatibilidade incompleta.

## Decisão
- **Render**, plano gratuito, configurado por `render.yaml` (Blueprint): publica
  a `main` quando a verificação automática passa e cria uma prévia por Pull Request.
- **Supabase de demonstração**: um projeto gratuito, na região de São Paulo, só
  com dados fictícios. A automação "Preparar demonstração"
  (`.github/workflows/preparar-demonstracao.yml`) aplica as migrações e, na
  primeira vez, grava os dados fictícios.
- **Trava de ambiente** (`core.ambiente`): cada banco é marcado, de forma
  definitiva, como "demonstracao" ou "producao".
  - O login de demonstração (usuário fictício sem senha) só abre sobre banco
    marcado como "demonstracao".
  - Dados fictícios só são gravados em banco vazio ou de "demonstracao".
- As conexões ficam só nos Secrets do GitHub e no painel do Render, cadastradas
  pela Diretoria; o agente nunca as recebe (ADR-008).
- O banco embutido (PGlite) continua nos testes e no desenvolvimento local; as
  migrações são copiadas para o código (`npm run migracoes:gerar`) para isso.

## Consequências
- Custo zero e repositório privado.
- O Render gratuito "dorme" após 15 minutos sem uso: a primeira abertura pode
  levar cerca de um minuto.
- As prévias compartilham o mesmo banco de demonstração. Uma migração de um PR
  é aplicada nele antes do merge; se ela mudar depois, o banco de demonstração
  precisa ser recriado.
- O Render não tem servidores no Brasil (o mais próximo é a Virgínia, EUA).
  **Antes de dados reais**, reavaliar a hospedagem de produção por causa da
  LGPD (transferência internacional) e da velocidade até o banco em São Paulo.
