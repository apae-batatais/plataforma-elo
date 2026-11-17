# Roteiro de transferência da Operadora

Para quando o Elo passar da Apae Batatais (Operadora de hoje) para uma empresa. Base: tabela
"Transferência para a empresa" da ADR-012. Como tudo da Operadora fica em contas **da Operadora**
(nunca de uma instituição), a transferência é uma **troca de dono**, sem mexer nos dados das
instituições, que continuam no Drive de cada uma.

> **Este roteiro nunca traz credenciais.** Ele diz onde cada uma é gerada, não o valor.

| # | Passo | Quem | Conferência |
| --- | --- | --- | --- |
| 1 | **Código:** transferir a organização ou o repositório do GitHub para a empresa | Operadora de hoje | Repositório, issues, PRs e workflows aparecem na conta nova |
| 2 | **Quadro e automações do desenvolvimento:** seguir a seção "Migração do quadro na transferência do Elo" da **ADR-019** (`docs/adr/019-desenvolvimento-automatizado-pelo-github.md`). Ela cobre o quadro "Elo", `QUADRO_TOKEN`, `QUADRO_NUMERO`, `CLAUDE_CODE_OAUTH_TOKEN` e o usuário da Diretoria nos workflows | Empresa | O workflow Fluxo recoloca as issues nas colunas certas |
| 2a | **Dona do produto nos textos dos agentes:** os documentos chamam a dona do produto só de "Diretoria (dona do produto)", sem nome de instituição (decisão da Diretoria, 11/11/2026). Conferir com `git grep -n "Apae Batatais" -- CLAUDE.md .claude .github docs/metodologia.md docs/roadmap.md docs/identidade-visual.md` que nenhum texto lido pelos agentes ou pela conversa Product Owner cita a Operadora de hoje como dona, e ajustar o que aparecer por um PR. Atualizar também as habilidades guardadas fora do repositório, na conta do Claude de quem conduz as conversas (por exemplo, a de Product Owner). O histórico (commits, PRs, issues) não muda: ele registra o que foi decidido e por quem | Empresa | A busca não acha nada nos arquivos listados |
| 3 | **Publicação:** transferir o site da Netlify; conferir plano e créditos (ADR-019) | Operadora de hoje e empresa | Uma publicação oficial termina com sucesso |
| 4 | **Google Cloud:** transferir o projeto (conta de serviço, cliente OAuth e origens autorizadas), garantindo que a conta de serviço **mantém o acesso** aos Drives das instituições | Operadora de hoje e empresa | Cada instituição continua lendo e gravando; login funciona |
| 5 | **Planilha da rede** e Drive "Elo · Operadora": transferir a propriedade | Operadora de hoje | A empresa abre a planilha e a área da rede |
| 6 | **Variáveis da Netlify:** conferir `GOOGLE_CONTA_SERVICO`, `GOOGLE_CLIENT_ID`, `SESSAO_SEGREDO` e `REDE`. Cada valor é gerado no Google Cloud (os três primeiros) ou montado conforme `docs/especificacao-rede.md` (`REDE`) | Empresa | Site publicado de novo sem erro |
| 6a | **Rotina agendada (ADR-027):** conferir os Secrets `ROTINA_URL` e `ROTINA_TOKEN` no GitHub e a variável `ROTINA_TOKEN` (o mesmo valor) na Netlify | Empresa | O workflow Rotina termina com sucesso |
| 6b | **Instagram da Comunicação (ADR-028):** conferir as variáveis `META_APP_ID`, `META_APP_SECRET` (app Meta do Elo, titularidade da empresa) e `ELO_CHAVE_CREDENCIAIS` (chave que cifra as contas conectadas; perdê-la obriga cada instituição a reconectar) | Empresa | Em Comunicação › Configurações o botão "Conectar Instagram" aparece |
| 7 | **Marca Elo e domínio da rede** em nome da empresa | Empresa | Registro e domínio na titularidade da empresa |
| 8 | **Contratos:** termo novo ou aditivo com a empresa como Operadora (`docs/termo-adesao.md`); avisar cada instituição **antes** da troca | Empresa | Termo assinado por cada instituição |
| 9 | **Conferência final:** cada instituição entra pelo próprio endereço; a Administração da rede vê o cadastro; publicação e login funcionam | Empresa | Lista de verificação abaixo |
| 10 | A Apae Batatais passa a instituição usuária comum e **perde o acesso de operadora** | Empresa | Ela não abre mais a área da rede |

## Lista de verificação final
- [ ] Cada instituição ativa entra e vê só os próprios dados.
- [ ] A Administração da rede vê o cadastro e a situação de cada instituição, sem ver pessoas, folha ou orçamento.
- [ ] Uma publicação oficial funciona.
- [ ] Credenciais antigas foram revogadas pela Operadora de hoje.

## Cuidados
- Faça a troca de credenciais na ordem: crie as novas, publique, confira, e só então revogue as antigas.
- Nada é apagado durante a transferência.
