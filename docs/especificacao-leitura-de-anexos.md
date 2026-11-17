# Especificação — Auditoria completa na leitura de anexos (issue #66, ADR-033)

## Objetivo e para quem
Garantir que **toda** abertura de foto, vídeo ou documento de Requisições e Comunicação fique na
auditoria, e que o navegador nunca receba o texto técnico do Google. Quem ganha: a Administração
(rastro completo de quem viu o quê) e a segurança dos dados da instituição. Sem mudança visível
nas telas, a não ser a mensagem de erro.

Esta proposta **mexe no Núcleo e nos dois módulos** (autorizado pela issue #66).

## Usuários e permissões
Nada muda: quem vê o anexo é quem vê o registro dono (Requisições: `podeVer`; Comunicação: quem
pediu ou `comunicacao.ver_todos`). A auditoria é sempre gravada em nome de quem leu.

## Entidades
Nenhuma aba nova nem coluna nova. `RegistrosAuditoria` recebe `detalhes` com `{ faixa: "inicio-fim" }`
(só números). Sem valores de dados.

## Regras de negócio (com teste)
1. Leitura com `Range` começando no byte 0 grava `leitura` na auditoria (já existe; manter).
2. Leitura com `Range` começando em qualquer outro byte (`bytes=1-`, `bytes=1000-2000`) também grava
   `leitura`, com a faixa em `detalhes`.
3. Pedido sem `Range` na Comunicação (fluxo inteiro) grava `leitura` uma única vez, não por trecho.
4. Pedido sem permissão não grava `leitura` e responde 403; anexo inativo ou inexistente responde 404.
5. Faixa inválida (início maior que o fim ou maior que o tamanho do arquivo) responde 416, sem ler
   o Drive e sem gravar `leitura`.
6. Falha do Drive (`ErroArquivo`) responde 502 com texto fixo, sem o texto do Google e sem o código do
   arquivo; o detalhe vai só para o registro do servidor.
7. `ErroArquivo.message` continua completo nos fluxos da Administração (conferir pasta, abrir envio).
8. Requisições e Comunicação usam a mesma função do Núcleo para faixa e auditoria (teste do Núcleo
   cobre as regras 1, 2 e 5; testes dos módulos cobrem 4 e a ligação).

## Telas
Sem tela nova. Único texto visível: o erro de leitura passa a ser
"Não foi possível abrir o arquivo agora. Tente de novo; se continuar, avise a Administração."
(a pessoa pode recarregar a página). Foto/vídeo que falha continua mostrando o estado de erro atual
do componente.

## Fica de fora
- Janela para reduzir linhas de auditoria de vídeo (ver roadmap).
- Anexos de outros módulos (hoje só Requisições e Comunicação leem anexos).
- A conferência "arquivo já pertence a outro pedido" entre módulos (outro item do andamento da Comunicação).
- Leitura servida pelo cache do navegador.

## Frentes
- `regras e dados`: função do Núcleo, `ErroArquivo.detalhe`, ajustes em `lerAnexo` e `lerAnexoComunicacao`/
  `abrirAnexoComunicacao`, testes.
- `telas`: só o texto do erro nas duas rotas.
- `infraestrutura`: nenhuma.

## Entregas
Uma entrega só (Núcleo + as duas rotas), pequena.

## Critérios de pronto
- `npm run verificar` e `npm run build` verdes.
- Na prévia: abrir uma foto de requisição e de pedido; a Administração vê na auditoria uma linha
  `leitura` por abertura. Em demonstração, o erro de arquivo mostra o texto fixo.
