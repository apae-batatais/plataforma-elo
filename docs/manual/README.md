# Manual do Elo

- **Fonte única**: a Ajuda da plataforma, menu Suporte › Ajuda (`src/app/(elo)/ajuda/page.tsx`),
  com o passo a passo de cada tela, filtrado pelo perfil de quem vê, e o botão "Baixar o manual (PDF)".
- **PDF**: gerado a partir da Ajuda, sem documento editado à parte (proposta #232, ADR-040). O botão
  "Baixar o manual (PDF)" abre `/ajuda/manual` (todos os assuntos, cada um com "Para: <perfis>"
  calculado das permissões); "Salvar como PDF" usa a impressão do navegador. Não há PDF no repositório.
- **Conteúdo** (`src/app/(elo)/ajuda/assuntos.tsx`): o teste `tests/plataforma/ajuda-manual.test.ts`
  falha se uma tela do menu ficar sem assunto; a lista de pendentes dele encolhe nas entregas 2 e 3 da #232.
- O documento "Manual do Elo" no Claude Docs deixa de ser mantido.

Ao criar ou mudar uma tela: atualize a Ajuda no mesmo Pull Request (docs/metodologia.md, "Ajuda
junto com a tela"). Quem faz é o Desenvolvedor; o DevOps confere antes do merge.
