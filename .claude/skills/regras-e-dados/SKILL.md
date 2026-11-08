---
name: regras-e-dados
description: Como implementar regras de negócio, permissões, gravação e auditoria no Elo, com as planilhas como armazenamento. Use ao criar ou alterar casos de uso, abas, permissões, auditoria ou testes de um app.
---

# Regras e dados do Elo

A arquitetura está no `CLAUDE.md` e na ADR-011: navegador → camada de aplicação → Google
Planilhas, que são só armazenamento.

## Onde fica cada coisa num app (`src/modulos/<id>/`)

- `dominio/`: regras puras, sem acesso a dados. É onde a maior parte dos testes mora.
- `aplicacao/`: casos de uso. Toda leitura para usuário passa pelo `Autorizador`; toda gravação
  usa `inserir` ou `atualizar` (com a versão lida) e chama `registrarAuditoria` com as colunas
  alteradas, nunca os valores.
- `dados/tabelas.ts`: cada aba declarada com `definirTabela` (esquema zod e `sigilo` das colunas
  pessoais ou sensíveis) e registrada para "Preparar estrutura".
- `manifesto.ts`: permissões no formato `<id>.<recurso>.<acao>`.
- `testes/`: testes do app. App novo: copie `src/modulos/_modelo`.

## Regras que não se quebram

- Altere só a pasta do app da tarefa. Núcleo, capacidades ou outro app só se a especificação
  pedir.
- Um app nunca importa outro (`npm run fronteiras` confere).
- Nenhuma fórmula, validação ou regra na planilha.
- Nada é apagado: registros são encerrados (`ativo = FALSE`, `fim`, `saida`).
- Leitura individual de dado sensível registra auditoria com `acao: 'leitura'`.
- Dados sensíveis de atendidos ficam em planilha própria do app ou serviço.
- Nunca use dados reais: teste com a demonstração e com `tests/apoio/planilhas-teste.ts`.

## Testes

- Toda regra de negócio nova vem com teste, inclusive quem vê e quem altera.
- Teste o caso negado (perfil sem permissão, escopo de outro serviço), não só o permitido.
- Antes de entregar: `npm run verificar` e `npm run build`, tudo verde.
