# ADR-020 — Parcerias como app próprio e rateio de fontes no Orçamento

- Situação: proposta (10/11/2026), aguardando aprovação da Diretoria
- Data: 10/11/2026
- Proposta de origem: issue #91

## Contexto
Hoje o Orçamento mistura duas coisas no cadastro "Fonte de recurso": o instrumento jurídico (o
termo de parceria) e a origem do dinheiro (Fundo Municipal, cofinanciamento estadual…). Um termo é
um só, mas tem várias fontes, e o valor muda com aportes (aditivos, emendas, suplementações). A
decisão de 28/10/2026 ("uma fonte por item", "uma fonte por serviço na folha") também não
comporta uma pessoa ou despesa paga em parte por um termo e em parte com recurso próprio.
Outras OSCs que usarem o Elo (ex.: Apae de Franca) têm muitos financiadores e o mesmo problema.

## Decisão
1. **Parcerias é um app novo** (`src/modulos/parcerias`, planilha `parcerias`). Ele é dono do
   termo, das fontes dentro do termo, dos aportes e das metas. Não conhece o Orçamento.
2. **O Orçamento continua dono do cadastro de Fontes** (natureza pública/própria, uso
   livre/restrito) e dos indicadores. Cada fonte de um termo é **ligada** a uma Fonte do cadastro,
   numa aba do Orçamento (`FontesTermo`). Assim "dependência de recursos públicos" e "recursos
   livres" continuam iguais, sem Parcerias saber o que é natureza ou uso.
3. **Ligação entre módulos pelo caminho da ADR-013**: Parcerias expõe no `index.ts` uma leitura
   simples (`termosParaOrcamento`), sem permissão própria, e a plataforma
   (`src/plataforma/catalogos.ts`, recriado) entrega ao Orçamento uma interface
   `CatalogoParcerias`. **Exceção à ADR-013:** além de nomes, a leitura devolve **valores do termo
   e das fontes** (não são dados pessoais). O Orçamento só mostra esses valores a quem tem
   `orcamento.painel.ver`; se Parcerias estiver desligado, o catálogo é vazio e o Orçamento
   funciona só com recurso próprio.
4. **Rateio de fonte** passa a ser por linha de custo (folha: por lotação de cada pessoa;
   despesa: por item), em abas do Orçamento. A folha fica na planilha `orcamento_folha` (liga a
   pessoa ao rateio); despesas na planilha `orcamento`.
5. **Rateio dos custos comuns** (entre áreas e serviços) é regra do Orçamento, sem mudança de
   arquitetura; segue em `dominio/` como cálculo puro com teste.
6. A decisão de 28/10/2026 ("uma fonte por item") deixa de valer (aprovado pela Diretoria na
   issue #91).

## Consequências
- Mudar o termo (novo aporte) não exige mexer no Orçamento: o comprometido é calculado na hora.
- Cada fonte nova de um termo precisa ser ligada a uma Fonte do cadastro antes de ser usada no
  rateio (passo a mais, mas evita duplicar natureza e uso nos dois apps).
- Dados já lançados continuam válidos: a fonte do item e a fonte da folha por serviço viram
  rateio de 100% (ver especificação do Orçamento).
- Parcerias poderá receber, no futuro, a prestação de contas por termo e a conferência da
  Tesouraria sem mexer no Orçamento.
- Para cada OSC: nova chave `parcerias` em `PLANILHAS` (Netlify) e permissões novas ligadas aos
  perfis por "Preparar estrutura".
