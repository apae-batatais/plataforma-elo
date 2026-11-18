# Especificação · Cadastro de pessoa e vínculo com serviço (issue #198)

Especificada em 18 de novembro de 2026 · Decisão de arquitetura: ADR-035 · App: Núcleo (plataforma)

## Objetivo e para quem

Hoje `/nucleo/pessoas` só lista. Não há como cadastrar uma pessoa nem ligá-la a um serviço, e por
isso Saúde (#68) e Educação (#163) não encontram quem avaliar. Esta entrega dá ao Cadastro Único
as quatro ações que faltam: **cadastrar pessoa**, **corrigir dados**, **vincular a serviço** e
**encerrar vínculo**. Quem usa: a Coordenação de serviço (no seu escopo) e a Diretoria (toda a
instituição).

## Usuários e permissões

| Quem | O que pode | Permissão |
| --- | --- | --- |
| Diretoria | Cadastrar, corrigir, vincular e encerrar em qualquer serviço | `core.pessoas.editar` e `core.vinculos.editar` globais (concedidas por esta entrega) |
| Coordenação de serviço | O mesmo, só nos serviços do seu escopo | as duas já existem no perfil |
| Técnico avaliador, Leitura, Financeiro, Administração | Só veem (se o perfil já permite); sem botões de gravação | — |

- **Cadastrar pessoa**: `core.pessoas.editar` em algum escopo. Se vincular na mesma hora, também
  `core.vinculos.editar` naquele serviço.
- **Corrigir dados**: `Autorizador.podeEditarPessoa` (vê a pessoa e tem `core.pessoas.editar`).
- **Vincular e encerrar**: `core.vinculos.editar` **no serviço do vínculo** (global, da unidade, da
  área ou do serviço) e a pessoa visível para quem faz (`podeVerPessoa`).
- Pessoa recém-cadastrada e ainda sem vínculo fica visível para quem a cadastrou (regra que já existe
  em `podeVerPessoa`) e para a Diretoria; some da lista de quem coordena outro serviço.

## Entidades

Nenhuma aba nova; nada muda nas colunas e no `sigilo` de `Pessoas`, `Papeis` e `VinculosServico`.

- **`Pessoas`**: `nome` (obrigatório), `nome_social`, `data_nascimento`, `cpf`, `nis`, `e-mail`,
  `telefone`, `cidade`, `bairro`. CPF e NIS gravados só com dígitos.
- **`Papeis`**: ao cadastrar, nasce um papel `atendido` (início hoje) quando a pessoa é vinculada a
  serviço, ou o papel que quem cadastra escolher (os de `PAPEIS`).
- **`VinculosServico`**: `pessoa_id`, `servico` (código), `entrada`, `saida`, `motivo_saida`.
- **Evento** (`src/nucleo/eventos/catalogo.ts`): `servicoId` (uuid) passa a `servico` (código) e os
  ids viram texto, porque é assim que as planilhas guardam. Mudança no Núcleo pedida por esta proposta.

## Regras de negócio (com teste)

1. **Quem cadastra**: sem `core.pessoas.editar` em algum escopo, o cadastro é recusado
   (teste: Diretoria e Coordenação podem; Técnico avaliador, Leitura e Administração não).
2. **Dados mínimos**: nome com pelo menos 2 letras. CPF, se informado, precisa ter os dígitos
   verificadores corretos (reaproveita `cpfValido`); NIS, se informado, 11 dígitos; e-mail e data
   de nascimento (não futura), se informados, válidos. Mensagem diz o campo e o que fazer.
3. **Sem duplicar**: CPF igual ao de uma pessoa ativa recusa o cadastro. Nome (sem acento e sem
   diferença de maiúscula) + data de nascimento iguais a de uma pessoa ativa **avisam** e só
   gravam se a pessoa confirmar "É outra pessoa". A conferência olha o cadastro inteiro (ADR-035).
   Se a pessoa que já existe é visível para quem cadastra, a tela oferece "Vincular esta pessoa";
   se não é, a mensagem é só "Esta pessoa já está no cadastro da instituição. Peça à Diretoria para
   vinculá-la ao seu serviço." (nunca nome nem serviço dela).
4. **Cadastrar grava** a pessoa e, se foi escolhido serviço, o papel `atendido` e o vínculo, e
   audita `inclusao` em `Pessoas` (colunas preenchidas, sem valores), `Papeis` e `VinculosServico`.
   Se a gravação do vínculo falha depois de gravar a pessoa, a tela diz que a pessoa foi cadastrada
   e o vínculo não, e a pessoa pode ser vinculada em seguida (ela aparece para quem cadastrou).
5. **Corrigir dados** usa a versão lida (conflito: "Os dados mudaram enquanto você editava…") e audita
   `alteracao` só com os nomes das colunas mudadas. Não troca CPF por outro já usado.
6. **Vincular**: serviço precisa existir e estar ativo, e estar no escopo de quem grava; a pessoa
   não pode ter outro vínculo ativo (sem `saida`) no mesmo serviço; `entrada` padrão é hoje, aceita
   data passada (para lançar quem já é atendido) e recusa data futura. Audita `inclusao` e devolve o
   evento `PessoaVinculadaAServico`.
7. **Encerrar vínculo**: exige motivo (texto livre curto, obrigatório) e data de saída entre a
   entrada e hoje. Grava `saida` e `motivo_saida`; o registro continua `ativo = TRUE` para o
   histórico e a contagem mensal (ADR-035). Audita `encerramento` e devolve `PessoaDesligadaDeServico`.
   Vínculo já encerrado não encerra de novo. Quem tem a mesma pessoa em outro serviço não perde esse vínculo.
8. **Voltar ao serviço** depois de encerrado é um vínculo novo (nova linha), nunca reabrir o antigo.
9. **Leitura**: a lista continua só com quem o `Autorizador` permite. Abrir a janela de uma pessoa
   (mostra CPF, nascimento e telefone, colunas `pessoal`) grava auditoria `acao: 'leitura'` com o id da
   pessoa, uma vez por abertura, sem os valores (regra 8).
10. **Nada é apagado**: não existe "excluir pessoa". Pessoa cadastrada por engano é tratada por
    Administração na planilha, fora desta entrega (ver "Fica de fora").

## Telas

Todas dentro de `/nucleo/pessoas`, que já existe. Sem rota nova de página.

1. **Quem usa e caminho mais curto**: quem coordena um serviço quer deixar uma pessoa nova pronta
   para ser avaliada. Caminho: **Cadastrar pessoa** → preencher nome e escolher o serviço →
   **Cadastrar e vincular**. Dois cliques fora o preenchimento. Para pessoa já existente: busca pelo
   nome → **Vincular a serviço** na linha → escolher o serviço → **Vincular**.
2. **Primeira dobra**: cabeçalho com o botão **Cadastrar pessoa** (só para quem tem permissão), a
   busca e os filtros de papel que já existem. A lista ganha na linha o botão **Abrir** (também só
   quem pode ver os detalhes); a coluna Serviço continua.
3. **Componentes de `src/ui/`**: `CabecalhoPagina` (ação à direita), `Janela`/`JanelaFormulario`,
   `Campo`, `BotaoEnviar`, `FormularioConfirmado`, `Aviso`, `EstadoVazio`, `Etiqueta`,
   `PiscaOndeMudou`, `Notificacao` (`?ok=`). Nenhuma peça nova.
4. **Janela "Cadastrar pessoa"**: campos, todos com rótulo visível:
   - `Nome completo` (obrigatório), `Nome social` (dica "Como a pessoa prefere ser chamada."),
   - `Data de nascimento`, `CPF` (dica "Só números ou com pontos e traço."), `NIS`, `E-mail`,
     `Telefone`, `Cidade`, `Bairro` (os seis em "Mais dados", recolhido por padrão);
   - `Papel` (padrão "Atendido"; "Familiar", "Colaborador"… para os demais) e `Serviço` (lista só
     dos serviços do escopo de quem cadastra; opcional, mas, com papel Atendido, vem com a dica
     "Sem serviço, a pessoa não aparece para avaliar."); `Entrada` (hoje) aparece quando há serviço.
   - Botão principal: **Cadastrar e vincular** quando há serviço; **Cadastrar pessoa** quando não há.
   - Erro: o formulário continua aberto, com tudo o que foi digitado, e a mensagem acima dos campos.
   - Duplicidade provável (regra 3): `Aviso` com "Já existe uma pessoa com o mesmo nome e data de
     nascimento." e dois botões: **É outra pessoa, cadastrar** e (se visível) **Vincular a pessoa que já existe**.
5. **Janela "Abrir pessoa"** (da linha): dados da pessoa (com **Corrigir dados**), os vínculos com
   serviço em lista (serviço, entrada, saída e motivo; ativos primeiro) e o formulário curto
   **Vincular a serviço** (`Serviço`, `Entrada`). Em cada vínculo ativo, **Encerrar vínculo**.
6. **Ação sem volta**: **Encerrar vínculo** usa `FormularioConfirmado` com `Motivo` e `Data de saída`:
   "A pessoa deixa de aparecer para avaliar neste serviço a partir desta data. O histórico fica
   guardado e ela pode voltar com um novo vínculo."
7. **Estados**:
   - Vazio da lista: continua o `EstadoVazio` atual; para quem pode cadastrar, ganha a ação
     **Cadastrar pessoa** e o texto "Cadastre a primeira pessoa e vincule-a a um serviço."
   - Gravando: o botão mostra "Salvando…". Gravou: `?ok=` "Pessoa cadastrada e vinculada ao serviço."
     / "Pessoa cadastrada." / "Vínculo criado." / "Vínculo encerrado." / "Dados corrigidos." e a
     linha pisca (`PiscaOndeMudou`, chave = id).
   - Erro de regra: mensagem da regra (ex.: "CPF inválido. Confira os 11 números."). Conflito de versão:
     "Os dados mudaram enquanto você editava. Reabra e tente de novo."
   - Sem permissão: sem os botões; se abrir a ação por endereço, a camada de aplicação recusa com
     "Você não tem permissão para esta ação." e a pessoa volta à lista.
   - Sem serviço no escopo: o campo `Serviço` mostra "Você ainda não tem serviço no seu escopo. Peça
     à administração." e o cadastro sem serviço continua possível.
8. **Celular e teclado**: janelas em coluna única, botões com 44 px; ordem do teclado: nome, nome
   social, nascimento, papel, serviço, entrada, "Mais dados", botão; Esc fecha a janela. A lista
   mantém a rolagem lateral com a dica já existente.
9. **Gráficos**: nenhum.
10. **Sugestões de melhoria (a Diretoria decide)**: (a) após **Cadastrar e vincular**, oferecer
    **Cadastrar outra pessoa no mesmo serviço** para lançar uma turma; (b) importar uma lista de
    pessoas colada da planilha, como já existe em Acessos e Serviços; (c) mostrar na Saúde e na
    Educação, quando não há ninguém para avaliar, o link "Cadastrar pessoa" para quem tem permissão;
    (d) familiares e responsáveis (`VinculosFamiliares`) nesta mesma janela.

## Fica de fora

Vínculos familiares e responsáveis legais; importação em lote; apagar ou unir cadastros duplicados
(Administração na planilha, por enquanto); pedir à Diretoria a ligação de pessoa fora do escopo por
dentro do Elo; troca de serviço em um gesto só (encerra e vincula nas duas etapas); papéis além de
`atendido` com início e fim próprios (o papel é gravado no cadastro, mas não tem tela de edição);
publicar os eventos em fila; foto e documentos da pessoa.

## Frentes

- **regras e dados**: casos de uso em `src/nucleo/pessoas/` (cadastro, vínculo, encerramento,
  duplicidade), permissões da Diretoria em `dados-iniciais.ts` e em quem já tem a planilha preparada
  (ver "Decisões"), ajuste do catálogo de eventos, testes em `tests/nucleo/`.
- **telas**: janelas e botões em `src/app/(elo)/nucleo/pessoas/` (página, `acoes.ts`, formulários).
- **infraestrutura**: nenhuma.

## Entregas

Uma só, pequena o bastante para uma prévia: casos de uso com testes, permissões, ajuste do evento,
janelas na tela de Pessoas e manual. Arquivos prováveis: `src/nucleo/pessoas/gravacao.ts` (novo),
`src/nucleo/estrutura/dados-iniciais.ts`, `src/nucleo/eventos/catalogo.ts`,
`src/app/(elo)/nucleo/pessoas/`, `tests/nucleo/pessoas-gravacao.test.ts`, manual.

## Critérios de pronto (conferência na prévia)

1. Como Coordenação de um serviço da demonstração, em Pessoas aparece **Cadastrar pessoa**; como
   Leitura, não aparece.
2. Cadastrar "pessoa fictícia" com serviço do escopo: ela aparece na lista com o serviço, e na
   Saúde (ou Educação) aparece para avaliar.
3. CPF inválido mostra o erro e mantém o que foi digitado; repetir o mesmo nome e nascimento mostra o aviso.
4. **Encerrar vínculo** pede motivo e data; depois a pessoa some da lista de avaliar, mas o vínculo
   fica no histórico da janela dela.
5. A Coordenação não vê serviços de outro escopo no campo `Serviço`.
6. Como Diretoria, o campo `Serviço` lista todos.
7. `npm run verificar` e `npm run build` verdes.

## Decisões tomadas sozinho (e o custo se estiverem erradas)

- **Encerrar vínculo mantém `ativo = TRUE` e grava `saida`** (a proposta citava `ativo = FALSE`).
  O histórico de atendimento mensal e o painel de ocupação leem vínculos já encerrados; se fosse
  `ativo = FALSE` eles perderiam o passado. Custo se estiver errada: ajustar a regra e a contagem.
- **Diretoria ganha `core.pessoas.editar` e `core.vinculos.editar` globais** (a proposta diz que
  precisa poder cadastrar). Custo: duas linhas em `PERMISSOES_INICIAIS`; instituições que já
  preparam a estrutura recebem as linhas em "Preparar estrutura" só se a aba de permissões
  estiver vazia, então uma instituição já em uso precisa incluir as duas permissões pela tela de
  acessos, o que a entrega deve conferir e, se faltar essa tela, tratar na preparação.
- **Pessoa já existente fora do escopo não é vinculada pela Coordenação**: ela pede à Diretoria.
  Custo: um passo a mais em casos raros; o contrário vazaria quem é atendido em outro serviço.
- **CPF igual bloqueia, nome mais nascimento só avisa**: duas pessoas distintas podem ter o mesmo nome
  e nascimento (gêmeos, homônimos). Custo: um clique a mais.
- **Cadastro com serviço grava papel `atendido` sozinho**; os demais papéis só quando escolhidos na
  janela. Custo: papel errado se a pessoa for outra coisa; é corrigível pela Administração.
- **Eventos só devolvidos pelo caso de uso**, sem fila, e formato do catálogo ajustado ao que as
  planilhas guardam (ADR-035). Custo: nada consome ainda; quando alguém consumir, publicar é um passo.
- **Abrir pessoa audita leitura** (dados pessoais na janela), mesmo sem a regra citar a proposta.
  Custo: mais linhas na aba de auditoria.
- **Data de entrada pode ser passada**, para lançar quem já é atendido. Custo: histórico lançado por
  engano; corrigir exige Administração na planilha nesta entrega.
