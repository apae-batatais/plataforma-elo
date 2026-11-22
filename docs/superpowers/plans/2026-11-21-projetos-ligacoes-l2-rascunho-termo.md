# Plano — Ligações onda 2, L2: rascunho do termo ao aprovar a porta 2 (#241)

Entrega #241 (sub-issue da #145; especificação em `src/modulos/projetos/especificacao.md`, "Ligações, onda 2",
regras L7 a L11 e L14; Parcerias, regras 22, 24 a 26; ADR-023).

## Tarefas
1. Parcerias: estado `rascunho` em `Termos` (campos opcionais só no rascunho), `criarRascunhoDeTermo`
   (idempotente), rascunho fora de tudo (visão sem rascunhos), `listarRascunhos`, `termoParaProjeto`.
2. Projetos: `financiador` e `objeto` no Termo de Abertura de projeto financiado (L7).
3. Projetos: interface `CatalogoTermos`, `criarRascunhoDoProjeto`, decisão da porta 2 (L8, L9), ponto de atenção (L10),
   projeto cancelado/parado (L11); colunas `termo_id` e `termo_nome` em `Projetos`.
4. Plataforma e telas: `catalogoDeTermos`, `rascunhosDeTermo`, aba Ligações, aviso na decisão, quadro de rascunhos
   em Parcerias, Ajuda.
5. Testes, `verificar`, `build`, revisão de usabilidade e PR.

## Fora desta entrega
Completar e concluir o rascunho (Parcerias, regra 23) e encerrá-lo (regra 26), L3 (termo dentro do projeto).
