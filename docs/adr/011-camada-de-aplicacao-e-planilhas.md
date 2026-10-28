# ADR-011 · Camada de aplicação na Netlify e armazenamento em Google Planilhas

- Situação: aceita
- Data: 2026-10-27
- Substitui: ADR-003 (Supabase), ADR-004 (schema e RLS no banco), ADR-005 (outbox
  no Postgres) e ADR-009 (migrações SQL). Ajusta a ADR-010 (prévias na Netlify).
- O código da arquitetura anterior (Next.js + Postgres) continua no histórico do Git.

## Contexto
A Diretoria quer custo zero, dados no Google Drive institucional, login com a
conta Google @apaebatatais.org.br, e uma **camada de aplicação** entre o site e
os dados: as planilhas servem **só como armazenamento**.

Restrições encontradas: o plano gratuito da Netlify não liga repositórios
privados de organizações do GitHub (pede cartão/plano Pro); Vercel tem a mesma
limitação; Render e Supabase foram descartados pela Diretoria.

## Decisão
```
Navegador ──► Camada de aplicação (Next.js em Netlify Functions) ──► Google Planilhas
```
- **Camada de aplicação** (servidor Next.js): login, regras de negócio,
  validação, permissões por perfil e escopo (`src/nucleo/acesso/autorizador.ts`)
  e auditoria (`src/nucleo/auditoria`). Nenhuma regra mora na planilha.
- **Armazenamento**: Google Planilhas, acessadas por uma **conta de serviço**
  (`src/nucleo/armazenamento/google-planilhas.ts`). As planilhas são
  compartilhadas só com a conta de serviço e com a Diretoria (dona). A equipe
  usa apenas o site.
- **Tabelas**: cada aba é uma tabela com cabeçalho na linha 1, colunas achadas
  pelo nome e colunas de controle (`id`, `versao`, `ativo`, `criado_*`,
  `atualizado_*`). Nada é apagado: registros são encerrados (`ativo = FALSE`).
- **Edição simultânea**: gravação só com a versão lida; senão, a pessoa é
  avisada e nada é sobrescrito. Há uma janela de milissegundos entre conferir e
  gravar que as planilhas não permitem fechar; para o porte da Apae é aceitável.
- **Planilhas** (catálogo na variável `PLANILHAS`): `nucleo` (organização,
  pessoas, acessos), `auditoria` (somente inclusão) e uma por módulo ou serviço
  (ex.: avaliação da UR), para separar dados sensíveis.
- **Login**: Google Identity Services; o servidor confere o token, o domínio e
  se o e-mail tem conta ativa na aba `Usuarios`. Sessão em cookie assinado (8 h).
  `ADMINISTRADORES_INICIAIS` permite configurar a plataforma com as planilhas vazias.
- **Demonstração**: sem as credenciais do Google (ou com `MODO_DEMONSTRACAO=1`),
  os dados são fictícios e ficam em memória. As credenciais são ignoradas nesse
  modo, então o login fictício nunca alcança dados reais.
- **Publicação**: site criado na Netlify por "Deploy manually", sem ligação com o
  Git. O GitHub Actions publica pela CLI da Netlify: a versão oficial por botão
  (manual) e uma prévia por Pull Request.
- **Eventos entre módulos**: por enquanto, chamadas dentro da mesma requisição;
  o catálogo de eventos e a validação dos manifestos continuam valendo.

## Consequências
- Custo zero; dados no Drive institucional, com o histórico de versões do Google.
- Permissões e auditoria dependem da camada de aplicação estar correta: por isso
  têm testes próprios (`tests/nucleo/acesso.test.ts`).
- Limites do Google (cerca de 300 leituras por minuto por projeto): as telas
  leem várias abas de uma vez (`lerTabelas`), uma chamada por planilha.
- As funções gratuitas da Netlify rodam nos EUA. **Antes de dados reais de
  atendidos**, registrar a transferência internacional na análise de LGPD.
- Ninguém deve editar as planilhas à mão; se acontecer, o site aponta a aba, a
  linha e a coluna com problema em vez de gravar dado errado.
