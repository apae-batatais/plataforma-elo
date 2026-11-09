# Plano — Rede R4: pasta única por instituição (#53)

Especificação: `docs/especificacao-rede.md` (seção R4) e ADR-018. Ramo `feat/rede-pasta-unica`.
Frentes: regras e dados (núcleo da Rede, Drive) e telas (cadastro, conferência, lista).

1. **Drive**: contrato `ArmazenamentoPastas` (`src/nucleo/armazenamento/pastas.ts`) com Google Drive e memória; marca invisível `elo_item = <código>/<chave>`.
2. **Cadastro**: coluna `pasta` em `Instituicoes`; `salvarInstituicao` aceita link ou ID, IDs das planilhas opcionais; pasta repetida é recusada.
3. **Criar planilhas**: `garantirPlanilhasDaPasta` (usa a do cadastro, senão a marcada na pasta, senão cria), grava IDs com auditoria.
4. **Conferir**: pasta, "será criada", lixeira, botão Abrir.
5. **Telas da rede**: campo Link da pasta, preparo automático ao salvar, Tentar de novo, aviso "Estrutura desatualizada" e contagem.
6. **Administração da plataforma**: tela Estrutura sai do menu quando há Rede.
7. **Testes, Ajuda, verificar e build, PR.**
