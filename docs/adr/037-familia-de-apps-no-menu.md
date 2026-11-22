# ADR-037 · Família de apps no menu

Situação: aceita · Data: 21 de novembro de 2026 · Proposta: #223

## Contexto

Os três apps de avaliação (Assistência Social, Educação, Saúde) aparecem soltos no menu e nos cartões do início. A Diretoria
quer agrupá-los em "Avaliações", mantendo o menu de cada app dentro (três níveis). Hoje o manifesto só descreve um app; o
menu lateral tem dois níveis (app → telas).

## Decisão

1. O manifesto do módulo ganha o campo opcional `familia`. O nome, o ícone e a ordem das famílias ficam num mapa único do
   Núcleo (`src/plataforma/`, junto de `icones-dos-apps.ts`); o módulo só diz a qual família pertence, sem conhecer os outros
   módulos (regra 3). Família desconhecida invalida o registro de módulos.
2. `navegacaoDoUsuario` agrupa os apps visíveis com a mesma família num item de família com `filhos` de apps, e a casca
   (`src/ui/casca.tsx`) desenha o terceiro nível reaproveitando o mecanismo de grupos que abrem e fecham (`grupos-do-menu.ts`).
   O início usa o mesmo agrupamento para mostrar um cartão por família.
3. Renomear um app muda só o `nome` do manifesto: `id`, schema, rota e permissões ficam, para não quebrar acessos, endereços
   salvos nem a planilha.
4. Os formulários de avaliação dos três apps seguem o mesmo leiaute, mas cada app mantém o seu código: nenhum componente
   compartilhado entre módulos.

## Consequências

- Novas famílias (por exemplo, futuros apps de um mesmo tema) entram com uma linha no mapa e `familia` no manifesto.
- A casca passa a ter três níveis; o teste de menu cobre perfil com todos, com um e sem nenhum app da família.
- Três formulários continuam com código parecido; mudança futura de leiaute precisa ser repetida nos três.
