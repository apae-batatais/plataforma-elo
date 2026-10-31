# Módulo Requisições — regras para o agente

Leia antes `especificacao.md` desta pasta e o `CLAUDE.md` da raiz.

- Escopo: altere apenas `src/modulos/requisicoes/` e as rotas `src/app/(elo)/requisicoes/`.
- Armazenamento: abas em `dados/tabelas.ts`, na planilha `requisicoes`. Não leia nem grave
  abas de outros módulos. Grupos de gasto (Orçamento) chegam pelo `CatalogoOrcamento`,
  entregue pela plataforma (ADR-013).
- Pastas: `dominio/` regras puras; `aplicacao/` casos de uso (sempre com `Autorizador`,
  histórico e `registrarAuditoria`); `dados/`; `telas/`; `testes/`.
- Dados pessoais: `Requisicoes.requisitante`, `requisitante_nome` e `RequisicaoHistorico.usuario`.
- Nada é apagado: requisição cancelada ou recusada fica com a situação; o histórico só recebe inclusões.
- Uma entrega por tipo de ficha (materiais, TI, mobiliário, manutenção): `FORMULARIOS` no domínio.
- Permissões: `requisicoes.<recurso>.<acao>`, declaradas no manifesto.
