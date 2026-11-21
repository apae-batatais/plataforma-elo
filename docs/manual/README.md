# Manual do Elo

- **Fonte única**: a Ajuda da plataforma, menu Suporte › Ajuda (`src/app/(elo)/ajuda/page.tsx`),
  com o passo a passo de cada tela, filtrado pelo perfil de quem vê, e o botão "Baixar o manual (PDF)".
- **PDF**: decisão da Diretoria de 21/11/2026, passa a ser gerado a partir da Ajuda, sem documento
  editado à parte (proposta #232). Até lá, o PDF em
  `public/manual/manual-elo.pdf` é o de 06/11/2026 e está desatualizado.
- O documento "Manual do Elo" no Claude Docs deixa de ser mantido.

Ao criar ou mudar uma tela: atualize a Ajuda no mesmo Pull Request (docs/metodologia.md, "Ajuda
junto com a tela"). Quem faz é o Desenvolvedor; o DevOps confere antes do merge.
