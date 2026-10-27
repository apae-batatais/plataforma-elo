# Plataforma APAE Batatais

Portal com um app para cada departamento (Orçamento, Avaliação Diagnóstica e
outros), sobre um Núcleo comum de pessoas, acessos e auditoria.

```
Navegador ──► Camada de aplicação (Netlify) ──► Google Planilhas (só armazenamento)
```

- Decisão de arquitetura: [`docs/adr/011-camada-de-aplicacao-e-planilhas.md`](docs/adr/011-camada-de-aplicacao-e-planilhas.md)
- Especificação: [`docs/especificacao-plataforma.md`](docs/especificacao-plataforma.md)
- Regras para o agente desenvolvedor: [`CLAUDE.md`](CLAUDE.md)

## Como trabalhamos

A Diretoria não instala nada no computador (ADR-010).

1. **Pedido** em uma sessão do Claude com este repositório.
2. **Especificação** escrita pelo Claude e aprovada pela Diretoria.
3. **Pull Request** com o código, testes e resumo em português.
4. **Verificação automática** no GitHub (aba *Actions*).
5. **Prévia** em demonstração, publicada na Netlify; o link aparece no PR.
6. **Aprovação** do PR pela Diretoria.
7. **Publicação oficial manual**: *Actions → Publicar → Run workflow* (ramo `main`).

## Configuração (feita uma vez pela Diretoria)

**Netlify**
1. *Add new project → Deploy manually*: arraste qualquer pasta (só para criar o site).
2. Guarde o *Project ID* (*Project configuration → General*).
3. Crie uma chave em *User settings → Applications → Personal access tokens*.

**GitHub** (*Settings → Secrets and variables → Actions*)
- `NETLIFY_AUTH_TOKEN` e `NETLIFY_SITE_ID`.

**Google Cloud** (projeto da conta institucional, sem custo)
1. Ativar a *Google Sheets API*.
2. Criar uma **conta de serviço** e uma chave JSON.
3. Criar um **ID do cliente OAuth** (Aplicativo da Web), tela de consentimento
   **Interna**, com o endereço do site da Netlify em "Origens JavaScript autorizadas".

**Google Drive**
- Criar as planilhas vazias `Plataforma · Núcleo` e `Plataforma · Auditoria`
  e compartilhá-las como **Editor** com o e-mail da conta de serviço.

**Netlify → Environment variables** (contexto **Production**)

| Variável | Valor |
| --- | --- |
| `GOOGLE_CONTA_SERVICO` | conteúdo do JSON da conta de serviço |
| `GOOGLE_CLIENT_ID` | ID do cliente OAuth |
| `PLANILHAS` | `{"nucleo":"<id>","auditoria":"<id>"}` |
| `SESSAO_SEGREDO` | texto aleatório com 40+ caracteres |
| `ADMINISTRADORES_INICIAIS` | e-mails que configuram a plataforma |

Depois: entrar como administrador inicial → **Estrutura das planilhas →
Preparar estrutura** → cadastrar usuários e atribuições.

Sem essas variáveis, a plataforma roda em **demonstração** (dados fictícios).
