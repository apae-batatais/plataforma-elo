# Módulo Requisições — regras para o agente

Leia antes `especificacao.md` desta pasta e o `CLAUDE.md` da raiz.

- Escopo: altere apenas `src/modulos/requisicoes/` e as rotas `src/app/(elo)/requisicoes/`.
- Armazenamento: abas em `dados/tabelas.ts`, na planilha `requisicoes`. Não leia nem grave
  abas de outros módulos. Se precisar de dado de outro módulo, siga a ADR-013 (ligação pela
  plataforma). O grupo de despesa saiu da ficha em 04/11/2026.
- Pastas: `dominio/` regras puras; `aplicacao/` casos de uso (sempre com `Autorizador`,
  histórico e `registrarAuditoria`); `dados/`; `telas/`; `testes/`.
- Dados pessoais: `Requisicoes.requisitante`, `requisitante_nome` e `RequisicaoHistorico.usuario`.
- Nada é apagado: requisição cancelada ou recusada fica com a situação; o histórico só recebe inclusões.
- Uma entrega por tipo de ficha (materiais, TI, mobiliário, manutenção): `FORMULARIOS` no domínio.
- Cada tipo tem sua ficha em `telas/ficha-<tipo>.tsx` (contrato em `telas/ficha.ts`); o casco `formulario-requisicao.tsx` só cuida do que é comum. Tipo novo = ficha nova, nunca `if` no casco.
- Permissões: `requisicoes.<recurso>.<acao>`, declaradas no manifesto.
- Veículos (#229): abas `Veiculos` e `VeiculoManutencoes`; casos de uso em `aplicacao/veiculos.ts`, regras puras em `dominio/veiculo.ts`; permissão `requisicoes.veiculos.cadastrar` (só a Administração).
- Reserva de espaço (#230): ficha `espaco` (`telas/ficha-espaco.tsx`, regras em `dominio/espaco.ts`), abas `Espacos` e `EspacoIndisponibilidades`, perfil Espaços e permissão `requisicoes.espacos.decidir`. Quem decide é sempre o Espaços (a Diretoria, se quem pede é do setor); nunca a coordenação dos centros. Caminho enviada → aprovada → "Atendida" (ação `fechar`, só depois da hora de fim); sem "receber" nem prazo de atendimento. O resultado do uso fica em `detalhes.fechamento`. Conflito de horário só avisa quem decide.
- Resumo diário por e-mail (entrega 7): `aplicacao/resumo.ts` (tarefa `requisicoes.resumo_diario`, ligada em `src/plataforma/resumo-requisicoes.ts`), texto fixo em `dominio/resumo.ts`. Nunca coloque número de requisição, nome ou texto do pedido no e-mail. O dia vai para `ResumosEnviados` antes do envio.
- Pedido de veículo (#229, entrega 2): ficha `veiculo` (`telas/ficha-veiculo.tsx`, regras em `dominio/veiculo.ts`), perfil Transporte e permissão `requisicoes.veiculos.operar`. Quem decide é sempre o Transporte (a Diretoria, se quem pede é do Transporte); nunca a coordenação dos centros, que existem só para estatística. Conflito de horário só avisa (quem pede não vê o outro pedido); aprovar sobre pedido já aprovado pede confirmação e ela vai ao histórico. Manutenção prevista tira o veículo do pedido novo e só avisa nos pedidos já feitos. Reserva aprovada só se cancela pelo Transporte, com comentário. O fechamento (`VeiculoUsos`) é a entrega 3.
