# ADR-022 — Ligações entre apps pela plataforma: leituras com permissão e portas de entrada

- Situação: proposta (14/11/2026), a aprovar com a especificação das ligações entre apps (issue #115)
- Data: 14/11/2026
- Estende a ADR-013 (ligação entre módulos pela plataforma)

## Contexto
A ADR-013 resolveu o caso simples: um módulo lê **nomes de cadastro** de outro, sem permissão e sem valores.
A onda 1 das ligações (issue #115) precisa de mais três coisas:

1. **Ler valores** de outro app (saldo e realizado do Orçamento, publicações da Comunicação) respeitando a
   permissão de cada pessoa.
2. **Gravar em outro app** (as linhas de orçamento de um projeto aprovado entram no Orçamento; o plano de
   comunicação cria pedidos de publicação), sem redigitar e sem um app importar o outro.
3. **Montar uma tela com blocos de vários apps** (Ficha do serviço), em que um app desligado ou sem permissão
   não derruba a tela.

A regra 3 do projeto continua: **um módulo nunca importa outro** (`npm run fronteiras`).

## Decisão
1. **O serviço (centro de custo) é a chave comum.** A chave é o `codigo` do cadastro `Servicos` do Núcleo, como
   Requisições, Avaliação e Parcerias já usam. Nenhum app cria cadastro paralelo de serviço; cada ligação guarda
   o código e, para leitura futura, uma cópia do nome (ADR-013).
2. **Leituras de ligação.** O app dono do dado exporta no seu `index.ts` funções de leitura de **visão de
   ligação**: recebem a pessoa (`Autorizador`) e devolvem
   `Ligacao<T> = { estado: 'ok', dados } | { estado: 'sem_permissao' } | { estado: 'indisponivel' }`.
   - O app dono confere a permissão **dele** (por exemplo `orcamento.execucao.ver`, com escopo do serviço). Quem não
     tem devolve `sem_permissao`, sem nenhum valor.
   - `indisponivel` é devolvido pela plataforma quando o app dono não está ativo na instituição. Nunca vira erro.
   - A visão de ligação **nunca traz dado pessoal**: atendidos entram só como contagem; pessoas, só como e-mail
     institucional quando o app de destino já o mostra. Colunas de `sigilo` pessoal ou sensível ficam de fora.
   - Quando o dado é do próprio projeto (por exemplo, o realizado das linhas do projeto), a visão de ligação
     pode ser mostrada a quem já vê o projeto, mesmo sem a permissão do app dono (decisão da especificação).
3. **Portas de entrada.** Para gravar, o app que recebe exporta uma função **idempotente** (`sincronizar…`,
   `criar…`) que recebe o estado desejado, a pessoa e a origem (`origem: 'projetos'`). Regras:
   - quem chama (a plataforma, a pedido do caso de uso do app de origem) só chama **depois** de o app de origem
     ter autorizado e registrado a ação dele (porta decidida, botão do responsável);
   - o app que recebe **valida de novo** os próprios cadastros (serviço, grupo, fonte e exercício ativos) e aplica
     as próprias regras; recusa com mensagem clara, nunca grava pela metade;
   - grava com `inserir`/`atualizar` e registra auditoria **no app que recebe**, com a pessoa, as colunas e a
     origem; o que entra fica marcado com a origem e não é editado à mão no app que recebeu (só pelo app de origem);
   - repetir a chamada com o mesmo estado não duplica nada.
4. **A plataforma compõe.** `src/plataforma/ligacoes.ts` (recria o papel do antigo `catalogos.ts`) liga as
   interfaces declaradas por cada app às funções exportadas pelos outros e devolve `indisponivel` para app
   desligado. Cada app declara em `aplicacao/` a **interface pequena** do que precisa (`CatalogoProjetos`,
   `CatalogoOrcamento`…) e é testado com um catálogo falso, sem o outro app.
5. **Ficha do serviço é da plataforma.** A tela mora em `src/app/(elo)/servicos/` e em `src/plataforma/`, não em
   um módulo. Cada app oferece só uma função de dados (a visão de ligação); o desenho dos blocos é da plataforma,
   com os componentes de `src/ui/`.
6. **Sem evento ainda.** Os efeitos em cadeia (cancelar projeto → encerrar linhas) são chamados explicitamente
   pelo caso de uso do app de origem, pela plataforma. A fila de eventos da ADR-005 continua para quando houver
   mais de um efeito por origem.

## Consequências
- Cada app continua funcionando e sendo testado sozinho; desligar um app deixa blocos "indisponíveis".
- A exceção de valores da ADR-020 (Parcerias → Orçamento) passa a ser a regra geral, sempre com permissão do app
  dono e sem dado pessoal.
- Linhas do Orçamento vindas de projetos têm dono (o projeto): mudar valores é pedido de mudança do projeto, não
  edição na Previsão. O Financeiro continua vendo e podendo somar o realizado.
- Novas ligações (ondas 2 e 3 da issue #115) seguem o mesmo caminho.
- Custo de erro: se a Diretoria preferir que quem vê o projeto **não** veja o realizado dele sem a permissão do
  Orçamento, basta trocar a conferência de permissão na visão de ligação (mexe na leitura, não nos dados).
