# Comunicação (fase 1) — plano de implementação

> **Para o agente que for executar:** use obrigatoriamente superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans, tarefa por tarefa. Os passos usam caixas (`- [ ]`) para acompanhar.

**Objetivo:** criar o app Comunicação no Elo: calendário de temas, pedidos de publicação com revisão, aprovação, agendamento e publicação marcada à mão, contatos da imprensa, e-mail pronto no Gmail e indicadores.

**Arquitetura:** módulo novo em `src/modulos/comunicacao/`, copiado de `src/modulos/_modelo`, no mesmo desenho do Requisições: `dominio/` com regras puras, `aplicacao/` com casos de uso (sempre `Autorizador`, histórico e `registrarAuditoria`), `dados/` com as abas da planilha `comunicacao`, `telas/` e `testes/`. As rotas ficam em `src/app/(elo)/comunicacao/`. Nenhuma integração externa.

**Tecnologia:** Next.js 15 (server actions), TypeScript, zod 4, Vitest, Google Planilhas pelo contrato de armazenamento do Núcleo (memória nos testes).

**Especificação:** `src/modulos/comunicacao/especificacao.md` (aprovada em 06/11/2026). Leia antes de cada tarefa.

## Restrições globais

- Escrever sempre "Apae Batatais" e "Apae Rural", nunca "APAE", em textos, telas, commits e PRs.
- Um módulo nunca importa outro módulo (`npm run fronteiras`).
- Planilha é só armazenamento: nenhuma regra na planilha; toda aba com `definirTabela` e `sigilo` nas colunas pessoais.
- Nada é apagado: encerrar com `ativo = FALSE`; o histórico é `modo: 'somente_inclusao'`.
- Toda gravação usa `inserir`/`atualizar` com a versão lida e chama `registrarAuditoria` só com nomes de colunas.
- Nunca dados reais: testes com `ArmazenamentoMemoria` e `popularDadosFicticios`.
- Texto das telas em português, do ponto de vista de quem usa ("Aprovar pedido", não "Enviar").
- Cor do app: azul-celeste `#0369A1` (claro) e `#5CC8F5` (escuro). Fonte e componentes de `src/ui`.
- Datas do dia sempre no horário de Brasília (UTC−3), nunca `toISOString().slice(0, 10)` direto.
- Arquivos fora do módulo que este plano autoriza alterar, e só eles: `src/plataforma/registro-modulos.ts`, `src/plataforma/alertas.ts`, `src/plataforma/navegacao.ts`, `src/app/(elo)/page.tsx`, `src/app/globals.css`, `src/ui/icones.tsx`, `src/ui/casca.tsx`, `src/nucleo/rede/rede.ts` (só o nome da planilha), `tests/ui/cor-do-app.test.ts`.
- Antes de cada PR: `npm run verificar` e `npm run build` verdes.
- Ramo de cada entrega: `feat/comunicacao-<assunto>`; um PR por entrega, conferido pela Diretoria na prévia.
- Commits terminam com:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01RTUpz3gHgNo4ZEvnpjFhLW
  ```

## Foco da revisão

1. **Pedido feito à noite:** às 22h de Brasília já é o dia seguinte em UTC. A data de hoje, a urgência e "publicar hoje" precisam usar o dia de Brasília (teste na Tarefa 2).
2. **Duas pessoas no mesmo pedido:** quem pediu cancela enquanto a Comunicação inicia a revisão. A segunda gravação falha com `ErroConflito` e nada é sobrescrito (teste na Tarefa 6).
3. **Tema do calendário desativado ou renomeado depois de ligado a pedidos:** o pedido continua mostrando o tema pela cópia `calendario_tema` (teste na Tarefa 5).
4. **Juntar em cadeia:** não dá para juntar um pedido a ele mesmo, a um pedido em situação final nem a um que já foi juntado (teste na Tarefa 6).
5. **E-mail pronto com contatos repetidos, inativos ou nenhum:** os endereços repetidos entre grupos saem uma vez só, os contatos inativos ficam de fora, e sem nenhum destinatário o agendamento é recusado (testes nas Tarefas 9 e 10).

---

## Entrega 1 · Base do módulo, calendário e configurações (PR `feat/comunicacao-base`)

### Tarefa 1: Regras puras do pedido

**Arquivos:**
- Criar: `src/modulos/comunicacao/dominio/pedido.ts`
- Teste: `src/modulos/comunicacao/testes/dominio.test.ts`

**Interfaces:**
- Produz:
  - `TIPOS_PECA = ['post_instagram','reel_instagram','release','artigo','entrevista'] as const`, `type TipoPeca`, `NOME_TIPO_PECA: Record<TipoPeca,string>` ("Post no Instagram", "Reel no Instagram", "Release", "Artigo", "Entrevista").
  - `SITUACOES = ['aguardando_revisao','em_revisao','devolvido','aguardando_aprovacao','aprovado','agendado','publicado','realizada','recusado','cancelado','juntado'] as const`, `type Situacao`, `NOME_SITUACAO`, `SITUACOES_FINAIS: ReadonlySet<Situacao>` (publicado, realizada, recusado, cancelado, juntado).
  - `ACOES = ['iniciar_revisao','enviar_aprovacao','devolver','recusar','juntar','reenviar','cancelar','aprovar','pedir_ajustes','agendar','reagendar','publicar'] as const`, `type Acao`.
  - `class ErroComunicacao extends Error`.
  - `conferirTransicao(de: Situacao, acao: Acao, tipo: TipoPeca): Situacao`: devolve a situação nova ou lança `ErroComunicacao('Esta ação não vale para um pedido em "<NOME_SITUACAO>".')`.
  - `COMENTARIO_OBRIGATORIO: ReadonlySet<Acao>` (devolver, recusar, pedir_ajustes).
  - `proximoNumero(existentes: string[], ano: number): string` no formato `COM-AAAA-NNNN`.

- [ ] **Passo 1: escrever os testes que falham**

```ts
it('caminho completo do pedido', () => {
  expect(conferirTransicao('aguardando_revisao', 'iniciar_revisao', 'release')).toBe('em_revisao');
  expect(conferirTransicao('em_revisao', 'enviar_aprovacao', 'release')).toBe('aguardando_aprovacao');
  expect(conferirTransicao('em_revisao', 'devolver', 'release')).toBe('devolvido');
  expect(conferirTransicao('em_revisao', 'juntar', 'release')).toBe('juntado');
  expect(conferirTransicao('devolvido', 'reenviar', 'release')).toBe('aguardando_revisao');
  expect(conferirTransicao('devolvido', 'cancelar', 'release')).toBe('cancelado');
  expect(conferirTransicao('aguardando_revisao', 'cancelar', 'release')).toBe('cancelado');
  expect(conferirTransicao('aguardando_aprovacao', 'aprovar', 'release')).toBe('aprovado');
  expect(conferirTransicao('aguardando_aprovacao', 'pedir_ajustes', 'release')).toBe('em_revisao');
  expect(conferirTransicao('aguardando_aprovacao', 'recusar', 'release')).toBe('recusado');
  expect(conferirTransicao('aprovado', 'agendar', 'release')).toBe('agendado');
  expect(conferirTransicao('agendado', 'reagendar', 'release')).toBe('agendado');
  expect(conferirTransicao('agendado', 'publicar', 'post_instagram')).toBe('publicado');
  expect(conferirTransicao('agendado', 'publicar', 'entrevista')).toBe('realizada');
});
it('ações fora de hora são recusadas', () => {
  expect(() => conferirTransicao('em_revisao', 'cancelar', 'release')).toThrow(ErroComunicacao);
  expect(() => conferirTransicao('aguardando_revisao', 'aprovar', 'release')).toThrow(ErroComunicacao);
  expect(() => conferirTransicao('publicado', 'reagendar', 'release')).toThrow(ErroComunicacao);
});
it('numeração sequencial no ano', () => {
  expect(proximoNumero([], 2026)).toBe('COM-2026-0001');
  expect(proximoNumero(['COM-2026-0001', 'COM-2026-0007', 'COM-2025-0099'], 2026)).toBe('COM-2026-0008');
});
```

- [ ] **Passo 2:** `npx vitest run src/modulos/comunicacao/testes/dominio.test.ts`. Esperado: FALHA (módulo inexistente).
- [ ] **Passo 3:** implementar `pedido.ts` com uma tabela `de → acao → para`, seguindo o quadro da regra 1 da especificação.
- [ ] **Passo 4:** rodar o mesmo comando. Esperado: PASSA.
- [ ] **Passo 5:** commit `Comunicação: regras do caminho do pedido`.

### Tarefa 2: Dias úteis, urgência e calendário

**Arquivos:**
- Criar: `src/modulos/comunicacao/dominio/prazos.ts`, `src/modulos/comunicacao/dominio/calendario.ts`
- Teste: `src/modulos/comunicacao/testes/dominio.test.ts`

**Interfaces:**
- Produz:
  - `diaEmBrasilia(agora: Date): string` ('AAAA-MM-DD', UTC−3 fixo).
  - `somarDiasUteis(dia: string, n: number): string` (segunda a sexta).
  - `diasUteisEntre(inicio: string, fim: string): number`: dias úteis depois de `inicio` até `fim`, inclusive; 0 se `fim <= inicio`.
  - `ehUrgente(dataDesejada: string, hoje: string, antecedencia: number): boolean` = `dataDesejada < somarDiasUteis(hoje, antecedencia)`.
  - `type TipoData = 'exata' | 'periodo'`.
  - `conferirItemCalendario(i: { tema: string; tipoData: TipoData; inicio: string; fim: string; tipos: TipoPeca[] }): string[]` (mensagens de erro).
  - `itensParaEscolha<T extends { ativo: boolean; inicio: string; fim: string }>(itens: T[], hoje: string): T[]`: ativos com `fim >= hoje`, ordenados por `inicio`.

- [ ] **Passo 1: escrever os testes que falham**

```ts
it('dia de hoje é o de Brasília', () => {
  expect(diaEmBrasilia(new Date('2026-11-07T01:30:00Z'))).toBe('2026-11-06'); // 22h30 de sexta em Brasília
});
it('urgência em dias úteis', () => {
  expect(somarDiasUteis('2026-11-06', 5)).toBe('2026-11-13');
  expect(ehUrgente('2026-11-12', '2026-11-06', 5)).toBe(true);
  expect(ehUrgente('2026-11-13', '2026-11-06', 5)).toBe(false);
  expect(ehUrgente('2026-11-06', '2026-11-06', 0)).toBe(false);
  expect(diasUteisEntre('2026-11-06', '2026-11-09')).toBe(1);
});
it('item do calendário', () => {
  const ok = { tema: 'Dia Nacional de Luta da Pessoa com Deficiência', tipoData: 'exata' as const, inicio: '2026-09-21', fim: '2026-09-21', tipos: ['post_instagram' as const] };
  expect(conferirItemCalendario(ok)).toEqual([]);
  expect(conferirItemCalendario({ ...ok, fim: '2026-09-22' })).toContain('Data exata tem início e fim no mesmo dia.');
  expect(conferirItemCalendario({ ...ok, tipoData: 'periodo', inicio: '2026-08-28', fim: '2026-08-21' })).toContain('O fim do período não pode ser antes do início.');
  expect(conferirItemCalendario({ ...ok, tipos: [] })).toContain('Escolha pelo menos um tipo de peça sugerido.');
  expect(conferirItemCalendario({ ...ok, tema: ' ' })).toContain('Informe o tema.');
});
```

- [ ] **Passo 2:** rodar o arquivo de teste. Esperado: FALHA.
- [ ] **Passo 3:** implementar. As mensagens de erro são exatamente as dos testes.
- [ ] **Passo 4:** rodar. Esperado: PASSA.
- [ ] **Passo 5:** commit `Comunicação: dias úteis, urgência e itens do calendário`.

### Tarefa 3: Abas, manifesto e registro do módulo

**Arquivos:**
- Criar: `src/modulos/comunicacao/{manifesto.ts,index.ts,CLAUDE.md}`, `dados/tabelas.ts`, `dados/ficticios.ts`
- Alterar: `src/plataforma/registro-modulos.ts`, `src/nucleo/rede/rede.ts` (incluir `comunicacao: 'Comunicação'` em `NOME_DA_PLANILHA`)
- Teste: `src/modulos/comunicacao/testes/acesso.test.ts`

**Interfaces:**
- Produz (`dados/tabelas.ts`, planilha `PLANILHA_COMUNICACAO = 'comunicacao'`):

| Constante | Aba | Colunas (além das de controle) | Sigilo |
| --- | --- | --- | --- |
| `CalendarioComunicacao` | Calendario | tema, tipo_data (enum), inicio, fim, tipos (códigos separados por vírgula), observacao? | — |
| `PedidosComunicacao` | Pedidos | numero, solicitante, solicitante_nome, area, calendario_id?, calendario_tema?, tipo_peca (enum), titulo, descricao, data_desejada, urgente (booleano), imagem_confirmada_em?, imagem_confirmada_por?, link_video?, situacao (enum), juntado_a?, enviado_em, agendado_para?, destinatarios? (JSON `{grupos:string[],contatos:string[]}`), link_publicacao?, publicado_em? | solicitante, solicitante_nome, imagem_confirmada_por: pessoal |
| `HistoricoComunicacao` | Historico (somente inclusão) | pedido_id, em, usuario, acao, de?, para, comentario? | usuario: pessoal |
| `AnexosComunicacao` | Anexos | pedido_id, tipo ('foto'\|'documento'), arquivo_id, nome, mime, tamanho | arquivo_id: sensível; nome: pessoal |
| `ContatosComunicacao` | Contatos | nome, veiculo?, email | nome, email: pessoal |
| `GruposComunicacao` | Grupos | nome | — |
| `ContatoGruposComunicacao` | ContatoGrupos | contato_id, grupo_id | — |
| `ParametrosComunicacao` | Parametros | chave, valor (número) | — |

  `TABELAS_COMUNICACAO` com todas, e `type RegPedido` etc. no padrão do Requisições.
- Manifesto: `id: 'comunicacao'`, `nome: 'Comunicação'`, `descricao: 'Pedidos de publicação: calendário de temas, revisão, aprovação e agendamento.'`, `icone: 'megaphone'`, `schema: 'comunicacao'`, `rota: '/comunicacao'`, `permissaoAcesso: 'comunicacao.acessar'`.
  - **Permissões:** `comunicacao.acessar`, `comunicacao.solicitar`, `comunicacao.revisar`, `comunicacao.aprovar`, `comunicacao.ver_todos`, `comunicacao.calendario.gerenciar`, `comunicacao.contatos.gerenciar`, `comunicacao.configurar`, `comunicacao.indicadores`.
  - **Perfis novos:** `comunicacao` ("Comunicação") e `coordenacao_comunicacao` ("Coordenação da Comunicação").
  - **`permissoesPorPerfil`:**
    - `BASE = ['comunicacao.acessar','comunicacao.solicitar']` para todos os perfis listados no manifesto do Requisições;
    - `EQUIPE = [...BASE, 'comunicacao.revisar','comunicacao.ver_todos','comunicacao.calendario.gerenciar','comunicacao.contatos.gerenciar']` para `comunicacao`;
    - `COORDENACAO = [...EQUIPE, 'comunicacao.aprovar','comunicacao.configurar','comunicacao.indicadores']` para `coordenacao_comunicacao` e `diretoria`.
  - **Menu (seções "Pedir", "Acompanhar" e "Cadastros"):** Meus pedidos `/`, Novo pedido `/novo`, Pedidos `/pedidos` (revisar), Indicadores `/indicadores` (indicadores), Calendário `/calendario` (calendario.gerenciar), Contatos da imprensa `/contatos` (contatos.gerenciar), Configurações `/configuracoes` (configurar).
  - **Indicadores:** os 7 códigos da especificação.
- `popularComunicacaoFicticia(p: Planilhas): Promise<void>`: 6 itens no calendário (data exata e período), 2 grupos e 4 contatos fictícios, e 8 pedidos em situações variadas, com histórico.
- `index.ts` exporta `manifesto`, `TABELAS_COMUNICACAO` e `popularComunicacaoFicticia`. `registro-modulos.ts` acrescenta o módulo em `MODULOS`, `TABELAS_DOS_MODULOS` e `popularDemonstracaoDosModulos`.

- [ ] **Passo 1: escrever o teste que falha.** O `beforeEach` segue o do Requisições (`ArmazenamentoMemoria([... 'comunicacao'])`, `prepararEstrutura` com `TABELAS_COMUNICACAO` e as permissões do manifesto, `popularDadosFicticios`).

```ts
it('perfis e permissões do manifesto', () => {
  const pp = manifesto.permissoesPorPerfil;
  expect(pp.funcionario).toEqual(['comunicacao.acessar', 'comunicacao.solicitar']);
  expect(pp.comunicacao).toContain('comunicacao.revisar');
  expect(pp.comunicacao).not.toContain('comunicacao.aprovar');
  expect(pp.coordenacao_comunicacao).toEqual(expect.arrayContaining(['comunicacao.aprovar', 'comunicacao.configurar', 'comunicacao.indicadores']));
  expect(new Set(pp.diretoria)).toEqual(new Set(pp.coordenacao_comunicacao));
});
it('o histórico só recebe inclusões e as colunas pessoais têm sigilo', () => {
  expect(HistoricoComunicacao.modo).toBe('somente_inclusao');
  expect(PedidosComunicacao.sigilo).toMatchObject({ solicitante: 'pessoal', solicitante_nome: 'pessoal' });
  expect(ContatosComunicacao.sigilo).toMatchObject({ nome: 'pessoal', email: 'pessoal' });
});
```

- [ ] **Passo 2:** rodar. Esperado: FALHA.
- [ ] **Passo 3:** implementar as abas, o manifesto, os dados fictícios, o `index.ts`, o `CLAUDE.md` do módulo (escopo: só `src/modulos/comunicacao/` e `src/app/(elo)/comunicacao/`; dados pessoais nas colunas acima) e o registro.
- [ ] **Passo 4:** `npx vitest run src/modulos/comunicacao tests/nucleo/modulos.test.ts tests/nucleo/estrutura-demonstracao.test.ts`. Esperado: PASSA.
- [ ] **Passo 5:** commit `Comunicação: abas, perfis e registro do módulo`.

### Tarefa 4: Calendário e antecedência mínima (casos de uso e telas)

**Arquivos:**
- Criar: `aplicacao/calendario.ts`, `aplicacao/configuracoes.ts`, `telas/calendario.tsx`
- Criar rotas: `src/app/(elo)/comunicacao/{layout.tsx,acoes.ts,page.tsx,calendario/page.tsx,configuracoes/page.tsx}`
- Alterar: `src/app/globals.css` (bloco `[data-app='comunicacao']` com `--destaque #0369a1`; escuro `#5cc8f5`; `--destaque-forte` e `--destaque-suave` calculados como nos outros apps, com contraste conferido), `src/ui/icones.tsx` (`IconeComunicacao`, megafone em traço), `src/ui/casca.tsx`, `src/plataforma/navegacao.ts` (`megaphone: 'comunicacao'`), `tests/ui/cor-do-app.test.ts`
- Teste: `src/modulos/comunicacao/testes/calendario.test.ts`

**Interfaces:**
- Consome: `conferirItemCalendario`, `itensParaEscolha`, `diaEmBrasilia` (Tarefa 2) e as abas (Tarefa 3).
- Produz:
  - `salvarItemCalendario(p, quem, d: { id?: string; versao?: number; tema: string; tipoData: TipoData; inicio: string; fim: string; tipos: TipoPeca[]; observacao: string | null }, opcoes?: { agora?: Date }): Promise<{ id: string }>` (`comunicacao.calendario.gerenciar`).
  - `mudarSituacaoItemCalendario(p, quem, id: string, versao: number, ativo: boolean, opcoes?)`.
  - `listarCalendario(p, quem, periodo: { inicio: string; fim: string }): Promise<Array<RegCalendario & { pedidos: number; publicados: number }>>`.
  - `itensParaPedido(p, quem, opcoes?: { agora?: Date }): Promise<Array<{ id: string; tema: string; inicio: string; fim: string; tipos: TipoPeca[] }>>` (`comunicacao.solicitar`).
  - `lerAntecedencia(p): Promise<number>` (padrão 5 quando não há parâmetro).
  - `salvarAntecedencia(p, quem, dias: number, opcoes?)` (`comunicacao.configurar`; inteiro de 0 a 30).

- [ ] **Passo 1: escrever os testes que falham**

```ts
it('só Comunicação, coordenação e Diretoria cuidam do calendário', async () => {
  await expect(salvarItemCalendario(p, await como(FUNCIONARIO), item())).rejects.toThrow(ErroPermissao);
  const { id } = await salvarItemCalendario(p, await como(COMUNICACAO), item());
  expect((await lerTabela(p, CalendarioComunicacao)).porId(id)?.tema).toBe(item().tema);
  expect(await auditoriaDe(id)).toEqual([expect.objectContaining({ acao: 'inclusao', detalhes: expect.not.stringContaining(item().tema) })]);
});
it('item desativado some da escolha, mas não é apagado', async () => {
  const { id } = await salvarItemCalendario(p, await como(COMUNICACAO), item());
  await mudarSituacaoItemCalendario(p, await como(COMUNICACAO), id, 1, false);
  expect((await itensParaPedido(p, await como(FUNCIONARIO))).map((i) => i.id)).not.toContain(id);
  expect((await lerTabela(p, CalendarioComunicacao)).porId(id)?.ativo).toBe(false);
});
it('antecedência mínima: só a coordenação, de 0 a 30', async () => {
  expect(await lerAntecedencia(p)).toBe(5);
  await expect(salvarAntecedencia(p, await como(COMUNICACAO), 3)).rejects.toThrow(ErroPermissao);
  await expect(salvarAntecedencia(p, await como(COORDENACAO), 31)).rejects.toThrow('A antecedência mínima vai de 0 a 30 dias úteis.');
  await salvarAntecedencia(p, await como(COORDENACAO), 3);
  expect(await lerAntecedencia(p)).toBe(3);
});
```

  `como`, `item()`, `auditoriaDe` e os e-mails `FUNCIONARIO`, `COMUNICACAO` e `COORDENACAO` ficam num arquivo `testes/apoio.ts`. As atribuições fictícias são inseridas ali com os perfis novos; nada de dados reais.

- [ ] **Passo 2:** rodar. Esperado: FALHA.
- [ ] **Passo 3:** implementar os casos de uso e as telas.
  - **Calendário:** visão de mês e de lista, com o número de pedidos e de publicados por item.
  - **Configurações:** um campo com a antecedência mínima.
  - **Layout:** copiar o de Requisições, trocando os textos para "Comunicação" e a aba conferida para `CalendarioComunicacao`.
- [ ] **Passo 4:** `npm run verificar` e `npm run build`. Esperado: tudo verde.
- [ ] **Passo 5:** commit `Comunicação: calendário, antecedência mínima e cor do app`, e abrir o PR da Entrega 1 com o roteiro de conferência (entrar como Comunicação, criar um item de data exata e outro de período, desativar um; como coordenação, mudar a antecedência).

## Entrega 2 · Pedidos, revisão e aprovação (PR `feat/comunicacao-pedidos`)

### Tarefa 5: Enviar, ajustar e cancelar pedido

**Arquivos:**
- Criar: `aplicacao/pedidos.ts`, `telas/formulario-pedido.tsx`, `telas/lista-pedidos.tsx`
- Criar rotas: `novo/page.tsx`, `[id]/page.tsx`, `[id]/editar/page.tsx`; ações em `acoes.ts`; `page.tsx` passa a listar "Meus pedidos"
- Teste: `src/modulos/comunicacao/testes/pedidos.test.ts`

**Interfaces:**
- Consome: Tarefas 1 a 4.
- Produz:
  - `type DadosPedido = { area: string; calendarioId: string | null; tipoPeca: TipoPeca; titulo: string; descricao: string; dataDesejada: string; linkVideo: string | null; imagemConfirmada: boolean }`.
  - `enviarPedido(p, quem, d: DadosPedido & { nomeSolicitante: string }, opcoes?: { agora?: Date }): Promise<{ id: string; numero: string; urgente: boolean }>`.
  - `reenviarPedido(p, quem, id: string, versao: number, d: DadosPedido, opcoes?)`: só quem pediu, só se devolvido; recalcula a urgência.
  - `cancelarPedido(p, quem, id: string, versao: number, opcoes?)`: só quem pediu.
  - `listarPedidos(p, quem, visao: 'meus' | 'revisar' | 'aprovar' | 'agendar' | 'agendados' | 'todos', opcoes?): Promise<LinhaPedido[]>`, com `LinhaPedido = { id; numero; titulo; tipoPeca; situacao; urgente; dataDesejada; tema: string | null; solicitanteNome; area; agendadoPara: string | null }`.
  - `detalharPedido(p, quem, id, opcoes?): Promise<{ pedido: RegPedido; historico: RegHistorico[]; anexos: RegAnexo[]; acoes: Acao[] }>`.
  - O primeiro registro do histórico tem `acao: 'enviar'`, `de: null` e `para: 'aguardando_revisao'`; o reenvio tem `acao: 'reenviar'`.
  - Função interna `registrarMudanca(p, quem, pedido, acao, para, comentario, agora)`: grava o histórico e a auditoria e é usada por todas as ações.
- Regras:
  - Sem tema, `calendarioId` é `null` ("Fora do calendário"); com tema, o item precisa estar ativo, e `calendario_tema` guarda uma cópia do tema.
  - `dataDesejada` não pode ficar antes de `diaEmBrasilia(agora)`.
  - Com `linkVideo`, `imagemConfirmada` é obrigatória e o link precisa começar com `https://`.

- [ ] **Passo 1: escrever os testes que falham**

```ts
it('envia: número, urgência pela antecedência e histórico', async () => {
  const sexta = new Date('2026-11-06T15:00:00Z');
  const r = await enviarPedido(p, await como(FUNCIONARIO), pedido({ dataDesejada: '2026-11-12' }), { agora: sexta });
  expect(r).toMatchObject({ numero: 'COM-2026-0001', urgente: true });
  const reg = (await lerTabela(p, PedidosComunicacao)).porId(r.id)!;
  expect(reg).toMatchObject({ situacao: 'aguardando_revisao', solicitante: FUNCIONARIO });
  expect((await historicoDe(r.id)).map((h) => h.para)).toEqual(['aguardando_revisao']);
});
it('fora do calendário, data no passado e confirmação de imagem', async () => {
  const f = await como(FUNCIONARIO);
  await expect(enviarPedido(p, f, pedido({ calendarioId: null }))).resolves.toBeTruthy();
  await expect(enviarPedido(p, f, pedido({ dataDesejada: '2020-01-01' }))).rejects.toThrow('A data desejada não pode estar no passado.');
  await expect(enviarPedido(p, f, pedido({ linkVideo: 'https://drive.google.com/x', imagemConfirmada: false }))).rejects.toThrow(
    'Confirme que as pessoas que aparecem têm autorização de uso de imagem.',
  );
  await expect(enviarPedido(p, f, pedido({ linkVideo: 'drive.google.com/x', imagemConfirmada: true }))).rejects.toThrow('Cole o link completo da pasta do vídeo (começando com https://).');
});
it('o tema continua legível depois de o item mudar ou ser desativado', async () => {
  const r = await enviarPedido(p, await como(FUNCIONARIO), pedido());
  await mudarSituacaoItemCalendario(p, await como(COMUNICACAO), temaId, 1, false);
  expect((await detalharPedido(p, await como(FUNCIONARIO), r.id)).pedido.calendario_tema).toBe('Setembro Verde');
});
it('cancelar: só quem pediu, só antes da revisão ou quando devolvido', async () => {
  const r = await enviarPedido(p, await como(FUNCIONARIO), pedido());
  await expect(cancelarPedido(p, await como(OUTRO_FUNCIONARIO), r.id, 1)).rejects.toThrow(ErroPermissao);
  await cancelarPedido(p, await como(FUNCIONARIO), r.id, 1);
  expect((await lerTabela(p, PedidosComunicacao)).porId(r.id)?.situacao).toBe('cancelado');
});
it('quem vê o quê: cada um os seus; Comunicação, coordenação e Diretoria todos', async () => {
  await enviarPedido(p, await como(FUNCIONARIO), pedido());
  expect(await listarPedidos(p, await como(OUTRO_FUNCIONARIO), 'meus')).toEqual([]);
  await expect(listarPedidos(p, await como(FUNCIONARIO), 'todos')).rejects.toThrow(ErroPermissao);
  for (const e of [COMUNICACAO, COORDENACAO, DIRETORIA]) expect(await listarPedidos(p, await como(e), 'todos')).toHaveLength(1);
});
```

- [ ] **Passo 2:** rodar. Esperado: FALHA.
- [ ] **Passo 3:** implementar os casos de uso e as telas Meus pedidos, Novo pedido, Ajustar e Detalhe.
  - O tema vem de uma lista com busca, com a opção "Fora do calendário".
  - A urgência aparece na hora, ao escolher a data, com ícone e texto.
  - A confirmação de imagem fica visível sempre que há link de vídeo.
- [ ] **Passo 4:** rodar os testes do módulo. Esperado: PASSA.
- [ ] **Passo 5:** commit `Comunicação: enviar, ajustar e cancelar pedido`.

### Tarefa 6: Revisão (editar, devolver, recusar, juntar) e aprovação

**Arquivos:**
- Alterar: `aplicacao/pedidos.ts`, `telas/lista-pedidos.tsx`
- Criar: `telas/acoes-pedido.tsx`; rota `pedidos/page.tsx` (filas em `?fila=revisar|aprovar|agendar|agendados|todos`)
- Teste: `src/modulos/comunicacao/testes/pedidos.test.ts`

**Interfaces:**
- Produz:
  - `revisarPedido(p, quem, id, versao, acao: 'iniciar_revisao' | 'enviar_aprovacao' | 'devolver' | 'recusar', comentario: string | null, opcoes?)` (`comunicacao.revisar`).
  - `editarNaRevisao(p, quem, id, versao, m: Partial<Pick<DadosPedido, 'titulo' | 'descricao' | 'tipoPeca' | 'calendarioId' | 'dataDesejada'>>, opcoes?)`: só em `em_revisao`; o histórico registra `acao: 'editar'` e a auditoria, as colunas alteradas.
  - `juntarPedido(p, quem, id, versao, destinoId: string, comentario: string | null, opcoes?)`.
  - `decidirPedido(p, quem, id, versao, decisao: 'aprovar' | 'pedir_ajustes' | 'recusar', comentario: string | null, opcoes?)` (`comunicacao.aprovar`; a coordenação pode decidir os próprios pedidos).
- Regras: o comentário é obrigatório para as ações em `COMENTARIO_OBRIGATORIO`, com a mensagem "Escreva o motivo para quem pediu."

- [ ] **Passo 1: escrever os testes que falham**

```ts
it('revisão → aprovação → aprovado, com histórico de cada passo', async () => {
  const { id } = await enviarPedido(p, await como(FUNCIONARIO), pedido());
  await revisarPedido(p, await como(COMUNICACAO), id, 1, 'iniciar_revisao', null);
  await editarNaRevisao(p, await como(COMUNICACAO), id, 2, { titulo: 'Novo título' });
  await revisarPedido(p, await como(COMUNICACAO), id, 3, 'enviar_aprovacao', null);
  await expect(decidirPedido(p, await como(COMUNICACAO), id, 4, 'aprovar', null)).rejects.toThrow(ErroPermissao);
  await decidirPedido(p, await como(COORDENACAO), id, 4, 'aprovar', null);
  expect((await historicoDe(id)).map((h) => h.acao)).toEqual(['enviar', 'iniciar_revisao', 'editar', 'enviar_aprovacao', 'aprovar']);
});
it('devolver, recusar e pedir ajustes exigem motivo; pedir ajustes volta para a revisão', async () => {
  const { id } = await emAprovacao();
  await expect(decidirPedido(p, await como(COORDENACAO), id, 4, 'pedir_ajustes', ' ')).rejects.toThrow('Escreva o motivo para quem pediu.');
  await decidirPedido(p, await como(COORDENACAO), id, 4, 'pedir_ajustes', 'Trocar a foto');
  expect((await lerTabela(p, PedidosComunicacao)).porId(id)?.situacao).toBe('em_revisao');
});
it('juntar: destino ativo, outro pedido e não juntado', async () => {
  const a = await emRevisao();
  const b = await emRevisao();
  await expect(juntarPedido(p, await como(COMUNICACAO), a.id, a.versao, a.id, null)).rejects.toThrow('Escolha outro pedido para juntar.');
  await juntarPedido(p, await como(COMUNICACAO), a.id, a.versao, b.id, null);
  expect((await lerTabela(p, PedidosComunicacao)).porId(a.id)).toMatchObject({ situacao: 'juntado', juntado_a: b.numero });
  const c = await emRevisao();
  await expect(juntarPedido(p, await como(COMUNICACAO), c.id, c.versao, a.id, null)).rejects.toThrow('Este pedido já foi encerrado; escolha um pedido em andamento.');
});
it('duas pessoas no mesmo pedido: a segunda gravação não sobrescreve', async () => {
  const { id } = await enviarPedido(p, await como(FUNCIONARIO), pedido());
  await revisarPedido(p, await como(COMUNICACAO), id, 1, 'iniciar_revisao', null);
  await expect(cancelarPedido(p, await como(FUNCIONARIO), id, 1)).rejects.toThrow(ErroConflito);
});
it('a coordenação aprova o próprio pedido; a Diretoria também aprova', async () => {
  const { id } = await emAprovacao({ por: COORDENACAO });
  await decidirPedido(p, await como(COORDENACAO), id, 4, 'aprovar', null);
  const outro = await emAprovacao();
  await decidirPedido(p, await como(DIRETORIA), outro.id, 4, 'aprovar', null);
});
```

  `emRevisao()` e `emAprovacao()` ficam em `testes/apoio.ts` e devolvem `{ id, numero, versao }`.

- [ ] **Passo 2:** rodar. Esperado: FALHA.
- [ ] **Passo 3:** implementar os casos de uso e as telas.
  - A tela Pedidos tem filas em controle segmentado e filtros em pílulas: situação, tipo, área e tema.
  - O detalhe do pedido mostra só os botões de `acoes`, com textos do ponto de vista de quem usa: "Começar revisão", "Enviar para aprovação", "Devolver para quem pediu", "Recusar", "Juntar com outro pedido", "Aprovar", "Pedir ajustes".
- [ ] **Passo 4:** rodar. Esperado: PASSA.
- [ ] **Passo 5:** commit `Comunicação: revisão, juntar e aprovação`.

### Tarefa 7: Avisos no início e no menu

**Arquivos:**
- Alterar: `aplicacao/pedidos.ts`, `src/plataforma/alertas.ts`, `src/app/(elo)/page.tsx` (pendências e cartão do app na grade)
- Teste: `src/modulos/comunicacao/testes/pedidos.test.ts`

**Interfaces:**
- Produz `contadoresComunicacao(p, quem, opcoes?: { agora?: Date }): Promise<{ devolvidos: number; revisar: number; urgentes: number; publicarHoje: number; aprovar: number }>`:
  - `devolvidos`: os da pessoa;
  - `revisar`: aguardando revisão ou em revisão;
  - `urgentes`: entre esses, os urgentes;
  - `publicarHoje`: agendados para o dia de Brasília;
  - `aprovar`: aguardando aprovação.
  - Cada número só conta para quem tem a permissão correspondente.
- No menu, o número de `/comunicacao` é `devolvidos + revisar + aprovar`, num bloco `try` igual ao das Requisições.

- [ ] **Passo 1: escrever o teste que falha**

```ts
it('contadores por perfil, com o dia de Brasília', async () => {
  // um devolvido do FUNCIONARIO, dois para revisar (um urgente), um para aprovar, um agendado para 06/11 às 23h de Brasília
  const noite = new Date('2026-11-07T01:30:00Z');
  expect(await contadoresComunicacao(p, await como(FUNCIONARIO), { agora: noite })).toEqual({ devolvidos: 1, revisar: 0, urgentes: 0, publicarHoje: 0, aprovar: 0 });
  expect(await contadoresComunicacao(p, await como(COMUNICACAO), { agora: noite })).toMatchObject({ revisar: 2, urgentes: 1, publicarHoje: 1, aprovar: 0 });
  expect(await contadoresComunicacao(p, await como(COORDENACAO), { agora: noite })).toMatchObject({ aprovar: 1 });
});
```

- [ ] **Passo 2:** rodar. Esperado: FALHA.
- [ ] **Passo 3:** implementar os contadores, ligar os avisos no menu e na tela inicial (com o ícone e a cor do app, abrindo direto na fila) e acrescentar o cartão do app na grade.
- [ ] **Passo 4:** `npm run verificar` e `npm run build`. Esperado: verde.
- [ ] **Passo 5:** commit `Comunicação: avisos no início e no menu`, e abrir o PR da Entrega 2 com o roteiro (pedido urgente, pedido fora do calendário, devolver e reenviar, juntar, pedir ajustes e aprovar), conferido com os três perfis.

## Entrega 3 · Fotos e documentos (PR `feat/comunicacao-anexos`)

### Tarefa 8: Anexos no pedido (ADR-014)

**Arquivos:**
- Criar: `dominio/anexos.ts`, `aplicacao/anexos.ts`, `telas/anexos.tsx`; rota `anexos/[id]/route.ts`
- Alterar: `aplicacao/pedidos.ts` (`DadosPedido` ganha `anexos: { arquivoId: string; tipo: TipoAnexo }[]`; `enviarPedido`, `reenviarPedido` e `editarNaRevisao` recebem `opcoes.arquivos?: ArmazenamentoArquivos | null`)
- Teste: `src/modulos/comunicacao/testes/anexos.test.ts`

**Interfaces:**
- Produz:
  - `LIMITES_ANEXOS = { arquivos: 5, fotoBytes: 1_500_000, documentoBytes: 10 * 1024 * 1024 }`, `type TipoAnexo = 'foto' | 'documento'`.
  - `tipoDoArquivo(mime: string): TipoAnexo | null`: fotos JPG, PNG e WebP; documentos `application/pdf` e `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
  - `conferirArquivo(a: { tipo: TipoAnexo; mime: string; tamanho: number }): string[]`.
  - `iniciarEnvioAnexoComunicacao(p, quem, arquivos, a: { tipo: TipoAnexo; mime: string; tamanho: number; origem: string }): Promise<{ url: string }>`.
  - `lerAnexoComunicacao(p, quem, arquivos, anexoId, trecho)`: só quem vê o pedido; grava auditoria `acao: 'leitura'`.
- Regras:
  - Mais de 5 arquivos é recusado com "Cada pedido aceita até 5 arquivos."
  - Cada arquivo é conferido com `arquivos.conferir(id)` antes de ser ligado ao pedido.
  - Anexos tirados num ajuste ficam com `ativo = FALSE`.
  - Foto anexada exige `imagemConfirmada`.
  - As fotos são reduzidas no navegador, como no Requisições.

- [ ] **Passo 1: escrever os testes que falham**, usando `ArquivosMemoria`:
  - tipos e tamanhos aceitos e recusados, cada um com sua mensagem;
  - limite de 5 arquivos;
  - arquivo inexistente é recusado;
  - um sexto arquivo é recusado depois de um ajuste;
  - quem não vê o pedido recebe `ErroPermissao` em `lerAnexoComunicacao`;
  - toda abertura gera um registro de auditoria `leitura`;
  - foto sem confirmação de imagem é recusada.
- [ ] **Passo 2:** rodar. Esperado: FALHA.
- [ ] **Passo 3:** implementar, reaproveitando o caminho de envio e leitura das Requisições dentro deste módulo, sem importar o módulo Requisições.
- [ ] **Passo 4:** `npm run verificar` e `npm run build`. Esperado: verde.
- [ ] **Passo 5:** commit `Comunicação: fotos e documentos no pedido`, e abrir o PR da Entrega 3.

## Entrega 4 · Contatos, agendamento, e-mail pronto e publicação (PR `feat/comunicacao-agendamento`)

### Tarefa 9: Contatos e grupos da imprensa

**Arquivos:**
- Criar: `dominio/contatos.ts`, `aplicacao/contatos.ts`, `telas/contatos.tsx`; rota `contatos/page.tsx`
- Teste: `src/modulos/comunicacao/testes/contatos.test.ts`

**Interfaces:**
- Produz:
  - `conferirContato(c: { nome: string; email: string }, existentes: { id: string; email: string }[], idAtual?: string): string[]`.
  - `salvarContato(p, quem, d: { id?; versao?; nome; veiculo: string | null; email; grupos: string[] }, opcoes?)`: troca as ligações de `ContatoGrupos`, encerrando as antigas.
  - `mudarSituacaoContato`, `salvarGrupo(p, quem, d: { id?; versao?; nome })`, `mudarSituacaoGrupo`.
  - `listarContatos(p, quem): Promise<{ grupos: Array<RegGrupo & { contatos: number }>; contatos: Array<RegContato & { grupos: string[] }> }>`.
  - `destinatariosDe(p, d: { grupos: string[]; contatos: string[] }): Promise<string[]>`: e-mails de contatos ativos, sem repetir, em minúsculas e em ordem.
  - Tudo exige `comunicacao.contatos.gerenciar`, menos `destinatariosDe`, que é interna.

- [ ] **Passo 1: escrever os testes que falham.** Devem cobrir:
  - "Informe um e-mail válido.";
  - "Este e-mail já está cadastrado." para um contato ativo com o mesmo e-mail, sem diferença de maiúsculas;
  - um contato em dois grupos aparece uma vez só em `destinatariosDe`;
  - contato desativado fica fora;
  - Funcionário não abre contatos (`ErroPermissao`).
- [ ] **Passo 2:** rodar. Esperado: FALHA.
- [ ] **Passo 3:** implementar a tela de contatos e grupos.
- [ ] **Passo 4:** rodar. Esperado: PASSA.
- [ ] **Passo 5:** commit `Comunicação: contatos e grupos da imprensa`.

### Tarefa 10: Agendar, e-mail pronto e publicar

**Arquivos:**
- Criar: `dominio/email-pronto.ts`
- Alterar: `aplicacao/pedidos.ts`, `telas/acoes-pedido.tsx`
- Teste: `src/modulos/comunicacao/testes/agendamento.test.ts`

**Interfaces:**
- Consome: `destinatariosDe` (Tarefa 9).
- Produz:
  - `montarEmailPronto(e: { destinatarios: string[]; assunto: string; corpo: string }): { url: string; enderecosNoLink: boolean; enderecos: string[] }`:
    - endereço `https://mail.google.com/mail/?view=cm&fs=1&bcc=<lista>&su=<assunto>&body=<corpo>`, com `encodeURIComponent`;
    - se a URL passar de 2.000 caracteres, sai sem `bcc` e com `enderecosNoLink: false`; a tela mostra então os endereços para copiar.
  - `agendarPedido(p, quem, id, versao, a: { agendadoPara: string; grupos: string[]; contatos: string[] }, opcoes?)`:
    - serve para agendar e reagendar;
    - a data e hora precisam estar no futuro;
    - release e artigo exigem pelo menos um destinatário ativo;
    - ao reagendar, o histórico guarda a data anterior no comentário.
  - `emailProntoDoPedido(p, quem, id): Promise<ReturnType<typeof montarEmailPronto>>`: só release e artigo agendados, para quem tem `comunicacao.revisar`.
  - `publicarPedido(p, quem, id, versao, x: { link: string | null; comentario: string | null }, opcoes?)`:
    - post e reel exigem link `https://`;
    - entrevista vai para `realizada`;
    - grava `publicado_em`.

- [ ] **Passo 1: escrever os testes que falham**

```ts
it('e-mail pronto: cópia oculta, assunto e texto; lista longa vira endereços para copiar', () => {
  const curto = montarEmailPronto({ destinatarios: ['a@jornal.com', 'b@radio.com'], assunto: 'Setembro Verde', corpo: 'Texto' });
  expect(curto.url).toBe('https://mail.google.com/mail/?view=cm&fs=1&bcc=a%40jornal.com%2Cb%40radio.com&su=Setembro%20Verde&body=Texto');
  expect(curto.enderecosNoLink).toBe(true);
  const longo = montarEmailPronto({ destinatarios: Array.from({ length: 120 }, (_, i) => `contato${i}@veiculo-ficticio.com`), assunto: 'A', corpo: 'B' });
  expect(longo.enderecosNoLink).toBe(false);
  expect(longo.url).not.toContain('bcc=');
  expect(longo.enderecos).toHaveLength(120);
});
it('agendar: só aprovado, no futuro, release com destinatário ativo', async () => {
  const { id } = await aprovado({ tipoPeca: 'release' });
  const c = await como(COMUNICACAO);
  await expect(agendarPedido(p, c, id, 5, { agendadoPara: '2020-01-01T10:00:00-03:00', grupos: [grupoId], contatos: [] })).rejects.toThrow('Escolha uma data e hora no futuro.');
  await expect(agendarPedido(p, c, id, 5, { agendadoPara: AMANHA_10H, grupos: [grupoSoComInativos], contatos: [] })).rejects.toThrow('Escolha pelo menos um contato ativo para receber o e-mail.');
  await agendarPedido(p, c, id, 5, { agendadoPara: AMANHA_10H, grupos: [grupoId], contatos: [] });
  await agendarPedido(p, c, id, 6, { agendadoPara: DEPOIS_DE_AMANHA_10H, grupos: [grupoId], contatos: [] });
  expect((await historicoDe(id)).at(-1)).toMatchObject({ acao: 'reagendar', comentario: expect.stringContaining('07/11/2026') });
});
it('publicar: post exige link; entrevista fica Realizada', async () => {
  const post = await agendado({ tipoPeca: 'post_instagram' });
  await expect(publicarPedido(p, await como(COMUNICACAO), post.id, post.versao, { link: null, comentario: null })).rejects.toThrow('Cole o link da publicação no Instagram.');
  const ent = await agendado({ tipoPeca: 'entrevista' });
  await publicarPedido(p, await como(COMUNICACAO), ent.id, ent.versao, { link: null, comentario: 'Rádio local' });
  expect((await lerTabela(p, PedidosComunicacao)).porId(ent.id)?.situacao).toBe('realizada');
});
```

- [ ] **Passo 2:** rodar. Esperado: FALHA.
- [ ] **Passo 3:** implementar as ações no detalhe do pedido:
  - "Agendar" e "Mudar data", com data e hora e, para release e artigo, a escolha de grupos e contatos;
  - "Abrir e-mail no Gmail", em nova aba, mais "Copiar endereços" quando `enderecosNoLink` for falso;
  - "Marcar como publicado" ("Marcar entrevista como realizada" para entrevista).
- [ ] **Passo 4:** `npm run verificar` e `npm run build`. Esperado: verde.
- [ ] **Passo 5:** commit `Comunicação: agendamento, e-mail pronto e publicação`, e abrir o PR da Entrega 4.

## Entrega 5 · Indicadores (PR `feat/comunicacao-indicadores`)

### Tarefa 11: Cálculo e tela dos indicadores

**Arquivos:**
- Criar: `dominio/indicadores.ts`, `aplicacao/indicadores.ts`, `telas/indicadores.tsx`; rota `indicadores/page.tsx`
- Teste: `src/modulos/comunicacao/testes/indicadores.test.ts`

**Interfaces:**
- Produz:
  - `montarIndicadores(e: { pedidos: RegPedido[]; historico: RegHistorico[]; calendario: RegCalendario[]; periodo: { inicio: string; fim: string } }): Indicadores`, com:
    ```ts
    type Indicadores = {
      volume: { total: number; porArea: Record<string, number>; porTipo: Record<TipoPeca, number>; porTema: Array<{ tema: string; total: number }> };
      tempoRevisao: number | null; tempoAprovacao: number | null; tempoPublicacao: number | null; // média em dias úteis, 1 casa
      publicadosComAtraso: { percentual: number | null; atrasados: number; publicados: number };
      urgentes: number;
      temasSemPublicacao: Array<{ id: string; tema: string; fim: string }>;
    };
    ```
  - `indicadoresComunicacao(p, quem, periodo)` (`comunicacao.indicadores`).
- Regras de cálculo (as da especificação):
  - **Volume e urgentes:** contam pelo primeiro envio dentro do período.
  - **Tempo de revisão:** de cada entrada em `aguardando_revisao` até a saída seguinte de `em_revisao`; conta no período da saída.
  - **Tempo de aprovação:** da entrada em `aguardando_aprovacao` até a decisão.
  - **Tempo até a publicação:** do primeiro envio até `publicado` ou `realizada`.
  - **Atraso:** dia de `publicado_em` em Brasília maior que `data_desejada`.
  - **Temas sem publicação:** itens com `fim` dentro do período sem nenhum pedido ligado em `publicado` ou `realizada`.
  - Todos os prazos usam `diasUteisEntre`.

- [ ] **Passo 1: escrever os testes que falham.** Usar um conjunto pequeno montado à mão no próprio teste (3 pedidos e 2 itens do calendário), com os valores esperados escritos:
  - `volume.total` 3;
  - `tempoRevisao` 1,5;
  - `publicadosComAtraso` com `{ percentual: 50, atrasados: 1, publicados: 2 }`;
  - `temasSemPublicacao` com um tema;
  - período sem dados devolve `null` nos tempos e `percentual: null`;
  - Funcionário e Comunicação recebem `ErroPermissao`; coordenação e Diretoria recebem os números.
- [ ] **Passo 2:** rodar. Esperado: FALHA.
- [ ] **Passo 3:** implementar o cálculo e a tela.
  - Filtro de mês, trimestre ou ano.
  - Cartões cujo título já é a conclusão (por exemplo, "2 temas do calendário ficaram sem publicação").
  - Gráficos de `src/ui/graficos.tsx`: uma série na cor do app; várias séries com as cores testadas para daltonismo e legenda.
- [ ] **Passo 4:** `npm run verificar` e `npm run build`. Esperado: verde.
- [ ] **Passo 5:** commit `Comunicação: indicadores`; marcar os critérios de pronto da especificação e abrir o PR da Entrega 5.

---

## Conferência da especificação (autorrevisão)

| Item da especificação | Tarefa |
| --- | --- |
| Perfis e permissões, Diretoria igual à coordenação | 3 |
| Abas e sigilo | 3 |
| Regras 1–2 (caminho e comentário obrigatório) | 1, 6 |
| Regra 3 (editar na revisão) | 6 |
| Regra 4 (juntar) | 6 |
| Regras 5–6 (fora do calendário, itens ativos, data exata ou período) | 2, 4, 5 |
| Regra 7 (data no passado, urgência) | 2, 5 |
| Regra 8 (confirmação de imagem) | 5, 8 |
| Regra 9 (anexos e link do vídeo) | 5, 8 |
| Regras 10–12 (agendar, e-mail pronto, publicar) | 10 |
| Regra 13 (cancelar) | 5 |
| Regra 14 (antecedência) | 4 |
| Regra 15 (contatos) | 9 |
| Regra 16 (quem vê) | 5 |
| Regra 17 (número) | 1 |
| Regra 18 (nada apagado, auditoria) | 3–10 |
| Telas 1–8 | 4–11 |
| Indicadores | 11 |
| Cor do app azul-celeste | 4 |
