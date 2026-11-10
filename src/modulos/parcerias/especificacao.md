# Especificação — Módulo Parcerias

- Situação: rascunho (10/11/2026), aguardando aprovação da Diretoria
- Dono do produto: Diretoria
- Proposta de origem: issue #91 (parte B). Arquitetura: ADR-011 e ADR-020.

## Objetivo

Cadastrar os **termos de parceria** (MROSC) da OSC: quem é o parceiro, o que o termo cobre, por
quanto tempo, com quais **fontes** de recurso e quais **aportes** chegaram ao longo da vigência.
O Orçamento usa esse cadastro para ratear o custo entre as fontes e mostrar quanto de cada uma já
está comprometido. Vale para qualquer OSC que trabalhe com termos.

Para quem: Financeiro (cadastra), Diretoria e Leitura (consultam), coordenações (veem os termos
dos seus serviços).

## Usuários e permissões

| Perfil | Pode | Permissões |
| --- | --- | --- |
| Diretoria | Ver tudo | `parcerias.acessar`, `parcerias.termos.ver` |
| Financeiro | Ver e cadastrar termos, fontes, aportes e metas | `parcerias.acessar`, `parcerias.termos.ver`, `parcerias.termos.editar` |
| Coordenação de área | Ver os termos que atendem os serviços do seu escopo | `parcerias.acessar`, `parcerias.termos.ver` (escopo) |
| Leitura | Ver os termos | `parcerias.acessar`, `parcerias.termos.ver` |

Os valores dos termos não são dados pessoais.

## Entidades (planilha `parcerias`, sem dados pessoais)

| Aba | O que guarda |
| --- | --- |
| `Termos` | Parceiro, número, objeto, vigência (início e fim), situação (**em vigor, encerrado**), `ativo` |
| `TermoServicos` | Termo × Serviço (do Núcleo) atendido, com vigência |
| `TermoFontes` | Fonte dentro do termo: termo, nome (ex.: Fundo Municipal), **valor inicial**, `ativo` |
| `Aportes` | Termo, fonte do termo, tipo (**aditivo, emenda parlamentar, suplementação, outro**), data, valor (pode ser negativo para redução), descrição, `ativo` |
| `Metas` | Termo, descrição, unidade, quantidade prevista (texto e número; só registro nesta fase) |

## Regras de negócio (com teste)

1. Número do termo único por parceiro (sem diferença de acento ou maiúscula).
2. A vigência termina depois de começar; um termo atende ao menos um serviço.
3. Todo termo tem ao menos uma fonte; nome de fonte único dentro do termo.
4. **Valor da fonte** = valor inicial + soma dos aportes ativos da fonte. **Valor global do termo**
   = soma dos valores das fontes. É sempre calculado pelo Elo, nunca digitado.
5. Aporte tem data dentro da vigência do termo (ou da prorrogação, se o fim foi estendido antes) e
   nunca deixa o valor da fonte negativo.
6. Nada é apagado: termo e fonte são encerrados (`ativo = FALSE`), aporte lançado errado é
   cancelado e relançado. Toda alteração é auditada com as colunas alteradas.
7. Só `parcerias.termos.editar` altera; coordenação vê apenas termos com serviço do seu escopo.
8. **Leitura para o Orçamento** (`termosParaOrcamento`): lista termos em vigor com serviços,
   fontes e valores atuais; sem permissão própria, sem dados pessoais (ADR-013, exceção da ADR-020).
9. Parcerias não sabe onde o Orçamento usa cada fonte (módulos não se conhecem). Por isso a fonte
   encerrada deixa de aparecer para novos rateios, e os rateios já feitos continuam valendo.

## Telas

1. **Termos:** lista (parceiro, número, vigência, valor global, serviços) com filtro por situação.
2. **Ficha do termo:** dados, serviços atendidos, fontes com valor inicial, aportes e valor atual,
   metas. Botões: **Adicionar fonte**, **Registrar aporte**, **Encerrar termo**.
3. **Novo termo:** formulário em passos (dados → serviços → fontes → metas).
4. Aviso na lista dos termos que terminam em até 90 dias.

## Fica de fora

- Prestação de contas por termo e conferência com a Tesouraria (roadmap).
- Receita do termo no Orçamento ligada à fonte do termo (roadmap).
- Anexos (arquivo do termo).

## Frentes

`telas`, `regras e dados`, `infraestrutura` (planilha `parcerias` em `PLANILHAS`, perfis,
manifesto e `catalogos.ts`).

## Critérios de pronto

- [ ] Regras 1 a 9 com testes, incluindo quem vê e quem altera
- [ ] Teste do catálogo `termosParaOrcamento` sem permissão e sem dados pessoais
- [ ] "Preparar estrutura" cria as abas e liga as permissões, dentro do limite de 10 segundos
- [ ] `npm run verificar` e `npm run build` verdes
- [ ] Diretoria confere na prévia, com termos fictícios
