# Orçamento 1D.1 — Contas e saldos — plano de implementação

> **Para o agente que for executar:** use obrigatoriamente superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans, tarefa por tarefa. Os passos usam caixas (`- [ ]`) para acompanhar. No plano, os títulos são "Tarefa N" (o script `task-brief` procura "Task N": extraia o trecho à mão, junto com "Restrições globais").

**Objetivo:** levar para o Orçamento o cadastro das contas da instituição e o saldo de cada conta no fim de cada mês, com o total por classe (livre disponível, reserva e vinculada) calculado pelo Elo e as contas sem saldo no mês apontadas como pendência.

**Arquitetura:** tudo dentro de `src/modulos/orcamento/`, no mesmo desenho da Previsão (1B). As regras puras ficam em `dominio/tesouraria.ts` e os casos de uso em `aplicacao/tesouraria.ts` (sempre com `Autorizador` e `registrarAuditoria`). As abas novas ficam numa planilha nova, `orcamento_execucao`, que depois recebe também os lançamentos da 1C. As rotas ficam em `src/app/(elo)/orcamento/tesouraria/`.

**Tecnologia:** Next.js 15 (server actions), TypeScript, zod 4, Vitest, Google Planilhas pelo contrato de armazenamento do Núcleo (memória nos testes).

**Especificação:** `src/modulos/orcamento/especificacao-execucao-tesouraria.md` (aprovada em 07/11/2026). Seções que valem aqui: "Usuários e permissões", "Onde os dados ficam" (abas `Contas`, `Saldos` e `AjustesConciliacao`), regras 13, 14, 15, 27 e 28, telas 7 e 8, "Cuidados de experiência", "O que muda fora do módulo" e "Critérios de pronto". Leia antes de cada tarefa, junto com `src/modulos/orcamento/CLAUDE.md`.

## Escopo desta entrega

| Entra | Fica para depois | Por quê |
| --- | --- | --- |
| Cadastro de contas (regra 13, tela 7) | — | — |
| Saldo do extrato por conta e mês (regra 14, tela 8) | — | — |
| Ajustes de conciliação e total por classe (regra 15) | — | — |
| Pendência "conta ativa sem saldo no mês" (regra 14) | Pendência na **Visão geral** (tela 1) | A Visão geral nasce com os sinais da 1D.2 |
| — | Conferência dos termos (regra 16, tela 9) e do recurso livre (regra 17) | As duas comparam o saldo com o **realizado**, que só existe depois da 1C.1. A 1C.1 foi para o roadmap em 07/11/2026, à espera da amostra do WK Radar |

## Restrições globais

- Escrever sempre "Apae Batatais" e "Apae Rural", nunca "APAE", em textos, telas, commits e PRs.
- Um módulo nunca importa outro módulo (`npm run fronteiras`).
- Planilha é só armazenamento: nenhuma regra na planilha; toda aba com `definirTabela`. As abas desta entrega não têm coluna pessoal nem sensível (a especificação não marca sigilo nelas).
- Nada é apagado: conta excluída e ajuste tirado ficam com `ativo = FALSE`.
- Toda gravação usa `inserir`/`atualizar` com a versão lida e chama `registrarAuditoria` só com nomes de colunas, nunca valores.
- Saldos são vistos só por Diretoria e Financeiro: `orcamento.tesouraria.ver` **não** vai para Coordenação nem para Leitura.
- Nenhum total é digitado: todo total é soma calculada pelo Elo, arredondada em centavos.
- Nunca dados reais: testes com `ArmazenamentoMemoria`, `prepararEstrutura` e `popularDadosFicticios`; contas fictícias com nomes como "Banco Fictício A".
- Datas do mês atual sempre no horário de Brasília (UTC−3), nunca `toISOString().slice(0, 7)` direto.
- Mês sempre no formato `AAAA-MM` na planilha; nas telas, "setembro de 2026".
- Texto das telas em português, do ponto de vista de quem usa ("Salvar saldos do mês", "Adicionar conta").
- Cada número diz o período ("saldos de setembro de 2026"). Valores completos nas tabelas (`reais` de `telas/formato.ts`). Telas legíveis no celular: tabelas rolam na horizontal.
- Arquivos fora de `src/modulos/orcamento/` que este plano autoriza alterar, e só eles: as rotas em `src/app/(elo)/orcamento/`; o nome da planilha nova em `src/nucleo/rede/rede.ts`, `src/app/(rede)/rede/planilhas.ts` e `src/app/(elo)/admin/estrutura/page.tsx`; a lista de planilhas em `tests/nucleo/conferir-estrutura.test.ts`; `src/plataforma/registro-modulos.ts` (só para chamar a população fictícia nova). Precisou de outro arquivo? Pare e relate.
- Antes do PR: `npm run verificar` e `npm run build` verdes.
- Ramo: `feat/orcamento-tesouraria-contas`; um PR, conferido pela Diretoria na prévia.
- Commits terminam com o rodapé da sessão atual do Claude Code (`Co-Authored-By` e `Claude-Session`).

## Foco da revisão

1. **Saldo informado à noite no último dia do mês:** às 22h de 30/09 em Brasília já é 01/10 em UTC. O mês atual e o limite "não aceita mês futuro" usam o mês de Brasília (teste na Tarefa 1).
2. **Duas pessoas salvando os saldos do mesmo mês:** a segunda gravação de um saldo já alterado falha com `ErroConflito`, e nenhum saldo daquela tela é gravado pela metade (teste na Tarefa 4).
3. **Conta excluída depois de ter saldo:** os meses passados continuam somando o saldo dela na classe; ela só sai da lista de pendências e da tela de digitação dos meses seguintes (teste na Tarefa 1).
4. **Valor digitado no formato brasileiro:** "1.234,56", "-150,00", "R$ 2.000" e "0" são lidos certo; texto que não é número é recusado com mensagem, e campo vazio quer dizer "não informado" (teste na Tarefa 1).
5. **Fonte de conta vinculada que deixa de ser restrita ou é excluída:** o cadastro da conta não aceita fonte livre ou excluída; a conta já gravada continua mostrando o nome da fonte (teste na Tarefa 3).

---

### Tarefa 1: Regras puras da tesouraria

**Arquivos:**
- Criar: `src/modulos/orcamento/dominio/tesouraria.ts`
- Teste: `src/modulos/orcamento/testes/tesouraria-dominio.test.ts`

**Interfaces:**
- Produz:
  - `CLASSES = ['livre_disponivel', 'reserva', 'vinculada'] as const`, `type Classe`; `ROTULO_CLASSE: Record<Classe, string>` = `Livre disponível`, `Reserva`, `Vinculada`.
  - `TIPOS_CONTA = ['movimento', 'aplicacao', 'caixa'] as const`, `type TipoConta`; `ROTULO_TIPO: Record<TipoConta, string>` = `Conta movimento`, `Aplicação`, `Caixa`.
  - `mesValido(mes: string): boolean` (`/^\d{4}-(0[1-9]|1[0-2])$/`).
  - `mesAtualBrasilia(agora?: Date): string` e `mesAnterior(mes: string): string`.
  - `lerValorEmReais(texto: string): number | null | 'invalido'`: vazio → `null`; aceita sinal, "R$", ponto de milhar e vírgula decimal; arredonda em centavos.
  - `conferirConta(c: DadosConta, fontes: { id: string; uso: 'livre' | 'restrita'; ativo: boolean }[]): string[]`, com `interface DadosConta { banco: string; agencia: string; conta: string; tipo: TipoConta; classe: Classe; fonteId: string | null; unidade: string | null }`.
  - `totaisPorClasse(contas: { id: string; classe: Classe }[], saldos: { conta_id: string; mes: string; saldo: number }[], ajustes: { conta_id: string; mes: string; valor: number; ativo: boolean }[], mes: string): Record<Classe, number>`.
  - `contasSemSaldo(contasAtivas: { id: string }[], saldos: { conta_id: string; mes: string }[], mes: string): string[]` (ids).
- Regras:
  - `conferirConta` devolve, nesta ordem, só as mensagens que se aplicam: "Informe o banco.", "Informe a agência.", "Informe o número da conta.", "Escolha o tipo da conta.", "Escolha a classe da conta.", "Conta vinculada precisa da fonte (termo) de onde vem o recurso.", "A fonte de uma conta vinculada precisa ter uso restrito.", "A fonte escolhida foi excluída.", "Só conta vinculada tem fonte." O caixa não exige agência nem conta.
  - `totaisPorClasse` soma o saldo de **todas** as contas que têm saldo no mês, ativas ou não, mais os ajustes **ativos** do mês. Conta sem saldo entra com zero mais os ajustes dela.

- [ ] **Passo 1: escrever os testes que falham:**
  - `mesAtualBrasilia(new Date('2026-10-01T01:00:00Z'))` é `'2026-09'`; `mesAnterior('2026-01')` é `'2025-12'`; `mesValido('2026-13')` é `false`.
  - `lerValorEmReais`: `'1.234,56'` → `1234.56`; `'-150,00'` → `-150`; `'R$ 2.000'` → `2000`; `'0'` → `0`; `''` → `null`; `'abc'` → `'invalido'`; `'1,005'` → `1.01`.
  - `conferirConta`: vinculada sem fonte; vinculada com fonte livre; vinculada com fonte excluída; reserva com fonte; caixa sem agência e conta é aceito; movimento sem banco devolve só "Informe o banco.".
  - `totaisPorClasse`: duas contas livres e uma reserva, com um ajuste ativo de −300 e um inativo, fecham em centavos; conta excluída com saldo no mês ainda entra (Foco 3).
  - `contasSemSaldo`: devolve só as ativas sem linha naquele mês.
- [ ] **Passo 2:** `npx vitest run src/modulos/orcamento/testes/tesouraria-dominio.test.ts`. Esperado: FALHA (módulo não existe).
- [ ] **Passo 3:** implementar `dominio/tesouraria.ts` sem ler planilhas.
- [ ] **Passo 4:** rodar o mesmo teste. Esperado: PASSA.
- [ ] **Passo 5:** commit `Orçamento: regras puras de contas e saldos`.

### Tarefa 2: Planilha, abas, permissões e dados fictícios

**Arquivos:**
- Alterar: `src/modulos/orcamento/dados/tabelas.ts`, `src/modulos/orcamento/manifesto.ts`, `src/modulos/orcamento/dados/ficticios.ts`, `src/modulos/orcamento/index.ts`, `src/modulos/orcamento/CLAUDE.md`
- Alterar (fora do módulo, autorizados): `src/nucleo/rede/rede.ts`, `src/app/(rede)/rede/planilhas.ts`, `src/app/(elo)/admin/estrutura/page.tsx` (nome `orcamento_execucao: 'Orçamento — execução e tesouraria'`), `tests/nucleo/conferir-estrutura.test.ts`, `src/plataforma/registro-modulos.ts`
- Teste: `src/modulos/orcamento/testes/tesouraria-acesso.test.ts`

**Interfaces:**
- Consome: `CLASSES`, `TIPOS_CONTA` (Tarefa 1).
- Produz:
  - `PLANILHA_EXECUCAO = 'orcamento_execucao'`.
  - `Contas` (aba `Contas`): `banco`, `agencia?`, `conta?`, `tipo` (enum `TIPOS_CONTA`), `classe` (enum `CLASSES`), `fonte_id?`, `unidade?`, `observacao?`.
  - `Saldos` (aba `Saldos`): `conta_id`, `mes` (`AAAA-MM`), `saldo` (número, pode ser negativo). Quem informou e quando são as colunas de controle `atualizado_por` e `atualizado_em`.
  - `AjustesConciliacao` (aba `AjustesConciliacao`): `conta_id`, `mes`, `valor` (número, com sinal), `motivo`.
  - Tipos `RegConta`, `RegSaldo`, `RegAjusteConciliacao`; as três tabelas entram em `TABELAS_ORCAMENTO`.
  - Permissões no manifesto: `'orcamento.tesouraria.ver': 'Ver as contas, os saldos e os totais por classe'` e `'orcamento.tesouraria.editar': 'Cadastrar contas e informar os saldos do mês e os ajustes de conciliação'`. Diretoria recebe `ver`; Financeiro recebe `ver` e `editar`; nenhum outro perfil recebe nenhuma das duas.
  - Menu, seção `Tesouraria`: `Saldos do mês` (`/tesouraria`, `orcamento.tesouraria.ver`) e `Contas` (`/tesouraria/contas`, `orcamento.tesouraria.ver`).
  - `popularTesourariaFicticia(p: Planilhas): Promise<void>`: 6 contas fictícias (2 livre disponível, 1 caixa livre, 1 reserva, 2 vinculadas a fontes restritas da previsão fictícia) e saldos dos três meses anteriores ao mês atual de Brasília, deixando uma conta sem saldo no último mês, para a pendência aparecer na demonstração. Chamada em `popularDemonstracaoDosModulos`, depois de `popularPrevisaoFicticia`.
- Regras:
  - A descrição do manifesto troca "Execução em breve." por "Tesouraria: contas e saldos do mês."
  - O comentário do topo de `tabelas.ts` e o `CLAUDE.md` do módulo passam a citar a planilha `orcamento_execucao`.

- [ ] **Passo 1: escrever os testes que falham** (`prepararEstrutura` com `TABELAS_ORCAMENTO` e as permissões do manifesto, como em `previsao.test.ts`, com a planilha `orcamento_execucao` na memória):
  - `diretoria@exemplo.local` tem `orcamento.tesouraria.ver` e não tem `editar`; `financeiro@exemplo.local` tem as duas;
  - coordenação, leitura, compras e departamento pessoal não têm nenhuma das duas;
  - `prepararEstrutura` cria as abas `Contas`, `Saldos` e `AjustesConciliacao` na planilha `orcamento_execucao`;
  - `popularTesourariaFicticia` grava 6 contas, e exatamente uma conta ativa fica sem saldo no último mês.
- [ ] **Passo 2:** rodar. Esperado: FALHA.
- [ ] **Passo 3:** implementar as tabelas, o manifesto, a população fictícia e os nomes da planilha. Acrescentar `'orcamento_execucao'` às listas de planilhas em `tests/nucleo/conferir-estrutura.test.ts`.
- [ ] **Passo 4:** `npm run verificar`. Esperado: verde.
- [ ] **Passo 5:** commit `Orçamento: planilha de execução, abas da tesouraria e permissões`.

### Tarefa 3: Cadastro de contas (casos de uso)

**Arquivos:**
- Criar: `src/modulos/orcamento/aplicacao/tesouraria.ts`
- Teste: `src/modulos/orcamento/testes/tesouraria-contas.test.ts`

**Interfaces:**
- Consome: Tarefas 1 e 2; `Fontes` da planilha `orcamento` e `Unidades` do Núcleo (só leitura).
- Produz:
  - `ErroTesouraria` = `ErroValidacaoFolha` (as telas já sabem mostrá-lo), com as mensagens de `conferirConta` juntas numa linha.
  - `listarContas(p, quem): Promise<{ ativas: RegConta[]; excluidas: RegConta[]; fontes: Record<string, string>; fontesRestritas: RegFonte[]; unidades: { codigo: string; nome: string }[] }>` — exige `orcamento.tesouraria.ver`. `fontes` traz id → nome de todas as fontes, inclusive as excluídas.
  - `salvarConta(p, quem, dados: DadosConta, existente?: { id: string; versao: number }): Promise<string>` — exige `editar`.
  - `excluirConta(p, quem, id: string, versao: number): Promise<void>` e `reativarConta(p, quem, id: string, versao: number): Promise<void>` — exigem `editar`.
- Regras:
  - Banco + agência + conta não se repetem (comparação sem acento, maiúsculas e espaços). Repetida entre as excluídas: "Já existe esta conta entre as excluídas. Reative em vez de cadastrar de novo."
  - Inclusão grava auditoria `inclusao`; alteração grava `alteracao` com as colunas alteradas; excluir e reativar gravam `alteracao` com a coluna `ativo`. Entidade `Contas`.
  - Excluir não mexe nos saldos já gravados.

- [ ] **Passo 1: escrever os testes que falham:**
  - financeiro cadastra, altera, exclui e reativa; cada ação gera um registro de auditoria só com nomes de colunas;
  - diretoria lista e recebe `ErroPermissao` ao salvar; coordenação e leitura recebem `ErroPermissao` ao listar;
  - conta repetida (ativa e excluída) é recusada com a mensagem certa;
  - vinculada com fonte livre é recusada; vinculada com fonte restrita é aceita; depois que a fonte é excluída, `listarContas` ainda devolve o nome dela em `fontes` (Foco 5);
  - alterar com versão antiga lança `ErroConflito`.
- [ ] **Passo 2:** rodar. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `npx vitest run src/modulos/orcamento/testes`. Esperado: PASSA.
- [ ] **Passo 5:** commit `Orçamento: cadastro de contas da tesouraria`.

### Tarefa 4: Saldos do mês e ajustes de conciliação (casos de uso)

**Arquivos:**
- Alterar: `src/modulos/orcamento/aplicacao/tesouraria.ts`
- Teste: `src/modulos/orcamento/testes/tesouraria-saldos.test.ts`

**Interfaces:**
- Consome: Tarefas 1 a 3.
- Produz:
  - `lerSaldosDoMes(p, quem, mes: string): Promise<SaldosDoMes>` — exige `ver`. `interface SaldosDoMes { mes: string; mesAtual: string; linhas: LinhaSaldo[]; totais: Record<Classe, number>; totaisAnterior: Record<Classe, number>; pendentes: { id: string; nome: string }[] }` e `interface LinhaSaldo { conta: RegConta; saldo: RegSaldo | null; saldoAnterior: number | null; ajustes: RegAjusteConciliacao[] }`. As linhas são as contas ativas, mais as excluídas que têm saldo naquele mês; ordem: classe (na ordem de `CLASSES`) e banco.
  - `salvarSaldosDoMes(p, quem, mes: string, linhas: { contaId: string; valor: number | null; versao?: number }[]): Promise<{ gravados: number }>` — exige `editar`.
  - `incluirAjuste(p, quem, a: { contaId: string; mes: string; valor: number; motivo: string }): Promise<string>` e `tirarAjuste(p, quem, id: string, versao: number): Promise<void>` — exigem `editar`.
- Regras:
  - Mês inválido ou depois do mês atual de Brasília: "Escolha um mês até o mês atual."
  - `valor: null` = não informado: não grava nada. Valor igual ao gravado: não grava nem audita.
  - **Tudo ou nada:** antes de gravar qualquer linha, confere todas as versões lidas contra a planilha; uma diferente lança `ErroConflito` sem gravar nenhuma.
  - Saldo novo: `inserir` com auditoria `inclusao`; saldo alterado: `atualizar` com a versão lida e auditoria `alteracao` com a coluna `saldo`. Entidade `Saldos`.
  - Ajuste exige motivo ("Informe o motivo do ajuste.") e valor diferente de zero ("O ajuste não pode ser zero."); só em conta ativa. Tirar = `ativo = FALSE`. Entidade `AjustesConciliacao`.

- [ ] **Passo 1: escrever os testes que falham:**
  - financeiro grava os saldos de 3 contas; `lerSaldosDoMes` mostra os totais por classe e o saldo do mês anterior ao lado;
  - reenviar o mesmo valor não gera auditoria; alterar gera `alteracao` com `['saldo']`;
  - duas gravações com a mesma versão lida: a segunda lança `ErroConflito`, e a outra linha enviada junto não foi gravada (Foco 2);
  - mês futuro e `'2026-13'` são recusados;
  - conta ativa sem saldo aparece em `pendentes`; depois de excluída, sai das pendências do mês e continua nos totais de um mês passado em que tinha saldo (Foco 3);
  - ajuste de −300 com motivo muda o total da classe; ajuste sem motivo e ajuste zero são recusados; ajuste tirado deixa de somar;
  - diretoria lê e recebe `ErroPermissao` ao gravar; coordenação e leitura recebem `ErroPermissao` ao ler.
- [ ] **Passo 2:** rodar. Esperado: FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `npx vitest run src/modulos/orcamento/testes`. Esperado: PASSA.
- [ ] **Passo 5:** commit `Orçamento: saldos do mês e ajustes de conciliação`.

### Tarefa 5: Telas da Tesouraria

**Arquivos:**
- Criar: `src/app/(elo)/orcamento/tesouraria/layout.tsx`, `src/app/(elo)/orcamento/tesouraria/page.tsx` (Saldos do mês), `src/app/(elo)/orcamento/tesouraria/contas/page.tsx`, `src/app/(elo)/orcamento/tesouraria/acoes.ts`, `src/modulos/orcamento/telas/saldos-do-mes.tsx` (componente de cliente)
- Teste: os testes das Tarefas 3 e 4 cobrem as regras; aqui, conferência no navegador.

**Interfaces:**
- Consome: `listarContas`, `salvarConta`, `excluirConta`, `reativarConta`, `lerSaldosDoMes`, `salvarSaldosDoMes`, `incluirAjuste`, `tirarAjuste`, `lerValorEmReais`, `ROTULO_CLASSE`, `ROTULO_TIPO`.
- Regras de tela:
  - **Layout:** sem `orcamento.tesouraria.ver`, volta para `/orcamento`. Sem a planilha `orcamento_execucao`, ou com a estrutura desatualizada, mostra o mesmo aviso da Comunicação (`src/app/(elo)/comunicacao/layout.tsx`): quem administra vê as instruções; os demais veem "A Tesouraria ainda não está disponível. Fale com a administração da sua instituição."
  - **Contas:** no padrão de `previsao/fontes/page.tsx`: tabela com banco, agência, conta, tipo, classe, fonte e unidade; "Adicionar conta" e "Alterar" em `JanelaFormulario`; "Excluir" com confirmação; "Contas excluídas" com "Reativar". O campo Fonte só aparece quando a classe é Vinculada e lista só fontes restritas ativas. Quem só vê não vê botões.
  - **Saldos do mês:** escolha do mês (padrão: o mês anterior ao atual, porque o extrato do mês fecha no último dia); no topo, as pendências ("2 contas sem saldo em setembro de 2026: …"). Uma linha por conta, agrupada por classe: saldo do mês anterior, campo do saldo e ajustes do mês (com "Adicionar ajuste" e "Tirar"). Os totais por classe e o total geral mudam enquanto a pessoa digita (no navegador, com `lerValorEmReais`); o total oficial é o calculado pelo servidor depois de salvar. Botão "Salvar saldos do mês". Valor inválido marca o campo com a mensagem "Use números, como 1.234,56." e não envia. Quem só vê recebe os valores sem campos.
  - Cada total diz o mês ("Totais de setembro de 2026"). Tabelas rolam na horizontal no celular.

- [ ] **Passo 1:** implementar as telas e as ações (`executar` e mensagens no padrão de `previsao/acoes.ts`).
- [ ] **Passo 2:** `npm run verificar` e `npm run build`. Esperado: verde.
- [ ] **Passo 3: conferir no navegador** (build de produção em demonstração, Playwright): como Financeiro, cadastrar uma conta vinculada, informar o saldo de uma conta pendente, adicionar e tirar um ajuste, conferir que a pendência some e o total muda; como Diretoria, ver sem botões; como Coordenação e Leitura, o item Tesouraria não aparece no menu e `/orcamento/tesouraria` volta para `/orcamento`. Telas em 390 px sem rolagem horizontal da página.
- [ ] **Passo 4:** commit `Orçamento: telas de contas e saldos do mês`.

### Tarefa 6: Troca de classe com escolha (decisão da Diretoria em 08/11/2026)

Ramo próprio: `feat/orcamento-tesouraria-classe`, criado de `feat/orcamento-tesouraria-contas`.

**Arquivos:**
- Alterar: `dominio/tesouraria.ts`, `dados/tabelas.ts`, `aplicacao/tesouraria.ts`, `telas/campos-conta.tsx`, `src/app/(elo)/orcamento/tesouraria/contas/page.tsx`, `src/app/(elo)/orcamento/tesouraria/acoes.ts`, `dados/ficticios.ts` (só se precisar)
- Teste: `testes/tesouraria-dominio.test.ts`, `testes/tesouraria-contas.test.ts`, `testes/tesouraria-saldos.test.ts`

**Interfaces:**
- Produz:
  - Aba `MudancasClasse` (planilha `orcamento_execucao`, `definirTabela`, só inclusões): `conta_id`, `classe_anterior` (enum `CLASSES`), `fonte_id_anterior?`, `a_partir_de` (`AAAA-MM`, o primeiro mês da classe nova). `RegMudancaClasse`; entra em `TABELAS_ORCAMENTO`.
  - `classeNoMes(conta: { id: string; classe: Classe }, mudancas: { conta_id: string; classe_anterior: Classe; a_partir_de: string }[], mes: string): Classe` — entre as mudanças da conta com `a_partir_de > mes`, vale a `classe_anterior` da que tem o menor `a_partir_de`; sem nenhuma, vale `conta.classe`.
  - `totaisPorClasse(contas, saldos, ajustes, mes, mudancas = [])` passa a usar `classeNoMes`. `lerSaldosDoMes` lê `MudancasClasse` e agrupa cada linha pela classe do mês (os totais do mês anterior, pela classe daquele mês).
  - `salvarConta(p, quem, dados, existente?, troca?: { modo: 'corrigir' } | { modo: 'a_partir_de'; mes: string })`.
- Regras:
  - Classe alterada sem `troca`: "Escolha se a mudança corrige todos os meses ou vale a partir de um mês." Classe igual: `troca` é ignorada.
  - `corrigir`: só atualiza `Contas` (como hoje).
  - `a_partir_de`: mês válido, até o mês atual de Brasília e depois do último `a_partir_de` da conta ("Escolha um mês depois da última mudança de classe desta conta."). Grava a linha em `MudancasClasse` (auditoria `inclusao`, entidade `MudancasClasse`) e atualiza `Contas` (auditoria `alteracao` com as colunas).
  - Tela "Alterar conta": quando a classe escolhida difere da atual, aparece o aviso "Trocar a classe muda os totais por classe." e a escolha obrigatória entre **Corrigir em todos os meses** ("A classe estava errada desde o início.") e **Mudou a partir de um mês** (lista dos últimos 24 meses, como na tela de saldos).

- [ ] **Passo 1: testes que falham:** `classeNoMes` sem mudança, com uma e com duas mudanças (meses antes, no limite e depois); `totaisPorClasse` com mudança soma o mês anterior na classe antiga e o mês da mudança na nova; `salvarConta` recusa troca sem escolha, recusa mês futuro e mês anterior à última mudança, grava `corrigir` sem linha em `MudancasClasse` e `a_partir_de` com uma linha e as duas auditorias; `lerSaldosDoMes` de um mês anterior à mudança mostra a conta na classe antiga; Coordenação recebe `ErroPermissao`.
- [ ] **Passo 2:** rodar. Esperado: FALHA.
- [ ] **Passo 3:** implementar regras, aba, caso de uso e tela.
- [ ] **Passo 4:** `npm run verificar`, `npm run build` e conferência no navegador (Financeiro altera a classe de uma conta "a partir de" um mês e confere os totais de um mês antes e de um mês depois).
- [ ] **Passo 5:** commit `Orçamento: troca de classe da conta com escolha`.

### Fechamento da entrega

- [ ] Registrar na especificação (`especificacao-execucao-tesouraria.md`) as decisões desta entrega: escopo da 1D.1 sem as regras 16 e 17; saldo negativo aceito; mês padrão da tela; quem informou = colunas de controle.
- [ ] Atualizar `docs/backlog.md` e o arquivo de andamento deste plano.
- [ ] Revisão final do ramo; `npm run verificar` e `npm run build` verdes.
- [ ] Abrir o PR com resumo em português, o roteiro de conferência na prévia e o **roteiro de implantação** para a Diretoria: criar a planilha em branco no Drive, compartilhar com a conta de serviço, informar o ID no cadastro da instituição (campo "Orçamento — execução e tesouraria") e rodar "Preparar estrutura".

## Conferência da especificação (autorrevisão)

| Exigência da especificação | Onde |
| --- | --- |
| Regra 13 (classe obrigatória; vinculada com fonte restrita) | Tarefas 1 e 3 |
| Regra 14 (um saldo por conta e mês; pendência no topo) | Tarefas 1, 4 e 5 |
| Regra 15 (saldo da classe = saldos + ajustes; nada digitado como total) | Tarefas 1, 4 e 5 |
| Regras 27 e 28 (Autorizador, auditoria só com colunas, nada apagado) | Tarefas 3 e 4 |
| Permissões e "tesouraria.ver só para Diretoria e Financeiro" | Tarefa 2 |
| Planilha `orcamento_execucao` e abas `Contas`, `Saldos`, `AjustesConciliacao` | Tarefa 2 |
| Telas 7 e 8; cuidados de experiência | Tarefa 5 |
| "Preparar estrutura" cria as abas | Tarefa 2 (teste) e roteiro de implantação |
| Regras 16 e 17, tela 9 | Fora desta entrega (dependem da 1C.1) |
